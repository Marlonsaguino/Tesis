import { analyzeMail, inspectHtml } from './mail-insights';
import type { Email } from '../types/email';

export type GmailConfig = {
  clientId: string;
  clientSecret: string;
  redirectUri: string;
  accessToken?: string;
  refreshToken?: string;
  expiresAt?: number;
  email?: string;
  sessionId?: string;
};

const GMAIL_CONFIG_KEY = 'emailagent.extension.gmail.session';

export class RealGmailProvider {
  private config: GmailConfig | null = null;
  private isLiveMode: boolean = false;

  constructor() {
    this.loadSavedConfig();
  }

  public loadSavedConfig(): boolean {
    try {
      const saved = sessionStorage.getItem(GMAIL_CONFIG_KEY);
      if (saved) {
        this.config = JSON.parse(saved);
        if (this.config?.accessToken) {
          this.isLiveMode = true;
          return true;
        }
      }
    } catch (e) {
      console.error('Error cargando configuración guardada de Gmail:', e);
    }
    return false;
  }

  public saveConfig(config: GmailConfig) {
    const cleanToken = config.accessToken ? config.accessToken.replace(/^Bearer\s+/i, '').trim() : undefined;
    this.config = { ...config, accessToken: cleanToken };
    if (cleanToken || config.sessionId) {
      this.isLiveMode = true;
    }
    sessionStorage.setItem(GMAIL_CONFIG_KEY, JSON.stringify(this.config));
  }

  public clearConfig() {
    this.config = null;
    this.isLiveMode = false;
    sessionStorage.removeItem(GMAIL_CONFIG_KEY);
  }

  public isConnected(): boolean {
    return this.isLiveMode && !!this.config?.sessionId;
  }

  public getSessionKey(): string {return this.isConnected() ? 'gmail:'+(window.emailAgentHost.googleSessionId() || 'disconnected') : 'gmail:simulated';}
  public getConfig(): GmailConfig | null {
    return this.config;
  }

  public async restoreSession():Promise<void> {
    const auth=await window.emailAgentHost.googleRestore();
    if(auth)this.saveConfig({...auth,clientSecret:'',redirectUri:''});
    else this.clearConfig();
  }
  private async accessToken():Promise<string> {
    const session=this.config?.sessionId;
    if(!session)throw new Error('Conecta Gmail mediante el botón de Google.');
    const token=await window.emailAgentHost.googleAccessToken(session);
    if(this.config?.sessionId!==session)throw new Error('La cuenta cambió durante la autorización.');
    this.config={...this.config,accessToken:token};
    return token;
  }
  private async gmailRequest(url:string,options:RequestInit={}):Promise<Response> {
    const session=this.config?.sessionId;
    const headers=new Headers(options.headers);
    if(options.method && options.method!=='GET' && session){
      // Refresh before the first write attempt, including writes following a read.
      const token=await window.emailAgentHost.googleAccessToken(session);
      if(this.config?.sessionId!==session)throw new Error('La cuenta cambió antes de ejecutar la acción.');
      headers.set('Authorization','Bearer '+token);
      options={...options,headers};
    }
    let response=await fetch(url,options);
    // Only reads are replayed, once. A write is never repeated automatically.
    if(response.status===401 && (!options.method || options.method==='GET') && session){
      await window.emailAgentHost.googleInvalidateToken((headers.get('Authorization') || '').replace(/^Bearer /,''));
      const token=await window.emailAgentHost.googleAccessToken(session);
      if(this.config?.sessionId!==session)throw new Error('La sesión cambió. Vuelve a seleccionar el correo.');
      headers.set('Authorization','Bearer '+token);
      response=await fetch(url,{...options,headers});
    }
    return response;
  }

