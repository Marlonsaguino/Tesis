import {analyzeMail,inspectHtml,MailInsights} from './mail-insights';
import {ExtensionMsalService} from '../core/extension-msal.service';
import { Injectable, inject, signal, computed } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { MsalService, MsalBroadcastService } from '@azure/msal-angular';
import {
  AuthenticationResult,
  InteractionRequiredAuthError,
  AccountInfo,
  EventMessage,
  EventType,
  InteractionStatus
} from '@azure/msal-browser';
import { Observable, from, throwError, of, defer } from 'rxjs';
import { switchMap, catchError, map, tap, finalize, timeout } from 'rxjs/operators';
import { ActionService } from './action.service';
import { MailDraft, MailFolder, MailAttachment, EmailSender } from '../models/outlook.model';
import { environment } from '../../environments/environment';
import {
  OutlookMessage,
  GraphMessagesResponse,
  GraphUserProfile,
  PendingAction,
  ExecutionMode
} from '../models/outlook.model';

// Correos de demostración para el Modo Simulado
const INITIAL_SIMULATED_MESSAGES: OutlookMessage[] = [
  {
    id: 'sim-1',
    subject: 'Revisión final de proyecto: Agente IA Outlook',
    bodyPreview: 'Estimado estudiante, hemos verificado el avance de la interfaz y la integración con Microsoft Graph. Favor confirmar fecha de sustentación.',
    body: {
      contentType: 'html',
      content: '<p>Estimado estudiante,</p><p>Hemos verificado el avance de la interfaz y la integración con <strong>Microsoft Graph API</strong>. Los requerimientos de arquitectura están conformes.</p><p>Favor confirmar fecha para la sustentación final ante el jurado evaluador.</p><p>Atentamente,<br><strong>Dr. Alejandro Morales</strong><br>Coordinador Académico</p>'
    },
    isRead: false,
    receivedDateTime: new Date(Date.now() - 1000 * 60 * 35).toISOString(),
    from: {
      emailAddress: {
        name: 'Dr. Alejandro Morales',
        address: 'amorales@universidad.edu'
      }
    },
    categories: ['Trabajo', 'Importante']
  },
  {
    id: 'sim-2',
    subject: 'Recordatorio de matrícula extemporánea ciclo 2026-I',
    bodyPreview: 'Les recordamos que el plazo final para ajustes de matrícula y convalidaciones vence este viernes a las 18:00 hrs.',
    body: {
      contentType: 'text',
      content: 'Estimada comunidad académica,\n\nLes recordamos que el plazo final para ajustes de matrícula y convalidaciones vence este viernes a las 18:00 hrs.\n\nPor favor ingresar al portal universitario para regularizar su situación.\n\nSaludos,\nSecretaría General'
    },
    isRead: false,
    receivedDateTime: new Date(Date.now() - 1000 * 60 * 180).toISOString(),
    from: {
      emailAddress: {
        name: 'Secretaría Académica',
        address: 'secretaria@universidad.edu'
      }
    },
    categories: ['Importante']
  },
  {
    id: 'sim-3',
    subject: 'Comprobante de pago mensualidad #0492',
    bodyPreview: 'Su pago de derechos académicos ha sido procesado con éxito. Adjuntamos la boleta electrónica correspondiente.',
    body: {
      contentType: 'html',
      content: '<p>Estimado/a usuario,</p><p>Su pago de derechos académicos ha sido procesado con éxito en la plataforma de tesorería.</p><ul><li>N° Operación: <strong>#0492-2026</strong></li><li>Estado: <strong>Cancelado</strong></li></ul><p>Conserve este mensaje como comprobante oficial.</p>'
    },
    isRead: true,
    receivedDateTime: new Date(Date.now() - 1000 * 60 * 60 * 24).toISOString(),
    from: {
      emailAddress: {
        name: 'Tesorería Universitaria',
        address: 'finanzas@universidad.edu'
      }
    },
    categories: ['Finanzas']
  },
  {
    id: 'sim-4',
    subject: '¿Nos reunimos para el trabajo final el sábado?',
    bodyPreview: 'Hola, quería ver si nos conectamos por Teams el sábado en la mañana para repasar la presentación y dejar todo listo.',
    body: {
      contentType: 'text',
      content: 'Hola compañero,\n\n¿Cómo vas? Quería coordinar si nos conectamos por Teams este sábado a las 10:00 a.m. para afinar las diapositivas y hacer un simulacro antes de la entrega.\n\n¡Me avisas si te acomoda!\n\nSaludos,\nLaura'
    },
    isRead: true,
    receivedDateTime: new Date(Date.now() - 1000 * 60 * 60 * 30).toISOString(),
    from: {
      emailAddress: {
        name: 'Laura Méndez',
        address: 'lmendez@estudiantes.edu'
      }
    },
    categories: ['Personal', 'Trabajo']
  },
  {
    id: 'sim-5',
    subject: 'Microsoft Security Alert: Inicio de sesión verificado',
    bodyPreview: 'Se ha detectado un inicio de sesión exitoso en su cuenta desde la aplicación Agente IA Outlook en localhost.',
    body: {
      contentType: 'html',
      content: '<p><strong>Alerta de Seguridad de Microsoft</strong></p><p>Se ha detectado un inicio de sesión exitoso mediante OAuth 2.0 PKCE en su cuenta personal de Outlook desde la aplicación registrada <code>Agente IA Outlook</code>.</p><p>Si fue usted, no es necesario realizar ninguna acción.</p>'
    },
    isRead: true,
    receivedDateTime: new Date(Date.now() - 1000 * 60 * 60 * 48).toISOString(),
    from: {
      emailAddress: {
        name: 'Microsoft Account Security',
        address: 'account-security-noreply@accountprotection.microsoft.com'
      }
    },
    categories: ['Importante']
  },
  {
    id: 'sim-6',
    subject: 'GitHub: Novedades sobre IA y Agentes Autónomos',
    bodyPreview: 'Explora las últimas tendencias en modelos de lenguaje, flujos Human-in-the-Loop y desarrollo con TypeScript.',
    body: {
      contentType: 'text',
      content: 'Hola developer,\n\nAquí tienes el resumen semanal de proyectos de IA:\n- Human-in-the-Loop patterns para agentes de correo\n- Integraciones de Microsoft Graph v1.0 con Angular 18\n- Optimización de flujos con FastAPI\n\n¡Que tengas una gran semana de código!'
    },
    isRead: true,
    receivedDateTime: new Date(Date.now() - 1000 * 60 * 60 * 72).toISOString(),
    from: {
      emailAddress: {
        name: 'GitHub Community',
        address: 'notifications@github.com'
      }
    },
    categories: ['Boletines']
  }
];

