import { Component, OnInit, OnDestroy, inject, signal, computed, effect, untracked, ViewChild, ElementRef } from '@angular/core';
import {WorkspaceStorage,boundedChat} from './services/workspace-storage';
import type {AuditLogItem} from './models/outlook.model';
import { MailSafetyComponent } from './components/mail-safety.component';
import { inspectHtml } from './services/mail-insights';
import { CommonModule, DatePipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { PreferenceService } from './services/preference.service';
import { MailComposerComponent } from './components/mail-composer.component';
import { MailToolbarComponent } from './components/mail-toolbar.component';
import { ActionEditorComponent } from './components/action-editor.component';
import { PreferencesComponent } from './components/preferences.component';
import { HealthService } from './services/health.service';
import { HealthResponse } from './models/health.model';
import { OutlookService } from './services/outlook.service';
import { NavigationService } from './services/navigation.service';
import { AgentClientService } from './services/agent-client.service';
import { ActionService } from './services/action.service';
import {
  NavSection,
  NavItem,
  ChatMessageUI,
  PendingAction,
  OutlookCategory,
  OutlookMessage
} from './models/outlook.model';
import { environment } from '../environments/environment';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [MailSafetyComponent, CommonModule, DatePipe, FormsModule, MailComposerComponent, MailToolbarComponent, PreferencesComponent, ActionEditorComponent],
  templateUrl: './app.component.html',
  styleUrl: './app.component.css'
})
export class AppComponent implements OnInit, OnDestroy {
  private incomingTimer:number|undefined;
  private database:WorkspaceStorage|null=null;
  private databaseEpoch=0;
  readonly databaseReady=signal(false);
  readonly databaseLoading=signal(false);
  readonly databaseStatus=signal('PostgreSQL · Conecta tu cuenta para recuperar los datos');
  private readonly healthService = inject(HealthService);
  readonly prefs = inject(PreferenceService);
  readonly editingAction = signal<PendingAction | null>(null);
  readonly mobileDetailOpen = signal(false);
  readonly auditQuery = signal('');
  readonly auditStatus = signal('');
  @ViewChild('chatScroll') chatScroll?: ElementRef<HTMLElement>;
  readonly agentEngine = signal<string>('Reglas locales');
  readonly outlookService = inject(OutlookService);
  readonly nav = inject(NavigationService);
  readonly agentClient = inject(AgentClientService);
  readonly actionService = inject(ActionService);

  readonly isFloating=new URLSearchParams(location.search).get('floating')==='1';
  private readonly floatingBridge=new URLSearchParams(location.search).get('bridge');
  readonly projectName = 'NexoMail';
  readonly filteredAudit = computed(()=>{const query=this.auditQuery().toLowerCase().trim();const status=this.auditStatus();return this.actionService.auditLog().filter(e=>(!status || e.status===status) && (!query || `${e.description} ${this.actionName(e.action_type)} ${e.details || ''}`.toLowerCase().includes(query)));});

  // ─── Estado FastAPI ──────────────────────────────────────────────────
  readonly isBackendLoading = signal<boolean>(true);
  readonly isBackendConnected = signal<boolean>(false);
  readonly healthData = signal<HealthResponse | null>(null);
  readonly backendError = signal<string | null>(null);

  // ─── Estado del Chat del Agente ──────────────────────────────────────
  readonly chatMessages = signal<ChatMessageUI[]>([
    {
      id: 'msg-init',
      role: 'assistant',
      content:
        'Hola. Soy tu asistente de Outlook. El motor de reglas está disponible y la IA por API es opcional.\n\n' +
        'Puedo ayudarte a resumir tu bandeja, redactar respuestas profesionales, categorizar correos ' +
        'y clasificar mensajes pendientes.\n\n' +
        '🛡️ **Human-in-the-Loop:** Por tu seguridad, nunca enviaré ni eliminaré correos directamente; ' +
        'primero te presentaré la acción como **propuesta** para que la apruebes o rechaces.',
      timestamp: new Date()
    }
  ]);

  agentInput = '';
  readonly isAgentThinking = signal<boolean>(false);
  readonly suggestedPrompts = signal<string[]>([
    'Resume mis correos pendientes',
    'Clasifica los correos no leídos',
    'Redacta una respuesta al correo seleccionado',
    '¿Hay correos urgentes o importantes?'
  ]);