  // Real Gmail API call to list messages
  public async fetchEmails(query: string = 'in:inbox', maxResults: number = 10): Promise<Email[]> {
    if (!this.config?.sessionId) {
      throw new Error('No hay una sesión activa de Gmail API. Por favor conecta tu cuenta.');
    }

    const token=await this.accessToken();
    try {
      // 1. List message IDs
      const listUrl = `https://gmail.googleapis.com/gmail/v1/users/me/messages?q=${encodeURIComponent(query)}&maxResults=${maxResults}`;
      const listRes = await this.gmailRequest(listUrl, {
        headers: { Authorization: `Bearer ${token}` }
      });

      if (!listRes.ok) {
        const errData = await listRes.json();
        throw new Error(errData.error?.message || 'Error al obtener lista de correos de Gmail API');
      }

      const listData = await listRes.json();
      if (!listData.messages || listData.messages.length === 0) {
        return [];
      }

      // 2. Fetch message details in parallel
      const emails = await Promise.all(
        listData.messages.map(async (item: { id: string }) => {
          const msgUrl = `https://gmail.googleapis.com/gmail/v1/users/me/messages/${item.id}?format=full`;
          const msgRes = await this.gmailRequest(msgUrl, {
            headers: { Authorization: `Bearer ${token}` },
          });
          if (!msgRes.ok) return null;
          const msg = await msgRes.json();
          return this.parseGmailMessage(msg);
        })
      );

      return emails.filter((e): e is Email => e !== null);
    } catch (err: any) {
      console.error('Error en fetchEmails de Gmail API:', err);
      throw err;
    }
  }

  // Parse Gmail API JSON object to our Email domain model
  private parseGmailMessage(msg: any): Email {
    const headers = msg.payload?.headers || [];
    const getHeader = (name: string) => headers.find((h: any) => h.name.toLowerCase() === name.toLowerCase())?.value || '';

    const fromHeader = getHeader('From');
    const subject = getHeader('Subject') || '(Sin asunto)';
    const dateStr = getHeader('Date');
    
    // Extract Sender Name and Email Address
    let senderName = fromHeader;
    let senderEmail = fromHeader;
    const match = fromHeader.match(/^(.*?)\s*<(.*?)>$/);
    if (match) {
      senderName = match[1].replace(/^"|"$/g, '').trim() || match[2];
      senderEmail = match[2];
    }

    // Walk nested MIME alternatives, retaining hidden HTML destinations for analysis.
    const texts:string[]=[],htmls:string[]=[],filenames:string[]=[];
    let count=0,partial=false,remaining=120000;
    const walk=(part:any,depth=0):void=>{
      if(!part || depth>12 || ++count>80){partial=true;return;}
      if(part.filename){filenames.push(String(part.filename));return;}
      if(part.body?.data && ['text/plain','text/html'].includes(part.mimeType)){
        const encoded=String(part.body.data);
        if(encoded.length>200000){partial=true;return;}
        let decoded='';
        try{decoded=this.decodeBase64Url(encoded);}catch{partial=true;return;}
        if(decoded.length>remaining)partial=true;
        (part.mimeType==='text/html'?htmls:texts).push(decoded.slice(0,remaining));
        remaining=Math.max(0,remaining-decoded.length);
      }else if(part.body?.attachmentId && ['text/plain','text/html'].includes(part.mimeType))partial=true;
      for(const child of (part.parts || []).slice(0,80))walk(child,depth+1);
      if(part.parts?.length>80)partial=true;
    };
    walk(msg.payload);
    const html=htmls.join('\n'),plain=texts.join('\n');
    const body=plain || (html?inspectHtml(html).text:'') || msg.snippet || '';
    partial=partial || (!plain && !html);
    const insights=analyzeMail({subject,sender:senderEmail,senderName,text:body,html,
      labels:msg.labelIds || [],filenames,replyTo:getHeader('Reply-To').match(/<?([^<>\s]+@[^<>\s]+)>?/)?.[1],partial});
    const isUnread=msg.labelIds?.includes('UNREAD') ?? false;
    const isUrgent=insights.categories.includes('Importante');

    return {
      id: msg.id,
      sender: senderEmail,
      senderName: senderName,
      senderAvatar: undefined,
      recipient: 'me',
      subject: subject,
      snippet: msg.snippet || '',
      body: body,
      date: dateStr ? new Date(dateStr).toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' }) : 'Reciente',
      timestamp: parseInt(msg.internalDate || Date.now().toString(), 10),
      read: !isUnread,
      category: msg.labelIds?.includes('CATEGORY_PROMOTIONS') ? 'Boletines' : msg.labelIds?.includes('CATEGORY_PERSONAL') ? 'Personal' : msg.labelIds?.includes('IMPORTANT') ? 'Importante' : 'Sin clasificar',
      insights,
      priority: isUrgent ? 'urgent' : 'normal',
      labels: msg.labelIds || []
    };
  }