function freshSimulatedMessages(): OutlookMessage[] {
  return structuredClone(INITIAL_SIMULATED_MESSAGES).map(m => ({...m, folderKey:'inbox',
    toRecipients:[{emailAddress:{name:'Usuario simulado',address:'usuario@outlook.com'}}],
    ...(m.id==='sim-3' ? {hasAttachments:true,attachments:[{id:'demo-receipt',name:'comprobante-demo.txt',contentType:'text/plain',size:66,contentBytes:'Q29tcHJvYmFudGUgZmljdGljaW8gcGFyYSBlbCBzaW11bGFkb3IuIE5vIGFjcmVkaXRhIHVuIHBhZ28gcmVhbC4K'}]} : {})}));
}

@Injectable({ providedIn: 'root' })
export class OutlookService {
  private readonly msalService = inject(MsalService);
  private readonly http = inject(HttpClient);
  private readonly actions = inject(ActionService);
  readonly operationMode = signal<ExecutionMode>('simulated');
  readonly isInitialized = signal(false);
  readonly isAuthenticated = signal(false);
  readonly currentAccount = signal<AccountInfo | null>(null);
  readonly userProfile = signal<GraphUserProfile | null>(null);
  readonly realMessages = signal<OutlookMessage[]>([]);
  readonly simulatedMessages = signal<OutlookMessage[]>(freshSimulatedMessages());
  readonly selectedMessage = signal<OutlookMessage | null>(this.simulatedMessages()[0] || null);
  readonly isLoading = signal(false);
  readonly isLoadingDetail = signal(false);
  readonly errorMessage = signal<string | null>(null);
  readonly actionError = signal<string | null>(null);
  readonly searchQuery = signal('');
  readonly activeCategory = signal<string | null>(null);
  readonly activeFolder = signal('inbox');
  private deliveryScanVersion = 0;
  private readonly deliveryState = signal<{key:string;reports:{id:string;subject:string;received:string;text:string}[];checking:boolean;checkedAt:Date|null;error:string}>({key:'',reports:[],checking:false,checkedAt:null,error:''});
  readonly deliveryReports = computed(() => this.operationMode()==='real' && this.deliveryState().key===this.accountKey() ? this.deliveryState().reports : []);
  readonly deliveryChecking = computed(() => this.operationMode()==='real' && this.deliveryState().key===this.accountKey() && this.deliveryState().checking);
  readonly deliveryCheckedAt = computed(() => this.operationMode()==='real' && this.deliveryState().key===this.accountKey() ? this.deliveryState().checkedAt : null);
  readonly deliveryCheckError = computed(() => this.operationMode()==='real' && this.deliveryState().key===this.accountKey() ? this.deliveryState().error : '');