  // ─── Estado de Ejecución de Acciones ─────────────────────────────────
  readonly authorizingActionId = signal<string | null>(null);
  readonly executingActionId = signal<string | null>(null);
  readonly actionBanner = signal<{ type: 'success' | 'danger'; text: string } | null>(null);

  // ─── Categorías de demostración Outlook ─────────────────────────
  readonly categoriesList = signal<OutlookCategory[]>([
    { id: 'Trabajo', label: 'Trabajo', color: '#0078d4', description: 'Laboral o académico' },
    { id: 'Personal', label: 'Personal', color: '#107c41', description: 'Contactos directos' },
    { id: 'Importante', label: 'Importante', color: '#d83b01', description: 'Alta prioridad' },
    { id: 'Finanzas', label: 'Finanzas', color: '#008272', description: 'Pagos y comprobantes' },
    { id: 'Boletines', label: 'Boletines', color: '#5c2d91', description: 'Newsletters' },

  ]);

  // ─── Computed ────────────────────────────────────────────────────────
  readonly isConfiguredClientId = computed<boolean>(() =>
    !!environment.azure.clientId && !environment.azure.clientId.includes('TU_CLIENT_ID')
  );

  constructor() {
    effect(()=>{
      const key=this.outlookService.accountKey();this.outlookService.isAuthenticated();
      untracked(()=>{void this.loadDatabase(key);});
    },{allowSignalWrites:true});
    effect(()=>{
      const ready=this.databaseReady(),key=this.outlookService.accountKey();
      const chat=this.chatMessages(),drafts=this.outlookService.drafts(),audit=this.actionService.auditLog();
      const preferences={theme:this.prefs.theme(),strict_mode:this.prefs.strictMode(),llm_enabled:this.prefs.llmEnabled(),auto_grouping:this.outlookService.autoGrouping()};
      if(!ready)return;
      untracked(()=>{
        this.database?.schedule('chat',boundedChat(chat.filter(m=>!m.id.startsWith('msg-init')).map(m=>({id:m.id,role:m.role,content:m.content,created_at:m.timestamp.toISOString()}))));
        this.database?.schedule('drafts',drafts.filter(d=>d.mode==='real' && d.accountKey===key).slice(0,50).map(d=>({id:d.id,to:d.to,cc:d.cc,bcc:d.bcc,subject:d.subject,body:d.body,reply_to_id:d.replyToId || null,attachments_omitted:!!d.attachments.length || !!d.attachmentsOmitted,created_at:d.createdAt || new Date(0).toISOString()})));
        this.database?.schedule('preferences',preferences);
        this.database?.appendAudit(audit.filter(e=>e.mode==='real' && e.accountKey===key).map(e=>({id:e.id,action_type:e.action_type,status:e.status,description:e.description,details:e.details || '',occurred_at:e.timestamp.toISOString()})));
      });
    },{allowSignalWrites:true});
    effect(()=>{
      const section=this.nav.activeSection();
      if(this.isFloating && this.floatingBridge){const sections:Record<string,string>={agente:'chat',bandeja:'mail',acciones:'actions',auditoria:'history',configuracion:'settings'};window.parent.postMessage({type:'EMAILAGENT_VIEW',bridge:this.floatingBridge,section:sections[section] || 'chat'},location.origin);}
    });
    effect(() => {
      this.outlookService.accountKey();
      untracked(() => {
        this.chatMessages.set([{id:crypto.randomUUID(),role:'assistant',timestamp:new Date(),content:'Selecciona un correo para trabajar con su contexto. Las propuestas requieren revisión humana. Motor de reglas disponible; IA por API opcional.'}]);
        this.agentInput=''; this.editingAction.set(null); this.agentEngine.set('Sin consulta en esta cuenta');
      });
    },{allowSignalWrites:true});
  }