  // Real Gmail API call to Trash emails
  public async trashEmails(ids: string[]): Promise<void> {
    if (!this.config?.sessionId) throw new Error('Sesión no autorizada');

    const token=await this.accessToken(),session=this.getSessionKey();
    for (const id of ids) {
      if(session!==this.getSessionKey())throw new Error('La sesión cambió. Se detuvo el resto de la operación.');
      const url = `https://gmail.googleapis.com/gmail/v1/users/me/messages/${id}/trash`;
      const res = await this.gmailRequest(url, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` }
      });
      if (!res.ok) {
        throw new Error('Gmail no confirmó el movimiento a la papelera. Revisa el buzón antes de crear otra propuesta.');
      }
    }
  }

  // Real Gmail API call to Send email
  public async sendEmail(recipient: string, subject: string, body: string): Promise<void> {
    if (!this.config?.sessionId) throw new Error('Sesión no autorizada');

    const token=await this.accessToken();
    if(!/^[^\s<>@,;\r\n]+@[^\s<>@,;\r\n]+\.[^\s<>@,;\r\n]+$/.test(recipient) || /[\r\n]/.test(subject)) throw new Error('Revisa el destinatario y el asunto.');
    const emailContent = [
      `To: ${recipient}`,
      `Subject: =?utf-8?B?${btoa(unescape(encodeURIComponent(subject)))}?=`,
      'Content-Type: text/plain; charset=utf-8',
      'MIME-Version: 1.0',
      '',
      body
    ].join('\r\n');

    const raw = this.encodeBase64Url(emailContent);

    const url = `https://gmail.googleapis.com/gmail/v1/users/me/messages/send`;
    const res = await this.gmailRequest(url, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ raw })
    });

    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.error?.message || 'Error al enviar correo mediante Gmail API');
    }
  }

  public async labelEmails(ids: string[], labelName: string): Promise<void> {
    if (!this.config?.sessionId) throw new Error('Sesión no autorizada');

    const token=await this.accessToken(),session=this.getSessionKey();
    const labelId = await this.ensureUserLabel(labelName,token);
    if(session!==this.getSessionKey())throw new Error('La sesión cambió. Se detuvo el etiquetado.');

    await Promise.all(
      ids.map(async (id) => {
        const url = `https://gmail.googleapis.com/gmail/v1/users/me/messages/${id}/modify`;
        const res = await this.gmailRequest(url, {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ addLabelIds: [labelId] }),
        });
        if (!res.ok) {
          throw new Error('Gmail rechazó una etiqueta. Algunas anteriores pueden haberse aplicado; actualiza antes de volver a intentar.');
        }
      })
    );
  }

  private async ensureUserLabel(name: string,token:string): Promise<string> {
    const listUrl = 'https://gmail.googleapis.com/gmail/v1/users/me/labels';
    const listRes = await this.gmailRequest(listUrl, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (listRes.ok) {
      const data = (await listRes.json()) as { labels?: Array<{ id: string; name: string }> };
      const existing = data.labels?.find((l) => l.name.toLowerCase() === name.toLowerCase());
      if (existing) return existing.id;
    }

    const createRes = await this.gmailRequest(listUrl, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        name,
        labelListVisibility: 'labelShow',
        messageListVisibility: 'show',
      }),
    });
    if (!createRes.ok) {
      throw new Error('No se pudo crear la etiqueta en Gmail');
    }
    const created = (await createRes.json()) as { id: string };
    return created.id;
  }

  // Real Gmail API call to Mark as Read
  public async markAsRead(id: string): Promise<void> {
    if (!this.config?.sessionId) return;

    const token=await this.accessToken();
    const url = `https://gmail.googleapis.com/gmail/v1/users/me/messages/${id}/modify`;
    const response=await this.gmailRequest(url, {method:'POST',headers:{Authorization:`Bearer ${token}`,'Content-Type':'application/json'},body:JSON.stringify({removeLabelIds:['UNREAD']})});
    if(!response.ok)throw new Error('Gmail no pudo actualizar el estado de lectura.');
  }

  private decodeBase64Url(input: string): string {
    let base64 = input.replace(/-/g, '+').replace(/_/g, '/');
    while (base64.length % 4) {
      base64 += '=';
    }
    try {
      return decodeURIComponent(escape(atob(base64)));
    } catch (e) {
      return atob(base64);
    }
  }

  private encodeBase64Url(input: string): string {
    return btoa(unescape(encodeURIComponent(input)))
      .replace(/\+/g, '-')
      .replace(/\//g, '_')
      .replace(/=+$/, '');
  }
}

export const realGmailProvider = new RealGmailProvider();