  refreshDeliveryReports(): void {
    if(this.operationMode()!=='real' || !this.isAuthenticated()) return;
    const key=this.accountKey(), version=++this.deliveryScanVersion;
    const previous=this.deliveryState();
    this.deliveryState.set({key,reports:previous.key===key?previous.reports:[],checking:true,checkedAt:previous.key===key?previous.checkedAt:null,error:''});
    const since=new Date(Date.now()-14*24*60*60*1000).toISOString();
    const path='/me/mailFolders/inbox/messages?$top=50&$orderby=receivedDateTime desc&$filter=receivedDateTime ge '+since+'&$select=id,subject,from,receivedDateTime,bodyPreview,body';
    this.graph<GraphMessagesResponse>('GET',path).subscribe({next:res=>{
      if(version!==this.deliveryScanVersion || key!==this.accountKey() || this.operationMode()!=='real') return;
      const reports=(res.value || []).filter(message=>this.isDeliveryFailureNotice(message)).map(message=>({id:message.id,subject:message.subject || 'Aviso de entrega fallida',received:message.receivedDateTime,text:this.deliveryNoticeText(message).slice(0,5000)}));
      this.deliveryState.set({key,reports,checking:false,checkedAt:new Date(),error:''});
    },error:()=>{
      if(version!==this.deliveryScanVersion || key!==this.accountKey() || this.operationMode()!=='real') return;
      this.deliveryState.update(state=>({...state,checking:false,error:'No se pudieron revisar los avisos de entrega. Vuelve a sincronizar o consulta Entrada en Outlook.'}));
    }});
  }
  private deliveryNoticeText(message:OutlookMessage):string {
    return message.body?.contentType==='html'?inspectHtml(message.body.content).text:message.body?.content || message.bodyPreview || '';
  }
  private isDeliveryFailureNotice(message:OutlookMessage):boolean {
    const sender=message.from?.emailAddress.address || '';
    const systemSender=/^(?:postmaster|mailer-daemon|microsoftexchange[0-9a-f]+)@/i.test(sender);
    if(!systemSender) return false;
    const text=message.subject+'\n'+this.deliveryNoticeText(message).slice(0,16000);
    return /delivery (?:has )?failed|undeliverable|delivery status notification\s*\(failure\)|failure notice|no se (?:pudo|ha podido) (?:entregar|realizar la entrega)|no se entreg[oó]|mensaje no entregado|error de entrega|recipient address rejected|\b5\.\d{1,3}\.\d{1,3}\b/i.test(text);
  }