  private async loadDatabase(key:string):Promise<void>{
    const epoch=++this.databaseEpoch;
    this.database?.close();this.database=null;this.databaseReady.set(false);this.databaseLoading.set(false);
    this.actionService.auditLog.set([]);
    if(this.outlookService.operationMode()!=='real' || !this.outlookService.isAuthenticated()){this.databaseStatus.set('PostgreSQL · Conecta una cuenta real para recuperar sus datos');return;}
    this.databaseLoading.set(true);
    const store=new WorkspaceStorage('microsoft',window.emailAgentHost.config,async()=>{
      if(key!==this.outlookService.accountKey() || this.outlookService.operationMode()!=='real')throw new Error('La cuenta cambió.');
      return this.outlookService.storageAccessToken();
    },message=>{if(epoch===this.databaseEpoch)this.databaseStatus.set(message);});
    this.database=store;
    try{
      const data=await store.load();
      if(epoch!==this.databaseEpoch || key!==this.outlookService.accountKey())return;
      if(data.sections.chat.data.length)this.chatMessages.set(data.sections.chat.data.map(message=>({id:message.id,role:message.role,content:message.content,timestamp:new Date(message.created_at)})));
      this.outlookService.drafts.set(data.sections.drafts.data.map(d=>({id:d.id,accountKey:key,mode:'real',to:d.to,cc:d.cc,bcc:d.bcc,subject:d.subject,body:d.body,replyToId:d.reply_to_id || undefined,attachments:[],attachmentsOmitted:d.attachments_omitted,createdAt:d.created_at})));
      this.actionService.auditLog.set(data.audit.map(e=>({id:e.id,timestamp:new Date(e.occurred_at),action_type:e.action_type as AuditLogItem['action_type'],description:e.description,provider:'microsoft',mode:'real',status:e.status as AuditLogItem['status'],accountKey:key,details:e.details})));
      const prefs=data.sections.preferences.data;
      if(prefs){this.prefs.update(prefs.theme,prefs.strict_mode,prefs.llm_enabled);this.outlookService.autoGrouping.set(prefs.auto_grouping);}
      this.databaseReady.set(true);
    }catch{/* Detailed state is visible through databaseStatus. */}
    finally{if(epoch===this.databaseEpoch)this.databaseLoading.set(false);}
  }
  async eraseDatabase():Promise<void>{
    if(!this.database?.ready || !confirm('¿Vaciar el chat, los borradores, las preferencias y la auditoría de esta cuenta en PostgreSQL? No se borrarán correos del buzón.'))return;
    try{await this.database.erase();location.reload();}catch(error){this.databaseStatus.set((error as Error).message);}
  }

  ngOnInit(): void {
    if(this.isFloating && this.floatingBridge){
      window.parent.postMessage({type:'EMAILAGENT_APP_READY',bridge:this.floatingBridge},location.origin);
      window.addEventListener('keydown',event=>{if(event.key==='Escape' && !document.querySelector('dialog[open]'))window.parent.postMessage({type:'EMAILAGENT_MINIMIZE',bridge:this.floatingBridge},location.origin);});
    }
    this.incomingTimer=window.setInterval(()=>{
      if(document.visibilityState==='visible' && !this.executingActionId() && !this.authorizingActionId() && !this.editingAction() && !this.actionService.pendingActions().length)this.outlookService.syncIncoming();
    },60000);
    this.checkBackendHealth();
    this.loadCategoriesFromBackend();

    if (window.innerWidth < 992) {
      this.nav.sidebarOpen.set(false);
    }
  }

  // ─── FastAPI Health & Categorías ─────────────────────────────────────
  checkBackendHealth(): void {
    this.isBackendLoading.set(true);
    this.backendError.set(null);
    this.healthService.checkHealth().subscribe({
      next: (res: HealthResponse) => {
        this.isBackendLoading.set(false);
        if (res?.status === 'ok') {
          this.isBackendConnected.set(true);
          this.healthData.set(res);
        } else {
          this.isBackendConnected.set(false);
          this.backendError.set('El backend respondió con estado inesperado.');
        }
      },
      error: (err) => {
        this.isBackendLoading.set(false);
        this.isBackendConnected.set(false);
        this.backendError.set(err.message || 'No se pudo conectar con FastAPI en http://127.0.0.1:8000.');
      }
    });
  }

  ngOnDestroy():void{this.database?.close();if(this.incomingTimer!==undefined)window.clearInterval(this.incomingTimer);}

  private loadCategoriesFromBackend(): void {
    this.agentClient.getCategories().subscribe({
      next: (cats) => {
        if (cats && cats.length > 0) {
          this.categoriesList.set(cats);
        }
      },
      error: () => {
        // Mantiene categorías por defecto si backend aún no está listo
      }
    });
  }

