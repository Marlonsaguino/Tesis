import { useState, useEffect, useRef, useMemo } from 'react';
import { Header } from './components/Header';
import { WorkspaceStorage,boundedChat } from './services/workspace-storage';
import type { StoredDraft } from './services/workspace-storage';
import type { Message as ChatViewMessage } from './components/AgentChat';
import { AgentChat } from './components/AgentChat';
import { PendingActionsList } from './components/PendingActionsList';
import { EmailInbox } from './components/EmailInbox';
import { AuditLogView } from './components/AuditLogView';
import { GmailAuthModal } from './components/GmailAuthModal';
import { emailProvider } from './services/mockEmailProvider';
import { realGmailProvider } from './services/realGmailProvider';
import { agentEngine } from './services/agentEngine';
import { guardrails } from './services/guardrails';
import type { Email, PendingAction, AuditLog, AgentStep } from './types/email';
import { Mail, ShieldAlert, History, AlertTriangle, Bot, Settings, LayoutDashboard } from 'lucide-react';
import { analyzeMail } from './services/mail-insights';
import './mail-insights.css';
import { WorkspacePages } from './components/WorkspacePages';

export function App() {
  const database=useRef<WorkspaceStorage|null>(null);
  const [storageStatus,setStorageStatus]=useState('PostgreSQL · Conecta tu cuenta para recuperar los datos');
  const [storageReady,setStorageReady]=useState(false);
  const [storageLoading,setStorageLoading]=useState(false);
  const [restoredChat,setRestoredChat]=useState<ChatViewMessage[]|null>(null);
  const [savedDrafts,setSavedDrafts]=useState<StoredDraft[]>([]);
  const [autoGrouping,setAutoGrouping]=useState(true);
  const executingActions=useRef(new Set<string>());
  const attemptedActions=useRef(new Set<string>());
  const [rawEmails, setEmails] = useState<Email[]>([]);
  const refreshBusy=useRef(false);
  const [lastSync,setLastSync]=useState<Date|null>(null);
  const emails=useMemo(()=>rawEmails.map(email=>({...email,insights:email.insights || analyzeMail({subject:email.subject,sender:email.sender,senderName:email.senderName,text:email.body,labels:[...email.labels,email.category]})})),[rawEmails]);
  const securityAlerts=emails.filter(email=>email.insights?.level!=='none');
  const [isGmailConnected, setIsGmailConnected] = useState<boolean>(realGmailProvider.isConnected());
  const [gmailError, setGmailError] = useState<string | null>(null);
  const [isAuthModalOpen, setIsAuthModalOpen] = useState<boolean>(false);
  const authorizationPending=useRef(false);
  const [isAuthorizing,setIsAuthorizing]=useState(false);
  async function authorizeGmail(){
    if(authorizationPending.current)return;
    authorizationPending.current=true;setIsAuthorizing(true);setGmailError(null);
    try{
      await window.emailAgentHost.ready;
      const clientId=window.emailAgentHost.config.googleClientId?.trim();
      if(!clientId){setGmailError('Falta configurar Google en las opciones de la extensión.');await window.emailAgentHost.openOptions();return;}
      const auth=await window.emailAgentHost.googleLogin(clientId);
      realGmailProvider.saveConfig({...auth,clientSecret:'',redirectUri:''});
      setIsAuthModalOpen(false);setPendingActions([]);agentEngine.clearHistory();
      await refreshEmails();
    }catch(error){setGmailError(error instanceof Error?error.message:'Google no completó la autorización.');}
    finally{authorizationPending.current=false;setIsAuthorizing(false);}
  }
  const [pendingActions, setPendingActions] = useState<PendingAction[]>([]);
  const [auditLogs, setAuditLogs] = useState<AuditLog[]>([
    {
      id: 'aud_init',
      timestamp: new Date().toLocaleTimeString(),
      actionType: 'LIST_EMAILS',
      prompt: 'Inicialización de la sesión',
      executionStatus: 'AUTO_EXECUTED',
      details: 'Interfaz iniciada. Las acciones sensibles requieren aprobación humana.'
    }
  ]);
  const [strictMode, setStrictMode] = useState<boolean>(true);
  const [isProcessing, setIsProcessing] = useState<boolean>(false);
  const [activeTab, setActiveTab] = useState<'inbox' | 'pending' | 'audit' | 'summary' | 'settings'>('inbox');
  const [selectedCategory, setSelectedCategory] = useState<string>('Todos');

  // Theme Management (Dark / Light)
  const [theme, setTheme] = useState<'dark' | 'light'>(() => {
    const saved = localStorage.getItem('theme') as 'dark' | 'light' | null;
    if (saved === 'dark' || saved === 'light') return saved;
    return 'light';
  });

  // Mobile View Switcher (< 1024px)
  const isFloating=new URLSearchParams(location.search).get('floating')==='1';
  const [isExpanded,setIsExpanded]=useState(!isFloating);
  const floatingBridge=new URLSearchParams(location.search).get('bridge');
  const [mobileView, setMobileView] = useState<'chat' | 'workspace'>(isFloating?'chat':'workspace');

  useEffect(()=>{
    if(!isFloating || !floatingBridge)return;
    const onMessage=(event:MessageEvent)=>{
      if(event.source!==window.parent || event.origin!==location.origin || event.data?.bridge!==floatingBridge)return;
      if(event.data.type==='EMAILAGENT_DISPLAY_MODE'){if(typeof event.data.expanded==='boolean')setIsExpanded(event.data.expanded);return;}
      if(event.data.type!=='EMAILAGENT_NAV')return;
      const section=event.data.section;
      if(section==='chat'){setMobileView('chat');}
      else if(section==='mail'){setActiveTab('inbox');setMobileView('workspace');}
      else if(section==='actions'){setActiveTab('pending');setMobileView('workspace');}
      else if(section==='history'){setActiveTab('audit');setMobileView('workspace');}
      else if(section==='settings'){setActiveTab('settings');setMobileView('workspace');}
    };
    const onKey=(event:KeyboardEvent)=>{if(event.key==='Escape' && !document.querySelector('[role="dialog"],.modal-backdrop'))window.parent.postMessage({type:'EMAILAGENT_MINIMIZE',bridge:floatingBridge},location.origin);};
    window.addEventListener('message',onMessage);window.addEventListener('keydown',onKey);
    window.parent.postMessage({type:'EMAILAGENT_APP_READY',bridge:floatingBridge},location.origin);
    return()=>{window.removeEventListener('message',onMessage);window.removeEventListener('keydown',onKey);};
  },[isFloating,floatingBridge]);
  useEffect(()=>{if(isFloating && !isExpanded && mobileView==='workspace' && activeTab==='inbox')setMobileView('chat');},[isFloating,isExpanded,mobileView,activeTab]);
  useEffect(()=>{if(isFloating && floatingBridge)window.parent.postMessage({type:'EMAILAGENT_VIEW',bridge:floatingBridge,section:isAuthModalOpen || (mobileView==='workspace' && activeTab==='settings')?'settings':mobileView==='chat'?'chat':activeTab==='pending'?'actions':activeTab==='audit'?'history':'mail'},location.origin);},[isFloating,floatingBridge,mobileView,activeTab,isAuthModalOpen]);

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
  }, [theme]);

  const handleToggleTheme = () => {
    const next = theme === 'dark' ? 'light' : 'dark';
    setTheme(next);
    document.documentElement.setAttribute('data-theme', next);
    localStorage.setItem('theme', next);
  };

  const refreshEmails = async () => {
    if(refreshBusy.current)return;
    refreshBusy.current=true;
    try {
    setGmailError(null);
    if(window.emailAgentHost.pageAccount && !realGmailProvider.isConnected()){setEmails([]);setIsGmailConnected(false);setGmailError(window.emailAgentHost.pageAccount.email?'Conecta esta cuenta para autorizar NexoMail: '+window.emailAgentHost.pageAccount.email:'No se pudo identificar tu cuenta automáticamente. Abre el menú de tu cuenta del correo o pulsa Conectar cuenta.');return;}
    if (realGmailProvider.isConnected()) {
      try {
        const refreshKey=realGmailProvider.getSessionKey();
        const realEmails = await realGmailProvider.fetchEmails('in:inbox', 15);
        if(refreshKey!==realGmailProvider.getSessionKey())return;
        setEmails(realEmails);setLastSync(new Date());
        setIsGmailConnected(true);
        return;
      } catch (err: any) {
        console.error('Error al cargar correos reales de Gmail:', err);
        setGmailError(err.message || 'Error de credenciales de Google OAuth2');
        setIsGmailConnected(true);
        setEmails([]);
        return;
      }
    }
    setEmails([...emailProvider.getEmails()]);
    setIsGmailConnected(false);
    } finally {refreshBusy.current=false;}
  };

  useEffect(() => {
    refreshEmails();
  }, []);

  useEffect(()=>{
    const timer=window.setInterval(()=>{
      if(document.visibilityState==='visible' && realGmailProvider.isConnected() && !isProcessing && !pendingActions.length && !isAuthModalOpen)void refreshEmails();
    },60000);
    return()=>window.clearInterval(timer);
  },[isProcessing,pendingActions.length,isAuthModalOpen]);

  useEffect(()=>{
    database.current?.close();database.current=null;setStorageReady(false);setStorageLoading(false);
    if(!isGmailConnected){setRestoredChat([]);setSavedDrafts([]);setAuditLogs([]);agentEngine.clearHistory();setStorageStatus('PostgreSQL · Conecta tu cuenta para recuperar los datos');return;}
    setStorageLoading(true);
    const key=realGmailProvider.getSessionKey();
    const store=new WorkspaceStorage('gmail',window.emailAgentHost.config,async()=>{
      if(key!==realGmailProvider.getSessionKey())throw new Error('La cuenta cambió.');
      return realGmailProvider.storageAccessToken();
    },setStorageStatus);
    database.current=store;
    let active=true;
    void store.load().then(data=>{
      if(!active || key!==realGmailProvider.getSessionKey())return;
      setRestoredChat(data.sections.chat.data.map(message=>({id:message.id,sender:message.role==='user'?'user':'agent',text:message.content,created_at:message.created_at,timestamp:new Date(message.created_at).toLocaleTimeString([],{hour:'2-digit',minute:'2-digit'})})));
      agentEngine.restoreTextHistory(data.sections.chat.data);
      setSavedDrafts(data.sections.drafts.data);
      setAuditLogs(data.audit.map(event=>({id:event.id,timestamp:new Date(event.occurred_at).toLocaleString(),actionType:event.action_type as AuditLog['actionType'],prompt:event.description,executionStatus:event.status as AuditLog['executionStatus'],details:event.details})));
      const prefs=data.sections.preferences.data;
      if(prefs){setTheme(prefs.theme);setStrictMode(prefs.strict_mode);guardrails.setStrictMode(prefs.strict_mode);setAutoGrouping(prefs.auto_grouping);}
      setStorageReady(true);
    }).catch(()=>{}).finally(()=>{if(active)setStorageLoading(false);});
    return()=>{active=false;store.close();};
  },[isGmailConnected]);
  useEffect(()=>{if(storageReady)database.current?.schedule('drafts',savedDrafts);},[savedDrafts,storageReady]);
  useEffect(()=>{if(storageReady)database.current?.schedule('preferences',{theme,strict_mode:strictMode,llm_enabled:true,auto_grouping:autoGrouping});},[theme,strictMode,autoGrouping,storageReady]);
  useEffect(()=>{if(storageReady)database.current?.appendAudit(auditLogs.map(event=>({id:event.id,action_type:event.actionType,status:event.executionStatus,description:event.prompt,details:event.details,occurred_at:new Date().toISOString()})));},[auditLogs,storageReady]);
  const saveChat=(messages:ChatViewMessage[])=>{
    if(storageReady)database.current?.schedule('chat',boundedChat(messages.filter(message=>message.id!=='m-1').map(message=>({id:message.id,role:message.sender==='user'?'user':'assistant',content:message.text,created_at:message.created_at || new Date().toISOString()}))));
  };
  const reviewSavedDraft=(draft:StoredDraft)=>{
    if(!realGmailProvider.isConnected())return;
    setPendingActions(list=>[{id:crypto.randomUUID(),actionType:'SEND_EMAIL',title:'Revisar borrador recuperado: '+draft.subject,description:'Borrador recuperado de PostgreSQL. Comprueba en Enviados si hubo un intento anterior antes de aprobar.',safetyLevel:'REQUIRES_APPROVAL',payload:{savedDraftId:draft.id,recipient:draft.to,subject:draft.subject,body:draft.body,isReal:true,sessionKey:realGmailProvider.getSessionKey()},status:'PENDING',createdAt:new Date().toISOString(),aiExplanation:'Restaurado como borrador; necesita una nueva aprobación.',impactScore:'Alto',isEditable:true},...list]);
    setActiveTab('pending');setMobileView('workspace');
  };
  const eraseStoredData=async()=>{
    if(!database.current?.ready || !confirm('¿Vaciar el chat, los borradores, las preferencias y la auditoría de esta cuenta en PostgreSQL? No se borrarán correos del buzón.'))return;
    try{await database.current.erase();location.reload();}catch(error){setStorageStatus((error as Error).message);}
  };

  const handleToggleStrictMode = () => {
    const next = !strictMode;
    setStrictMode(next);
    guardrails.setStrictMode(next);
  };

  const handleSendPrompt = async (prompt: string): Promise<{ answer: string; steps: AgentStep[] }> => {
    if(window.emailAgentHost.pageAccount && !realGmailProvider.isConnected())return {answer:'Conecta la cuenta de esta página en Ajustes antes de consultar o preparar acciones sobre sus correos.',steps:[]};
    setIsProcessing(true);
    try {
      const sessionKey=realGmailProvider.getSessionKey();
      const res = await agentEngine.processPrompt(prompt);
      if(sessionKey!==realGmailProvider.getSessionKey())throw new Error('La sesión cambió durante la consulta. Vuelve a intentarlo.');
      
      if(storageReady){
        const drafts:StoredDraft[]=res.pendingActions.filter(action=>action.actionType==='SEND_EMAIL').map(action=>({id:action.id,to:action.payload.recipient || '',cc:'',bcc:'',subject:action.payload.subject || '',body:action.payload.body || '',reply_to_id:null,attachments_omitted:false,created_at:new Date().toISOString()}));
        if(drafts.length)setSavedDrafts(existing=>[...drafts,...existing].slice(0,50));
      }
      if (res.pendingActions.length > 0) {
        setPendingActions(prev => [...res.pendingActions, ...prev]);
        setActiveTab('pending');
        setMobileView('workspace'); // Auto-switch to workspace on mobile so user sees the actions
      }

      if (res.auditLogs.length > 0) {
        setAuditLogs(prev => [...res.auditLogs, ...prev]);
      }

      await refreshEmails();

      return {
        answer: res.finalAnswer,
        steps: res.steps
      };
    } finally {
      setIsProcessing(false);
    }
  };

  const handleApproveAction = async (action: PendingAction) => {
    if(executingActions.current.has(action.id) || attemptedActions.current.has(action.id)) return;
    if(!pendingActions.some(item=>item.id===action.id)) return;
    if(action.payload.sessionKey!==realGmailProvider.getSessionKey() || action.payload.isReal!==realGmailProvider.isConnected()){alert('Esta propuesta pertenece a otra sesión o modo. Recházala y prepara una nueva.');return;}
    if(action.actionType==='SEND_EMAIL' && storageReady && savedDrafts.some(d=>d.id===(action.payload.savedDraftId || action.id))){
      executingActions.current.add(action.id);
      const remaining=savedDrafts.filter(d=>d.id!==(action.payload.savedDraftId || action.id));
      try{await database.current!.save('drafts',remaining);setSavedDrafts(remaining);}
      catch{alert('No se pudo retirar el borrador de PostgreSQL. No se inició el envío para evitar duplicados. Recarga NexoMail y revisa el estado.');return;}
      finally{executingActions.current.delete(action.id);}
    }
    const isReal = realGmailProvider.isConnected();
    executingActions.current.add(action.id);attemptedActions.current.add(action.id);
    action=structuredClone(action);
    try {
      if (action.actionType === 'BULK_CLEANUP' || action.actionType === 'DELETE_EMAIL') {
        if (isReal && action.payload.emailIds) {
          await realGmailProvider.trashEmails(action.payload.emailIds);
        } else if (action.payload.emailIds) {
          emailProvider.trashEmails(action.payload.emailIds);
        }
      } else if (action.actionType === 'LABEL_EMAIL') {
        const ids = action.payload.emailIds ?? [];
        const label = action.payload.label ?? 'Trabajo';
        if (isReal && ids.length > 0) {
          await realGmailProvider.labelEmails(ids, label);
        } else if (ids.length > 0) {
          emailProvider.labelEmails(ids, label);
        }
      } else if (action.actionType === 'SEND_EMAIL') {
        if (isReal && action.payload.recipient && action.payload.subject && action.payload.body) {
          await realGmailProvider.sendEmail(action.payload.recipient, action.payload.subject, action.payload.body);
        } else {
          emailProvider.addDraftOrSentEmail({
            sender: 'usuario@miempresa.com',
            senderName: 'Usuario Principal',
            recipient: action.payload.recipient || '',
            subject: action.payload.subject || '',
            snippet: action.payload.body?.substring(0, 100) || '',
            body: action.payload.body || '',
            read: true,
            category: 'Trabajo',
            priority: 'high',
            labels: ['Enviado']
          });
        }
      }

      setPendingActions(prev => prev.filter(a => a.id !== action.id));

      setAuditLogs(prev => [
        {
          id: `aud_app_${Date.now()}`,
          timestamp: new Date().toLocaleTimeString(),
          actionType: action.actionType,
          prompt: `Aprobación manual: ${action.title}`,
          executionStatus: 'HUMAN_APPROVED',
          details: isReal && action.actionType==='SEND_EMAIL' ? 'Gmail aceptó el mensaje. La entrega al destinatario sigue sin confirmar.' : `Acción ejecutada en ${isReal ? 'Gmail real' : 'simulación'}.`
        },
        ...prev
      ]);
    } catch (err: any) {
      alert(`No se pudo confirmar la acción: ${err.message}. Revisa Gmail antes de preparar otra propuesta. No se reintentará automáticamente.`);
      setPendingActions(prev=>prev.filter(item=>item.id!==action.id));
      setAuditLogs(prev=>[{id:crypto.randomUUID(),timestamp:new Date().toLocaleString(),actionType:action.actionType,prompt:action.title,executionStatus:'FAILED',details:'No se pudo confirmar el resultado. Sin reintento automático.'},...prev]);
    } finally {
      executingActions.current.delete(action.id);
    }

    await refreshEmails();
  };

  const handleRejectAction = (action: PendingAction) => {
    setSavedDrafts(list=>list.filter(d=>d.id!==(action.payload.savedDraftId || action.id)));
    setPendingActions(prev => prev.filter(a => a.id !== action.id));

    setAuditLogs(prev => [
      {
        id: `aud_rej_${Date.now()}`,
        timestamp: new Date().toLocaleTimeString(),
        actionType: action.actionType,
        prompt: `Rechazo manual: ${action.title}`,
        executionStatus: 'HUMAN_REJECTED',
        details: `El usuario canceló la ejecución de ${action.title}. No se realizaron cambios.`
      },
      ...prev
    ]);
  };

  const handleMarkRead = async (id: string) => {
    if (realGmailProvider.isConnected()) {
      await realGmailProvider.markAsRead(id);
    } else {
      emailProvider.markAsRead(id);
    }
    await refreshEmails();
  };

  const handleTrash = async (ids: string[]) => {
    if (realGmailProvider.isConnected()) {
      await realGmailProvider.trashEmails(ids);
    } else {
      emailProvider.trashEmails(ids);
    }
    await refreshEmails();
  };

  const unreadCount = emails.filter(e => !e.read).length;

  const navigation = [
    {id:'inbox',label:'Bandeja de entrada',icon:Mail,count:unreadCount},
    {id:'chat',label:'Chat del agente',icon:Bot,count:0},
    {id:'pending',label:'Acciones pendientes',icon:ShieldAlert,count:pendingActions.length},
    {id:'audit',label:'Auditoría',icon:History,count:0},
    {id:'summary',label:'Resumen general',icon:LayoutDashboard,count:0},
    {id:'settings',label:'Configuración',icon:Settings,count:0},
  ] as const;
  const currentView=mobileView==='chat'?'chat':activeTab;
  function navigate(view:typeof navigation[number]['id']){
    if(view==='chat')setMobileView('chat');
    else{setActiveTab(view);setMobileView('workspace');}
  }
  return (
    <div className={`app-layout outlook-layout ${isFloating?'floating-mode':''}`}>
      <Header strictMode={strictMode} onToggleStrictMode={handleToggleStrictMode}
        pendingCount={pendingActions.length} totalEmails={emails.length} unreadCount={unreadCount}
        onRefresh={refreshEmails} isGmailConnected={isGmailConnected}
        onOpenGmailAuth={()=>{if(isGmailConnected)setIsAuthModalOpen(true);else void authorizeGmail();}} onOpenSettings={()=>navigate('settings')} theme={theme} onToggleTheme={handleToggleTheme}/>
      {isAuthorizing && <div className="storage-status" role="status">Esperando autorización en Google…</div>}
      {gmailError && <div className="api-alert-banner" role="alert"><AlertTriangle size={17}/><span>{gmailError}</span><button disabled={isAuthorizing} onClick={()=>void authorizeGmail()} className="workspace-button">Reautorizar con Google</button></div>}
      <div className="storage-status" role="status"><span>{storageStatus}</span>{storageReady && <button type="button" className="workspace-button" onClick={eraseStoredData}>Vaciar datos guardados</button>}<small>El chat, los borradores y la auditoría pueden contener datos personales. Revisa el estado antes de cerrar.</small></div>
      <div className="insights-summary" role="status" aria-live="polite">
        Análisis local automático · {emails.length} correos cargados · {securityAlerts.length} con señales de riesgo
        {lastSync && <span> · Actualizado {lastSync.toLocaleTimeString([], {hour:'2-digit',minute:'2-digit'})}</span>}
        {securityAlerts.length>0 && <details><summary>Revisar avisos de seguridad</summary><ul>{securityAlerts.map(email=><li key={email.id}><strong>{email.subject}</strong> — {email.insights?.label}<ul>{email.insights?.reasons.map(reason=><li key={reason}>{reason}</li>)}</ul></li>)}</ul><p>Comprueba estas solicitudes por otro canal antes de responder o abrir enlaces.</p></details>}
      </div>
      <div className="workspace-shell">
        <aside className="workspace-sidebar" aria-label="Navegación de Gmail">
          <p className="sidebar-caption">GESTIÓN DE CORREO</p>
          <nav>{navigation.map(item=><button type="button" key={item.id} onClick={()=>navigate(item.id)} className={`workspace-nav ${currentView===item.id?'active':''}`} aria-current={currentView===item.id?'page':undefined}><item.icon size={18}/><span>{item.label}</span>{item.count>0 && <span className="workspace-count">{item.count}</span>}</button>)}</nav>
          <div className="workspace-account"><Mail size={17}/><div><strong>{isGmailConnected?'Gmail conectado':(window.emailAgentHost.pageAccount?'Conecta esta cuenta':'Modo de demostración')}</strong><span>{realGmailProvider.getConfig()?.email || 'Conecta tu cuenta de Google'}</span></div></div>
        </aside>
        <main className="workspace-content">
          <section className="workspace-chat" hidden={currentView!=='chat'}>
            <AgentChat onSendPrompt={handleSendPrompt} isProcessing={isProcessing || storageLoading} restoredMessages={restoredChat} onHistoryChange={saveChat}
              onCollapse={isFloating?()=>window.parent.postMessage({type:'EMAILAGENT_MINIMIZE',bridge:floatingBridge},location.origin):undefined}
              onClearHistory={()=>agentEngine.clearHistory()}/>
          </section>
          <section className="workspace-page" hidden={currentView!=='inbox'}>{savedDrafts.length>0 && <div className="saved-drafts"><h3>Borradores guardados en PostgreSQL</h3><p>Antes de recuperar uno, comprueba si hubo un envío anterior. Recuperarlo prepara una nueva revisión.</p>{savedDrafts.map(draft=><div key={draft.id}><strong>{draft.subject || '(Sin asunto)'}</strong><span>{draft.to}</span><button className="workspace-button" onClick={()=>reviewSavedDraft(draft)}>Revisar borrador</button></div>)}</div>}<EmailInbox automatic={autoGrouping} onAutomaticChange={setAutoGrouping} emails={emails} onMarkRead={handleMarkRead} onTrash={handleTrash} selectedCategory={selectedCategory} onSelectCategory={setSelectedCategory}/></section>
          <section className="workspace-page workspace-scroll" hidden={currentView!=='pending'}><div className="workspace-section-heading"><ShieldAlert size={21}/><h2>Acciones pendientes de aprobación</h2><span className="workspace-count">{pendingActions.length}</span></div><div className="workspace-safety-note">Revisa el contenido y los destinatarios antes de aprobar. Los envíos y la papelera requieren tu confirmación.</div><PendingActionsList pendingActions={pendingActions} onApprove={handleApproveAction} onReject={handleRejectAction}/></section>
          <section className="workspace-page workspace-scroll" hidden={currentView!=='audit'}><AuditLogView logs={auditLogs}/></section>
          {(currentView==='summary' || currentView==='settings') && <WorkspacePages view={currentView} emails={emails} pendingCount={pendingActions.length} logCount={auditLogs.length} theme={theme} strictMode={strictMode} onToggleTheme={handleToggleTheme} onToggleStrictMode={handleToggleStrictMode} onAuthorize={()=>{if(isGmailConnected)setIsAuthModalOpen(true);else void authorizeGmail();}} connected={isGmailConnected}/>}
        </main>
      </div>
      <footer className="brand-credits" aria-label="Autores del proyecto">NexoMail · Proyecto de tesis <span>Marlon Aguiño · Jonathan Pérez</span></footer>
      <GmailAuthModal isOpen={isAuthModalOpen} onClose={()=>setIsAuthModalOpen(false)} onConnectSuccess={()=>{setIsAuthModalOpen(false);setPendingActions([]);agentEngine.clearHistory();refreshEmails();}}/>
    </div>
  );
}
export default App;