  readonly nextLink = signal<string | null>(null);
  readonly folders = signal<MailFolder[]>([]);
  readonly drafts = signal<MailDraft[]>([]);
  readonly composer = signal<MailDraft | null>(null);
  private readonly simGeneration = signal(crypto.randomUUID());
  readonly accountKey = computed(() => this.operationMode() === 'simulated' ? `simulated:${this.simGeneration()}` : this.currentAccount()?.homeAccountId || '');
  private readonly attempted = new Set<string>();
  readonly authorizedScopes = signal<Record<string, boolean>>({});
  private loadVersion = 0;
  readonly unreadCount = computed(() => this.currentMessages().filter(m => !m.isRead).length);
  private readonly currentMessages = computed(() => this.operationMode() === 'real' ? this.realMessages() : this.simulatedMessages());
  readonly folderMessages = computed(() => {
    let list = this.currentMessages();
    const folder = this.activeFolder();
    if(folder === 'localdrafts') return [];
    if (this.operationMode() === 'simulated') list = list.filter(m => folder === 'flagged'
      ? m.flag?.flagStatus === 'flagged' && m.folderKey !== 'deleteditems' : (m.folderKey || 'inbox') === folder);
    return list;
  });
  readonly autoGrouping=signal(true);
  readonly lastIncomingSync=signal<Date|null>(null);
  readonly incomingSyncError=signal('');
  readonly mailInsights=computed(()=>new Map(this.folderMessages().map(message=>[message.id,this.analyzeMessage(message)])));
  readonly securityAlerts=computed(()=>this.folderMessages().filter(message=>this.insightsFor(message).level!=='none'));
  private analyzeMessage(message:OutlookMessage):MailInsights {
    return analyzeMail({subject:message.subject || '',sender:message.from?.emailAddress.address || '',
      senderName:message.from?.emailAddress.name,text:message.body?.contentType==='text'?message.body.content:message.bodyPreview || '',
      html:message.body?.contentType==='html'?message.body.content:undefined,labels:message.categories || [],
      filenames:message.attachments?.map(file=>file.name),hasAttachments:message.hasAttachments,
      replyTo:message.replyTo?.[0]?.emailAddress.address,partial:!message.body?.content});
  }
  insightsFor(message:OutlookMessage):MailInsights{return this.mailInsights().get(message.id) || this.analyzeMessage(message);}
  categoriesFor(message:OutlookMessage):string[]{return [...new Set([...(message.categories || []),...(this.autoGrouping()?this.insightsFor(message).categories:[])])];}
  readonly selectedInsights=computed(()=>{const message=this.selectedMessage();return message?this.analyzeMessage(message):null;});
  private incomingBusy=false;
  /** Read-only polling. Scoped to the active account and inbox; does not reset the reader. */
  syncIncoming():void {
    if(this.incomingBusy || !this.isAuthenticated() || this.operationMode()!=='real' || this.activeFolder()!=='inbox' || this.isLoading() || this.isLoadingDetail() || this.composer())return;
    const key=this.accountKey(),version=this.loadVersion;
    this.incomingBusy=true;
    const path='/me/mailFolders/inbox/messages?$top=25&$orderby=receivedDateTime desc&$select=id,subject,from,receivedDateTime,isRead,bodyPreview,body,categories,parentFolderId,flag,isDraft,hasAttachments,toRecipients,replyTo';
    this.graph<GraphMessagesResponse>('GET',path).pipe(finalize(()=>this.incomingBusy=false)).subscribe({next:res=>{
      if(key!==this.accountKey() || version!==this.loadVersion || this.activeFolder()!=='inbox' || this.operationMode()!=='real' || this.actions.pendingActions().length || this.composer() || this.isLoadingDetail())return;
      const fresh=res.value || [],ids=new Set(fresh.map(m=>m.id));
      const oldest=fresh.length?Math.min(...fresh.map(m=>Date.parse(m.receivedDateTime))):Infinity;
      const older=fresh.length>=25?this.realMessages().filter(m=>!ids.has(m.id) && Date.parse(m.receivedDateTime)<oldest):[];
      this.realMessages.set([...fresh,...older]);this.lastIncomingSync.set(new Date());this.incomingSyncError.set('');
    },error:()=>{
      if(key===this.accountKey() && version===this.loadVersion)this.incomingSyncError.set('No se pudo actualizar Entrada. Los avisos corresponden a los mensajes ya cargados; pulsa Sincronizar.');
    }});
  }
  readonly folderUnreadCount = computed(()=>this.folderMessages().filter(m=>!m.isRead).length);
  readonly displayedMessages = computed(() => {
    let list=this.folderMessages();
    const q = this.searchQuery().toLowerCase().trim();
    const cat = this.activeCategory();
    if (cat === 'unread') list = list.filter(m => !m.isRead);
    else if(cat==='risk')list=list.filter(m=>this.insightsFor(m).level!=='none');
    else if(cat==='unclassified')list=list.filter(m=>!this.categoriesFor(m).length);
    else if (cat) list = list.filter(m => this.categoriesFor(m).includes(cat));
    if (q) list = list.filter(m => `${m.subject} ${m.from?.emailAddress?.name || ''} ${m.from?.emailAddress?.address || ''} ${m.bodyPreview || ''}`.toLowerCase().includes(q));
    return list;
  });
  readonly visibleDrafts = computed(() => this.drafts().filter(d => d.accountKey === this.accountKey() && d.mode === this.operationMode()));
  constructor() { void this.initializeMsal(); }
  private async initializeMsal(): Promise<void> {
    try {
      await this.msalService.instance.initialize();
      const page=window.emailAgentHost.pageAccount;
      const accounts=this.msalService.instance.getAllAccounts();
      let account=page?.email?accounts.find(value=>value.username.toLowerCase()===page.email.toLowerCase()):!page?(this.msalService.instance.getActiveAccount() || (accounts.length===1?accounts[0]:undefined)):undefined;
      if(page?.email && !(await window.emailAgentHost.microsoftAutoAllowed(page.email)))account=undefined;
      else if(!account && page?.email){try{const result=await (this.msalService as unknown as ExtensionMsalService).restoreAccount(page.email);account=result?.account || undefined;}catch{}}
      this.isInitialized.set(true);
      if (account) { this.msalService.instance.setActiveAccount(account); this.currentAccount.set(account); this.isAuthenticated.set(true);this.setMode('real'); }
      else if(page){this.setMode('real');this.errorMessage.set(page.email?'Conecta esta cuenta para autorizar NexoMail: '+page.email:'No se pudo identificar tu cuenta automáticamente. Abre el menú de tu cuenta del correo o pulsa Conectar Outlook.');}
    } catch { this.isInitialized.set(true);if(window.emailAgentHost.pageAccount)this.setMode('real');this.errorMessage.set('Microsoft necesita que conectes tu cuenta para continuar.'); }
  }
  login(): Observable<AuthenticationResult> {
    this.errorMessage.set(null);
    if(this.isLoading()) return throwError(() => new Error('Hay una operación de Microsoft en curso. Espera a que termine.'));
    if (!this.isInitialized()) return throwError(() => new Error('Espera a que Microsoft termine de inicializarse.'));
    if (!environment.azure.clientId || environment.azure.clientId.includes('TU_CLIENT_ID')) return throwError(() => new Error('Configura el identificador público de tu aplicación Microsoft.'));
    this.isLoading.set(true);
    return this.msalService.loginPopup({ scopes: environment.azure.scopes, prompt: 'select_account' }).pipe(
      tap(result => {
        this.msalService.instance.setActiveAccount(result.account); this.currentAccount.set(result.account); this.userProfile.set(null); this.folders.set([]);
        this.isAuthenticated.set(true); this.isLoading.set(false); this.setMode('real');
      }), catchError(error => {
        const message=error.errorCode==='user_cancelled'
          ? 'Microsoft no terminó la autorización. Si la ventana mostró redirect_uri, registra la dirección de Ajustes → Conexión de Microsoft como SPA en Microsoft Entra.'
          : error.errorCode==='popup_window_error'
          ? 'No se pudo abrir Microsoft. Revisa Ajustes → Conexión de Microsoft.'
          : error.message?.includes('autorización de Microsoft en curso')?error.message:'Microsoft no completó el acceso. Si mostró redirect_uri, registra la dirección de Ajustes → Conexión de Microsoft como SPA en Microsoft Entra.';
        this.errorMessage.set(message);return throwError(() => new Error(message));
      }),
      finalize(() => this.isLoading.set(false)));
  }
  logout(): void {
    this.composer.set(null); this.loadVersion++;
    this.msalService.logoutPopup({ account: this.currentAccount() || undefined }).pipe(finalize(() => {
      this.currentAccount.set(null); this.userProfile.set(null); this.isAuthenticated.set(false);
      this.realMessages.set([]); this.selectedMessage.set(null); this.nextLink.set(null); this.folders.set([]);
      this.errorMessage.set(null); this.isLoading.set(false);
    })).subscribe({error: () => this.errorMessage.set('La sesión local se cerró. Comprueba el cierre de sesión en Microsoft.')});
  }
  setMode(mode: ExecutionMode): void {
    this.loadVersion++; this.operationMode.set(mode); this.composer.set(null); this.selectedMessage.set(null);
    this.activeFolder.set('inbox'); this.searchQuery.set(''); this.activeCategory.set(null);
    this.nextLink.set(null); this.errorMessage.set(null); this.isLoadingDetail.set(false); this.isLoading.set(false);
    if (mode === 'real' && this.isAuthenticated()) { this.loadFolders(); this.loadUserProfileAndMessages(); }
    else if (mode === 'simulated') this.selectedMessage.set(this.displayedMessages()[0] || null);
  }
  private getAccessToken(scopes = environment.azure.scopes): Observable<string> {
    const account = this.currentAccount();
    if (!account || !this.isAuthenticated()) return throwError(() => new Error('Conecta tu cuenta de Outlook.'));
    return from(window.emailAgentHost.validatePageAccount(account.username)).pipe(
      switchMap(()=>from(this.msalService.instance.acquireTokenSilent({scopes, account}))),
      catchError(error => {
        if (error instanceof InteractionRequiredAuthError) {
          return throwError(() => Object.assign(new Error('Microsoft requiere autorización. Pulsa el botón Autorizar de la propuesta y vuelve a aprobarla.'), {code:'authorization_required'}));
        }
        return throwError(() => error);
      }),
      map(result => {
        if (result.account?.homeAccountId !== account.homeAccountId || this.currentAccount()?.homeAccountId !== account.homeAccountId || this.operationMode() !== 'real') throw new Error('La cuenta o el modo cambió durante la operación.');
        return result.accessToken;
      }));
  }
  private permissionKey(action: PendingAction): string {
    return `${action.accountKey}:${action.action_type === 'SEND_EMAIL' ? 'send' : 'write'}`;
  }
  hasActionPermission(action: PendingAction): boolean {
    return action.mode === 'simulated' || !!this.authorizedScopes()[this.permissionKey(action)];
  }
  clearActionPermission(action: PendingAction): void {
    this.authorizedScopes.update(scopes => ({...scopes,[this.permissionKey(action)]:false}));
  }
  authorizeAction(action: PendingAction): Observable<AuthenticationResult> {
    const account=this.currentAccount();
    if (!account || action.accountKey!==this.accountKey() || action.mode!=='real' || this.operationMode()!=='real') {
      return throwError(() => new Error('Selecciona la cuenta y el modo de origen de la propuesta.'));
    }
    const scopes=action.action_type==='SEND_EMAIL' ? environment.azure.actionScopes.send : environment.azure.actionScopes.write;
    // Se invoca directamente desde el clic. No esperar a acquireTokenSilent antes de abrir la ventana.
    return from(this.msalService.instance.acquireTokenPopup({account,scopes})).pipe(tap(result => {
      if(result.account?.homeAccountId!==account.homeAccountId || this.accountKey()!==action.accountKey || this.operationMode()!=='real') {
        throw new Error('La cuenta o el modo cambió durante la autorización.');
      }
      this.authorizedScopes.update(current=>({...current,[this.permissionKey(action)]:true}));
    }));
  }
  private graph<T>(method: string, path: string, body?: unknown, write = false, send = false): Observable<T> {
    const url = path.startsWith('https://') ? path : `${environment.graph.baseUrl}${path}`;
    const parsed = new URL(url);
    const base = new URL(environment.graph.baseUrl);
    if (parsed.origin !== base.origin || !parsed.pathname.startsWith(base.pathname + '/')) return throwError(() => new Error('Dirección Graph inválida.'));
    return this.getAccessToken(send ? environment.azure.actionScopes.send : write ? environment.azure.actionScopes.write : environment.azure.scopes).pipe(
      switchMap(token => this.http.request<T>(method, url, { body, headers: new HttpHeaders({Authorization: `Bearer ${token}`}) }).pipe(timeout(45000))));
  }
  private folderPath(): string {
    const folder = this.activeFolder();
    return folder === 'flagged' ? '/me/messages' : `/me/mailFolders/${encodeURIComponent(folder)}/messages`;
  }
  loadUserProfileAndMessages(): void {
    if (!this.isAuthenticated() || this.operationMode() !== 'real' || this.activeFolder()==='localdrafts') return;
    this.refreshDeliveryReports();
    const key = this.accountKey(), version = ++this.loadVersion;
    this.isLoading.set(true); this.errorMessage.set(null); this.selectedMessage.set(null); this.realMessages.set([]); this.nextLink.set(null);
    const filter = this.activeFolder() === 'flagged' ? "&$filter=flag/flagStatus eq 'flagged'" : '';
    const url = `${this.folderPath()}?$top=25&$select=id,subject,from,receivedDateTime,isRead,bodyPreview,body,categories,parentFolderId,flag,isDraft,hasAttachments,toRecipients,replyTo${filter}`;
    this.graph<GraphUserProfile>('GET','/me').pipe(switchMap(profile => {
      if (version === this.loadVersion && key === this.accountKey()) this.userProfile.set(profile);
      return this.graph<GraphMessagesResponse>('GET',url);
    })).subscribe({next: res => {
      if (version !== this.loadVersion || key !== this.accountKey()) return;
      this.realMessages.set(res.value || []); this.selectedMessage.set(null);
      this.nextLink.set(res['@odata.nextLink'] || null); this.isLoading.set(false);
    }, error: err => { if (version === this.loadVersion) { this.isLoading.set(false); this.errorMessage.set(err.error?.error?.message || err.message || 'No se pudieron cargar los correos.'); } }});
  }
  loadMore(): void {
    const link = this.nextLink(); if (!link || this.isLoading()) return;
    const version = this.loadVersion, key = this.accountKey(); this.isLoading.set(true);
    this.graph<GraphMessagesResponse>('GET',link).subscribe({next: res => {
      if (version !== this.loadVersion || key !== this.accountKey()) return;
      this.realMessages.update(list => [...new Map([...list, ...res.value].map(m => [m.id,m])).values()]);
      this.nextLink.set(res['@odata.nextLink'] || null); this.isLoading.set(false);
    }, error: err => { if (version === this.loadVersion) { this.isLoading.set(false); this.errorMessage.set(err.message); } }});
  }
  loadFolders(): void {
    const key = this.accountKey();
    this.graph<{value: MailFolder[]}>('GET','/me/mailFolders?$top=100').subscribe({next: res => { if (key === this.accountKey()) this.folders.set(res.value); }, error: () => this.folders.set([])});
  }
  selectFolder(folder: string): void {
    this.activeFolder.set(folder); this.activeCategory.set(null); this.selectedMessage.set(null); this.isLoadingDetail.set(false);
    if(folder === 'localdrafts') {this.loadVersion++;this.realMessages.set([]);this.nextLink.set(null);this.isLoading.set(false);return;}
    if (this.operationMode() === 'real') this.loadUserProfileAndMessages();
    else this.selectedMessage.set(this.displayedMessages()[0] || null);
  }
  loadMessageDetail(message: OutlookMessage): void {
    this.selectedMessage.set(message); this.errorMessage.set(null); this.isLoadingDetail.set(false);
    if (this.operationMode() === 'simulated') return;
    const key = this.accountKey(); this.isLoadingDetail.set(true);
    this.graph<OutlookMessage>('GET',`/me/messages/${encodeURIComponent(message.id)}?$expand=attachments`).subscribe({next: msg => {
      if (this.accountKey() === key && this.selectedMessage()?.id === msg.id) { this.selectedMessage.set(msg); this.realMessages.update(list=>list.map(m=>m.id===msg.id ? msg : m)); this.isLoadingDetail.set(false); }
    }, error: err => { if (this.accountKey() === key && this.selectedMessage()?.id === message.id) { this.isLoadingDetail.set(false); this.errorMessage.set('No se pudo cargar el detalle: ' + err.message); } }});
  }
  startCompose(message?: OutlookMessage): void {
    if (this.operationMode() === 'real' && !this.isAuthenticated()) { this.errorMessage.set('Conecta Outlook antes de redactar en modo real.'); return; }
    this.composer.set({id: crypto.randomUUID(), accountKey: this.accountKey(), mode: this.operationMode(),
      to: message?.replyTo?.[0]?.emailAddress.address || message?.from?.emailAddress.address || '', cc:'', bcc:'',
      subject: message ? (/^re:/i.test(message.subject) ? message.subject : `Re: ${message.subject}`) : '', body:'',
      attachments:[], replyToId:message?.id});
  }
  saveDraft(draft: MailDraft): void {
    this.drafts.update(list => [structuredClone(draft), ...list.filter(d => d.id !== draft.id)]);
    this.composer.set(null);
  }
  openDraft(draft: MailDraft): void { this.composer.set(structuredClone(draft)); }
  discardDraft(id: string): void { this.drafts.update(list => list.filter(d => d.id !== id)); }
  simulateIncomingEmail(): OutlookMessage {
    const msg: OutlookMessage = {...structuredClone(INITIAL_SIMULATED_MESSAGES[Math.floor(Math.random()*INITIAL_SIMULATED_MESSAGES.length)]),
      id:crypto.randomUUID(), receivedDateTime:new Date().toISOString(), isRead:false, folderKey:'inbox'};
    this.simulatedMessages.update(list => [msg,...list]); return msg;
  }
  resetSimulatedMessages(): void {
    if (this.operationMode() !== 'simulated') return;
    this.simGeneration.set(crypto.randomUUID()); this.composer.set(null);
    this.simulatedMessages.set(freshSimulatedMessages());
    this.selectFolder('inbox'); this.searchQuery.set('');
  }
  setSearchQuery(q: string): void { this.searchQuery.set(q); }
  clearSearch(): void { this.searchQuery.set(''); }
  setCategoryFilter(cat: string | null): void { this.activeCategory.set(cat); }
  private recipients(raw: string): EmailSender[] {
    if (!raw?.trim()) return [];
    return raw.split(/[;,]/).map(address => {
      address = address.trim();
      if (!/^[^\s<>@]+@[^\s<>@]+\.[^\s<>@]+$/.test(address)) throw new Error('Dirección de correo inválida: ' + address);
      return {emailAddress:{name:'',address}};
    });
  }
  private updateLocal(id: string, update: Partial<OutlookMessage>): void {
    const store = this.operationMode() === 'real' ? this.realMessages : this.simulatedMessages;
    store.update(list => list.map(m => m.id === id ? {...m,...update} : m));
    if (this.selectedMessage()?.id === id) this.selectedMessage.update(m => m ? {...m,...update} : null);
  }
  executeAction(action: PendingAction): Observable<unknown> {
    return defer(() => {
      const canonical = this.actions.get(action.id);
      if (!canonical || canonical.status !== 'EXECUTING' || canonical.payloadVersion !== action.payloadVersion ||
          canonical.payloadSnapshot !== JSON.stringify(action.parameters) || action.accountKey !== this.accountKey() ||
          action.mode !== this.operationMode() || action.provider !== 'microsoft') throw new Error('Propuesta no autorizada o contexto cambiado.');
      if (this.attempted.has(action.id)) throw new Error('La acción ya tiene un intento. Consulta su resultado.');
      this.attempted.add(action.id);
      const p = action.parameters, real = action.mode === 'real';
      const msg = this.currentMessages().find(m => m.id === p['messageId']);
      if (action.action_type !== 'SEND_EMAIL' && !msg) throw new Error('El mensaje ya no está en la vista de su cuenta. Vuelve a seleccionarlo.');
      if (action.action_type === 'SEND_EMAIL') {
        const to = this.recipients(p['to'] || ''), cc = this.recipients(p['cc'] || ''), bcc = this.recipients(p['bcc'] || '');
        if (!to.length) throw new Error('Indica al menos un destinatario Para.');
        if (!String(p['body'] || '').trim()) throw new Error('El cuerpo está vacío. Revisa la propuesta.');
        if(/\[(Completa|Escribe|Tu Nombre)/i.test(p['body'])) throw new Error('Completa el borrador antes de enviarlo.');
        const attachments: MailAttachment[] = p['attachments'] || [];
        if (attachments.reduce((sum,a) => sum+a.size,0) > 2*1024*1024) throw new Error('El límite de esta versión es 2 MB de adjuntos por mensaje.');
        const message = {subject:p['subject'] || '(Sin asunto)',body:{contentType:'Text',content:p['body']},toRecipients:to,ccRecipients:cc,bccRecipients:bcc,
          attachments:attachments.map(a => ({'@odata.type':'#microsoft.graph.fileAttachment',name:a.name,contentType:a.contentType,contentBytes:a.contentBytes}))};
        if (real) {
          const reply = p['replyToId'];
          const path = reply ? `/me/messages/${encodeURIComponent(reply)}/reply` : '/me/sendMail';
          return this.graph('POST',path,reply ? {message} : {message,saveToSentItems:true},false,true);
        }
        const sent: OutlookMessage = {id:crypto.randomUUID(),subject:message.subject,bodyPreview:p['body'].slice(0,120),body:{contentType:'text',content:p['body']},
          from:{emailAddress:{name:'Usuario simulado',address:'usuario@outlook.com'}},toRecipients:to,ccRecipients:cc,bccRecipients:bcc,
          attachments:structuredClone(attachments),folderKey:'sentitems',isRead:true,receivedDateTime:new Date().toISOString()};
        this.simulatedMessages.update(list => [sent,...list]); return of(true);
      }
      const id = msg!.id, path = `/me/messages/${encodeURIComponent(id)}`;
      if (action.action_type === 'DELETE_EMAIL' || action.action_type === 'MOVE_EMAIL') {
        const destinationId = action.action_type === 'DELETE_EMAIL' ? 'deleteditems' : p['folder'];
        if (!destinationId || (real && !['inbox','archive','deleteditems'].includes(destinationId) && !this.folders().some(f => f.id === destinationId))) throw new Error('Carpeta de destino inválida.');
        if (real) return this.graph<OutlookMessage>('POST',path+'/move',{destinationId},true).pipe(tap(() => {
          if (action.accountKey === this.accountKey()) { this.realMessages.update(list => list.filter(m => m.id !== id)); if(this.selectedMessage()?.id===id) this.selectedMessage.set(null); }
        }));
        this.updateLocal(id,{folderKey:destinationId}); this.selectedMessage.set(this.displayedMessages()[0] || null); return of(true);
      }
      let patch: Partial<OutlookMessage>;
      switch(action.action_type) {
        case 'ADD_CATEGORY': patch = {categories:[...new Set([...(msg!.categories || []),String(p['category'])])]}; break;
        case 'MARK_AS_READ': patch = {isRead:true}; break;
        case 'MARK_AS_UNREAD': patch = {isRead:false}; break;
        case 'SET_FLAG': patch = {flag:{flagStatus:p['flagged'] ? 'flagged' : 'notFlagged'}}; break;
        default: throw new Error('Operación no soportada.');
      }
      if (!real) { this.updateLocal(id,patch); return of(true); }
      // Leer categorías actuales antes de agregar; no sustituir otras con una copia antigua.
      if (action.action_type === 'ADD_CATEGORY') return this.graph<OutlookMessage>('GET',path+'?$select=id,categories').pipe(
        switchMap(current => this.graph<OutlookMessage>('PATCH',path,{categories:[...new Set([...(current.categories || []),String(p['category'])])]},true)),
        tap(updated => { if(action.accountKey===this.accountKey()) this.updateLocal(id,{categories:updated.categories}); }));
      return this.graph<OutlookMessage>('PATCH',path,patch,true).pipe(tap(() => { if(action.accountKey===this.accountKey()) this.updateLocal(id,patch); }));
    }).pipe(catchError(error => {
      if(error.code==='authorization_required') {
        this.attempted.delete(action.id);
        this.clearActionPermission(action);
      }
      return throwError(() => error);
    }));
  }
}