  // ─── Modo de Operación (Real Graph vs Simulado) ──────────────────────
  toggleOperationMode(): void {
    if (this.executingActionId() || this.authorizingActionId()) { this.actionBanner.set({type:'danger',text:'Espera a que termine la acción en curso.'}); return; }
    const current = this.outlookService.operationMode();
    const next = current === 'real' ? 'simulated' : 'real';
    this.outlookService.setMode(next);
    this.actionBanner.set({
      type: 'success',
      text: `Has cambiado a ${next === 'real' ? 'Modo Real (Microsoft Graph API)' : 'Modo Simulado (Demo interactiva)'}.`
    });
    setTimeout(() => this.actionBanner.set(null), 5000);
  }

  // ─── Outlook / MSAL ──────────────────────────────────────────────────
  connectOutlook(): void {
    if(this.executingActionId() || this.authorizingActionId()) return;
    this.actionBanner.set(null);
    this.outlookService.login().subscribe({ next: () => {}, error: err => this.actionBanner.set({type:'danger',text:err.message}) });
  }

  disconnectOutlook(): void {
    if(this.executingActionId() || this.authorizingActionId()) return;
    this.outlookService.logout();
  }

  refreshEmails(): void {
    if (this.outlookService.operationMode() === 'real') {
      this.outlookService.loadUserProfileAndMessages();
    } else { this.actionBanner.set({type:'success',text:'El simulador está actualizado en memoria. Usa Simular correo para recibir uno nuevo.'}); }
  }

  selectMessage(msg: OutlookMessage): void {
    this.outlookService.loadMessageDetail(msg);
    this.mobileDetailOpen.set(true);
  }

  onSearch(q: string): void {
    this.outlookService.setSearchQuery(q);
  }

  filterByCategory(catId: string | null): void {
    this.outlookService.setCategoryFilter(catId);
  }

  // ─── Chat del Agente IA ──────────────────────────────────────────────
  sendMessage(): void {
    const text = this.agentInput.trim();
    if (!text || this.isAgentThinking() || this.databaseLoading()) return;

    const originKey = this.outlookService.accountKey();
    const originMode = this.outlookService.operationMode();
    // Agregar mensaje del usuario
    const userMsg: ChatMessageUI = {
      id: `user-${Date.now()}`,
      role: 'user',
      content: text,
      timestamp: new Date()
    };
    this.chatMessages.update(msgs => [...msgs, userMsg]);
    this.scrollToLastMessage();
    this.agentInput = '';
    this.isAgentThinking.set(true);

    // Preparar contexto de correos (sin tokens MSAL)
    const contextEmails = this.outlookService.displayedMessages().slice(0,100).map(m => ({
      id: m.id,
      subject: m.subject || '(Sin asunto)',
      sender: m.from?.emailAddress?.name
        ? `${m.from.emailAddress.name} <${m.from.emailAddress.address}>`
        : m.from?.emailAddress?.address || 'Desconocido',
      sender_address: m.replyTo?.[0]?.emailAddress.address || m.from?.emailAddress?.address || '',
      body_text: this.mailPlainText(m.body?.content || '').slice(0,20000),
      preview: (m.bodyPreview || '').slice(0,10000),
      date: m.receivedDateTime,
      isRead: m.isRead,
      categories: m.categories || []
    }));

    const history = this.chatMessages().slice(0,-1).slice(-6).map(m => ({
      role: m.role,
      content: m.content.slice(0,20000)
    }));

    const selectedId = this.outlookService.selectedMessage()?.id || null;

    this.agentClient.chat({
      message: text,
      context_emails: contextEmails,
      mode: originMode,
      use_llm: this.prefs.llmEnabled(),
      history,
      selected_email_id: selectedId
    }).subscribe({
      next: (resp) => {
        this.isAgentThinking.set(false);
        if(originKey !== this.outlookService.accountKey() || originMode !== this.outlookService.operationMode()) {
          this.actionBanner.set({type:'danger',text:'La cuenta o el modo cambió. Se descartaron las propuestas de la consulta anterior.'}); return;
        }
        this.agentEngine.set(resp.engine === 'llm' ? `${resp.llm_provider === 'gemini' ? 'Gemini' : resp.llm_provider === 'anthropic' ? 'Claude' : 'Ollama'} · ${resp.model_name || 'modelo configurado'}` : 'Reglas locales');

        // Si el agente propuso acciones, registrarlas en el ActionService
        const createdActions: PendingAction[] = [];
        if (resp.proposed_actions && resp.proposed_actions.length > 0) {
          resp.proposed_actions.forEach(proposed => {
            const action = {...proposed, mode:originMode, provider:'microsoft' as const, accountKey:originKey, accountLabel:this.outlookService.currentAccount()?.username || 'Cuenta simulada', payloadVersion:1};
            if(action.action_type === 'SEND_EMAIL') {
              if(this.outlookService.composer()) return;
              const p=action.parameters;
              this.outlookService.composer.set({id:crypto.randomUUID(),accountKey:originKey,mode:originMode,
                to:p['to'] || '',cc:p['cc'] || '',bcc:p['bcc'] || '',subject:p['subject'] || '',body:p['body'] || '',
                attachments:[],replyToId:p['replyToId']});
            } else {
              this.actionService.addProposedAction(action);
              createdActions.push({...action,status:'PENDING',createdAt:new Date()});
            }
          });
        }

        // Agregar respuesta del agente al chat
        const assistantMsg: ChatMessageUI = {
          id: `assistant-${Date.now()}`,
          role: 'assistant',
          content: resp.reply,
          timestamp: new Date(),
          proposed_actions: createdActions
        };
        this.chatMessages.update(msgs => [...msgs, assistantMsg]);
        this.scrollToLastMessage();

        if (resp.suggested_prompts && resp.suggested_prompts.length > 0) {
          this.suggestedPrompts.set(resp.suggested_prompts);
        }
      },
      error: (err) => {
        this.isAgentThinking.set(false);
        const errorMsg: ChatMessageUI = {
          id: `assistant-err-${Date.now()}`,
          role: 'assistant',
          content: `No se pudo completar la consulta: ${err.error?.detail || err.message || 'Servidor no disponible'}.`,
          timestamp: new Date()
        };
        this.chatMessages.update(msgs => [...msgs, errorMsg]);
        this.scrollToLastMessage();
      }
    });
  }

