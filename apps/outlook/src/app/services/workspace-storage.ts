export interface StoredChat {id:string;role:'user'|'assistant';content:string;created_at:string}
export interface StoredDraft {id:string;to:string;cc:string;bcc:string;subject:string;body:string;reply_to_id:string|null;attachments_omitted:boolean;created_at:string}
export interface StoredPreferences {theme:'light'|'dark';strict_mode:boolean;llm_enabled:boolean;auto_grouping:boolean}
export interface StoredAudit {id:string;action_type:string;status:string;description:string;details:string;occurred_at:string}
export type Section='chat'|'drafts'|'preferences';
export interface StoredWorkspace {account:{provider:string;email:string};sections:{chat:{revision:number;data:StoredChat[]};drafts:{revision:number;data:StoredDraft[]};preferences:{revision:number;data:StoredPreferences|null}};audit:StoredAudit[]}
type Host={apiBaseUrl:string;pairingToken:string};
/** Instance is bound to one live account. It never stores the OAuth token. */
export class WorkspaceStorage {
  private active=true;
  private hydrated=false;
  private conflict=false;
  private erasing=false;
  private revisions:Record<Section,number>={chat:0,drafts:0,preferences:0};
  private snapshots:Partial<Record<Section,string>>={};
  private pending:Partial<Record<Section,unknown>>={};
  private timers:Partial<Record<Section,ReturnType<typeof setTimeout>>>={};
  private queues:Partial<Record<Section,Promise<unknown>>>={};
  private auditIds=new Set<string>();
  private auditQueue:Promise<unknown>=Promise.resolve();
  private provider:'gmail'|'microsoft';
  private config:Host;
  private token:()=>Promise<string>;
  private status:(text:string)=>void;
  constructor(provider:'gmail'|'microsoft',config:Host,token:()=>Promise<string>,status:(text:string)=>void){
    this.provider=provider;this.config=config;this.token=token;this.status=status;
  }
  get ready(){return this.active && this.hydrated && !this.conflict && !this.erasing;}
  private async request(path:string,body?:unknown):Promise<any>{
    if(!this.active)throw new Error('La cuenta cambió.');
    const token=await this.token();
    if(!this.active)throw new Error('La cuenta cambió.');
    const encoded=body===undefined?undefined:JSON.stringify(body);
    if(encoded && new TextEncoder().encode(encoded).length>250000)throw new Error('El contenido supera el límite de guardado. Divide el chat o reduce los borradores.');
    const response=await fetch(this.config.apiBaseUrl+'/api/storage/'+this.provider+path,{
      method:body===undefined?'GET':'POST',headers:{'Content-Type':'application/json','X-EmailAgent-Token':this.config.pairingToken,'Authorization':'Bearer '+token},
      body:encoded,signal:AbortSignal.timeout(16000)});
    const data=await response.json();
    if(!response.ok){if(response.status===409)this.conflict=true;throw new Error(typeof data.detail==='string'?data.detail:data.message || 'No se confirmó el guardado en PostgreSQL.');}
    if(!this.active)throw new Error('La cuenta cambió.');
    return data;
  }
  async load():Promise<StoredWorkspace>{
    this.status('Conectando con PostgreSQL…');
    try{
      const data=await this.request('/workspace') as StoredWorkspace;
      data.sections.chat.data=data.sections.chat.data.map(message=>({...message,created_at:new Date(message.created_at).toISOString()}));
      data.sections.drafts.data=data.sections.drafts.data.map(draft=>({...draft,created_at:new Date(draft.created_at).toISOString()}));
      for(const section of ['chat','drafts','preferences'] as Section[]){this.revisions[section]=data.sections[section].revision;this.snapshots[section]=JSON.stringify(data.sections[section].data);}
      this.auditIds=new Set(data.audit.map(event=>event.id));this.hydrated=true;
      this.status('PostgreSQL conectado · Datos separados por cuenta');return data;
    }catch(error){if(this.active)this.status('Sin persistencia: '+(error as Error).message);throw error;}
  }
  schedule(section:Section,data:unknown){
    if(!this.ready || JSON.stringify(data)===this.snapshots[section])return;
    this.pending[section]=structuredClone(data);clearTimeout(this.timers[section]);
    this.status('Cambios pendientes de guardar…');
    this.timers[section]=setTimeout(()=>{const latest=this.pending[section];delete this.pending[section];void this.save(section,latest).catch(()=>{});},700);
  }
  save(section:Section,data:unknown):Promise<void>{
    clearTimeout(this.timers[section]);delete this.pending[section];
    const snapshot=JSON.stringify(data);
    const operation=(this.queues[section] || Promise.resolve()).catch(()=>{}).then(async()=>{
      if(!this.ready)throw new Error('La base de datos no está lista o cambió la versión. Recarga NexoMail.');
      if(this.snapshots[section]===snapshot)return;
      const result=await this.request('/workspace/'+section,{revision:this.revisions[section],data});
      this.revisions[section]=result.revision;this.snapshots[section]=snapshot;
      this.status('Guardado en PostgreSQL · '+new Date().toLocaleTimeString([],{hour:'2-digit',minute:'2-digit'}));
    });
    this.queues[section]=operation;
    return operation.catch(error=>{if(this.active)this.status('Cambios sin guardar: '+(error as Error).message);throw error;});
  }
  appendAudit(events:StoredAudit[]){
    if(!this.ready)return;
    const fresh=events.filter(event=>!this.auditIds.has(event.id)).slice(-100).map(event=>({...event,action_type:event.action_type.slice(0,80),status:event.status.slice(0,80),description:event.description.slice(0,2000),details:event.details.slice(0,4000)}));
    if(!fresh.length)return;
    for(const event of fresh)this.auditIds.add(event.id);
    this.auditQueue=this.auditQueue.catch(()=>{}).then(async()=>{
      const remaining=[...fresh];
      while(remaining.length){
        const batch=[remaining.shift()!];
        while(remaining.length && batch.length<100 && new TextEncoder().encode(JSON.stringify([...batch,remaining[0]])).length<180000)batch.push(remaining.shift()!);
        await this.request('/audit',{events:batch});
      }
    }).catch(error=>{
      for(const event of fresh)this.auditIds.delete(event.id);
      if(this.active)this.status('Auditoría sin guardar: '+(error as Error).message);
    });
  }
  async erase(){
    if(!this.ready)throw new Error('Conecta la base antes de vaciar los datos.');
    this.erasing=true;
    for(const section of ['chat','drafts','preferences'] as Section[]){clearTimeout(this.timers[section]);delete this.pending[section];}
    await Promise.all(Object.values(this.queues).map(p=>p?.catch(()=>{})));await this.auditQueue.catch(()=>{});
    try{await this.request('/erase',{});this.close();}catch(error){this.erasing=false;throw error;}
  }
  close(){this.active=false;this.hydrated=false;for(const timer of Object.values(this.timers))clearTimeout(timer);}
}

/** Keep only the recent visible conversation within the companion server request budget. */
export function boundedChat(messages:StoredChat[]):StoredChat[]{
  const recent=messages.slice(-100).map(message=>({...message,content:message.content.slice(0,20000)}));
  while(recent.length>1 && new TextEncoder().encode(JSON.stringify(recent)).length>180000)recent.shift();
  return recent;
}