  sendSuggestedPrompt(prompt: string): void {
    const command=prompt.toLowerCase();
    if(command.includes('acciones pendientes')) {this.navigate('acciones');return;}
    if(command.includes('bandeja') && command.startsWith('ver')) {this.navigate('bandeja');return;}
    if(command === 'redactar un correo') {this.outlookService.startCompose();return;}
    this.agentInput = prompt;
    this.sendMessage();
  }

  askAgentToReply(msg: OutlookMessage): void {
    this.outlookService.selectedMessage.set(msg);
    this.nav.navigateTo('agente');
    this.agentInput = `Redacta una respuesta formal y cordial al correo de ${msg.from?.emailAddress?.name || msg.from?.emailAddress?.address} sobre "${msg.subject}".`;
    this.sendMessage();
  }

  askAgentToCategorize(msg: OutlookMessage, category: string): void {
    this.proposeChange(msg,'ADD_CATEGORY',{category});
  }
  askAgentToDelete(msg: OutlookMessage): void { this.proposeChange(msg,'DELETE_EMAIL',{}); }
  proposeChange(msg: OutlookMessage, kind: PendingAction['action_type'], parameters: Record<string,any>): void {
    this.actionService.addProposedAction({id:crypto.randomUUID(),action_type:kind,description:`${this.actionName(kind)}: ${msg.subject}`,
      provider:'microsoft',mode:this.outlookService.operationMode(),accountKey:this.outlookService.accountKey(),accountLabel:this.outlookService.operationMode()==='simulated' ? 'Cuenta simulada' : this.outlookService.currentAccount()?.username,payloadVersion:1,
      requires_approval:true,parameters:{messageId:msg.id,subject:msg.subject,...parameters}});
    this.navigate('acciones');
  }

  // ─── Aprobación / Rechazo de Acciones (Human-in-the-Loop) ───────────
  canApprove(action: PendingAction): boolean {
    return !this.executingActionId() && !this.authorizingActionId() && this.outlookService.hasActionPermission(action) && this.actionService.canApprove(action.id) &&
      action.accountKey === this.outlookService.accountKey() && action.mode === this.outlookService.operationMode();
  }
  authorizeAction(action: PendingAction): void {
    if(this.authorizingActionId() || this.executingActionId() || !this.actionService.canApprove(action.id)) return;
    this.authorizingActionId.set(action.id);
    this.actionBanner.set(null);
    this.outlookService.authorizeAction(action).subscribe({
      next: () => {
        this.authorizingActionId.set(null);
        this.actionBanner.set({type:'success',text:'Permiso autorizado. Revisa la propuesta y pulsa Aprobar y Ejecutar. Autorizar por sí solo no envía ni modifica correo.'});
      },
      error: error => {
        this.authorizingActionId.set(null);
        this.actionBanner.set({type:'danger',text:error.errorCode==='popup_window_error'
          ? 'El navegador bloqueó la ventana de Microsoft. Permite las ventanas emergentes para http://localhost:4200 y vuelve a pulsar Autorizar.'
          : error.errorCode==='user_cancelled' ? 'Autorización cancelada. No se envió ni modificó correo.' : error.message || 'No se pudo autorizar el permiso.'});
      }
    });
  }
  approveAction(proposed: PendingAction): void {
    if(!this.canApprove(proposed)) return;
    const current=this.actionService.get(proposed.id)!;
    if(this.prefs.strictMode() && !window.confirm(`Revisa la versión ${current.payloadVersion}: ${current.description}\nModo: ${current.mode}\n¿Apruebas su ejecución?`)) return;
    let action: PendingAction;
    try { action=this.actionService.begin(current.id,this.outlookService.accountKey(),this.outlookService.operationMode()); }
    catch(error) { this.actionBanner.set({type:'danger',text:(error as Error).message}); return; }
    this.executingActionId.set(action.id); this.actionBanner.set(null);
    this.outlookService.executeAction(action).subscribe({
      next: () => {
        this.executingActionId.set(null); this.actionService.markApproved(action);
        if(action.action_type==='SEND_EMAIL' && action.mode==='real' && action.accountKey===this.outlookService.accountKey()) this.outlookService.refreshDeliveryReports();
        this.actionBanner.set({type:'success',text:action.action_type==='SEND_EMAIL' && action.mode==='real'
          ? 'Aceptado por Microsoft; entrega sin confirmar. Sincroniza para buscar posibles avisos de entrega fallida.' : `Acción completada en modo ${action.mode}.`});
      },
      error: err => {
        this.executingActionId.set(null);
        if(err.code==='authorization_required') {
          this.actionService.authorizationRequired(action);
          this.actionBanner.set({type:'danger',text:err.message}); return;
        }
        const uncertain=action.mode==='real' && (err.name==='TimeoutError' || err.status===0 || err.status>=500 || err.status===408 || err.status===504);
        const message=err.error?.error?.message || err.message || 'No se pudo completar la acción.';
        this.actionService.markFailed(action,message,uncertain);
        this.actionBanner.set({type:'danger',text:uncertain ? 'Resultado incierto. Comprueba el buzón antes de crear otra propuesta; no se reintentará automáticamente.' : message});
      }
    });
  }
  editAction(proposed: PendingAction): void {
    const action=this.actionService.get(proposed.id);
    if(!action || !this.actionService.canApprove(action.id) || this.executingActionId() || this.authorizingActionId() || action.accountKey!==this.outlookService.accountKey() || action.mode!==this.outlookService.operationMode()) return;
    if(action.action_type!=='SEND_EMAIL') {this.editingAction.set(structuredClone(action));return;}
    const p=action.parameters;
    this.outlookService.composer.set({id:crypto.randomUUID(),accountKey:action.accountKey,mode:action.mode,
      to:p['to'] || '',cc:p['cc'] || '',bcc:p['bcc'] || '',subject:p['subject'] || '',body:p['body'] || '',
      attachments:structuredClone(p['attachments'] || []),replyToId:p['replyToId'],editingActionId:action.id});
  }
  exportAudit(): void {
    const url=URL.createObjectURL(new Blob([JSON.stringify(this.actionService.auditLog(),null,2)],{type:'application/json'}));
    const link=document.createElement('a');link.href=url;link.download='auditoria-sesion.json';link.click();URL.revokeObjectURL(url);
  }
  onChatEnter(event: Event): void {
    const key=event as KeyboardEvent;
    if(!key.shiftKey && !key.isComposing) {key.preventDefault();this.sendMessage();}
  }

  rejectAction(actionId: string): void {
    this.actionService.rejectAction(actionId);
    this.actionBanner.set({
      type: 'success',
      text: 'La acción ha sido rechazada por el usuario y descartada.'
    });
    setTimeout(() => this.actionBanner.set(null), 4000);
  }

  private scrollToLastMessage(): void {
    requestAnimationFrame(()=>{const el=this.chatScroll?.nativeElement;if(el)el.scrollTop=el.scrollHeight;});
  }
  formatChat(text:string):string {
    return text.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;')
      .replace(/```(?:[a-z]+)?/g,'').replace(/\*\*([^*\n]+)\*\*/g,'<strong>$1</strong>')
      .replace(/`([^`\n]+)`/g,'<code>$1</code>').replace(/\n/g,'<br>');
  }
  actionName(kind:string):string {
    return ({SEND_EMAIL:'Enviar correo',DELETE_EMAIL:'Mover a papelera',ADD_CATEGORY:'Asignar categoría',MARK_AS_READ:'Marcar leído',MARK_AS_UNREAD:'Marcar no leído',MOVE_EMAIL:'Mover correo',SET_FLAG:'Cambiar destacado'} as Record<string,string>)[kind] || 'Acción de correo';
  }
  statusName(status:string|undefined):string {
    return ({PENDING:'Pendiente de revisión',EXECUTING:'Inicio de ejecución',ACCEPTED:'Aceptado; entrega sin confirmar',APPROVED:'Acción completada',REJECTED:'Rechazada',FAILED:'Fallida',UNCERTAIN:'Resultado incierto',EDITED:'Propuesta editada'} as Record<string,string>)[status || ''] || 'Procesada';
  }
  messageCorrespondent(message:OutlookMessage):string {
    return this.outlookService.activeFolder()==='sentitems'
      ? 'Para: '+(message.toRecipients?.map(r=>r.emailAddress.name || r.emailAddress.address).join(', ') || 'Destinatario')
      : message.from?.emailAddress?.name || message.from?.emailAddress?.address || 'Remitente desconocido';
  }

  // ─── Utilidades de Plantilla ────────────────────────────────────────
  isDesktop(): boolean {
    return typeof window !== 'undefined' ? window.innerWidth >= 992 : true;
  }

  mailPlainText(html:string):string{return inspectHtml(html).text;}
  downloadAttachment(file: import('./models/outlook.model').MailAttachment): void {
    if(!file.contentBytes) {this.actionBanner.set({type:'danger',text:'Este tipo de adjunto no tiene descarga disponible en esta versión.'});return;}
    try {
      const bytes=Uint8Array.from(atob(file.contentBytes),c=>c.charCodeAt(0));
      const url=URL.createObjectURL(new Blob([bytes],{type:'application/octet-stream'}));
      const link=document.createElement('a');link.href=url;link.download=file.name;link.click();URL.revokeObjectURL(url);
    } catch {this.actionBanner.set({type:'danger',text:'No se pudo preparar el adjunto.'});}
  }

  getSectionMeta(section: NavSection): NavItem {
    return (
      this.nav.navItems.find(n => n.id === section) || {
        id: section,
        label: section,
        icon: 'bi-folder',
        real: true
      }
    );
  }

  getCategoryColor(categoryName: string): string {
    const found = this.categoriesList().find(c => c.id.toLowerCase() === categoryName.toLowerCase());
    return found ? found.color : '#0078d4';
  }

  getCategoryTagClass(categoryName: string): string {
    const norm = (categoryName || '').toLowerCase().trim();
    switch (norm) {
      case 'trabajo': return 'cat-tag-trabajo';
      case 'personal': return 'cat-tag-personal';
      case 'importante': return 'cat-tag-importante';
      case 'finanzas': return 'cat-tag-finanzas';
      case 'boletines': return 'cat-tag-boletines';
      case 'archivado': return 'cat-tag-archivado';
      default: return 'cat-tag-default';
    }
  }

  simulateNewEmail(): void {
    if(this.outlookService.operationMode()!=='simulated') return;
    const newMsg = this.outlookService.simulateIncomingEmail();
    this.actionBanner.set({
      type: 'success',
      text: `📥 Correo de prueba simulado recibido: "${newMsg.subject}" de ${newMsg.from?.emailAddress?.name}.`
    });
    setTimeout(() => this.actionBanner.set(null), 5000);
  }

  resetDemoData(): void {
    if(this.executingActionId() || !window.confirm('¿Restablecer la bandeja simulada? Las propuestas anteriores quedarán bloqueadas por pertenecer a otra sesión de datos.')) return;
    this.outlookService.resetSimulatedMessages();
    this.actionBanner.set({
      type: 'success',
      text: '🔄 Bandeja del simulador restablecida con los correos de demostración iniciales.'
    });
    setTimeout(() => this.actionBanner.set(null), 4000);
  }

  navigate(section: NavSection): void {
    this.nav.navigateTo(section);
    this.nav.closeSidebarOnMobile();
    if(section==='agente')this.scrollToLastMessage();
  }
}
