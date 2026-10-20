/** Local, deterministic analysis. Never fetches URLs, executes HTML or calls an LLM.
 * Keep copies in the two application services in sync with this source.
 */
export type MailCategory = 'Trabajo'|'Personal'|'Importante'|'Finanzas'|'Boletines';
export interface MailInput {
  subject: string; sender: string; senderName?: string; text: string;
  html?: string; labels?: string[]; filenames?: string[];
  replyTo?: string; partial?: boolean; hasAttachments?: boolean;
}
export interface LinkFinding { domain: string; reasons: string[]; }
export interface MailInsights {
  categories: MailCategory[]; classificationReasons: string[];
  level: 'high'|'review'|'none'; label: string; reasons: string[];
  links: LinkFinding[]; partial: boolean; hasAttachments: boolean;
}
const MAX_CONTENT=120000, MAX_LINKS=80;
const clean=(value:string)=>value.normalize('NFKD').replace(/[\u0300-\u036f]/g,'').toLowerCase();
const shorteners=new Set(['bit.ly','tinyurl.com','t.co','goo.gl','ow.ly','buff.ly','cutt.ly','is.gd','rb.gy','shorturl.at']);
const sensitiveFiles=/\.(?:exe|scr|com|bat|cmd|ps1|vbs|vbe|js|jse|msi|hta|lnk|iso|img)$/i;
const activeFiles=/\.(?:html?|svg|docm|xlsm|pptm|zip|rar|7z)$/i;
const host=(value:string)=>{try{return new URL(value).hostname.toLowerCase().replace(/\.$/,'');}catch{return '';}};
const related=(a:string,b:string)=>a===b || a.endsWith('.'+b) || b.endsWith('.'+a);

/** Template contents are inert: scripts, images and frames are never inserted in the document. */
export function inspectHtml(html:string):{text:string;anchors:{href:string;text:string}[];truncated:boolean} {
  const template=document.createElement('template');
  template.innerHTML=html.slice(0,MAX_CONTENT);
  const anchors=Array.from(template.content.querySelectorAll('a[href]')).slice(0,MAX_LINKS+1)
    .map(a=>({href:a.getAttribute('href') || '',text:a.textContent || ''}));
  template.content.querySelectorAll('script,style,iframe,object,embed,svg,template').forEach(node=>node.remove());
  template.content.querySelectorAll('br').forEach(node=>node.replaceWith('\n'));
  template.content.querySelectorAll('p,div,li,tr,section,blockquote,h1,h2,h3,h4').forEach(node=>node.append('\n'));
  return {text:template.content.textContent || '',anchors,truncated:html.length>MAX_CONTENT || anchors.length>MAX_LINKS};
}

export function analyzeMail(input:MailInput):MailInsights {
  const parsed=input.html?inspectHtml(input.html):null;
  const text=(input.text+'\n'+(parsed?.text || '')).slice(0,MAX_CONTENT);
  const hay=clean(input.subject+'\n'+text), subject=clean(input.subject);
  const categories:MailCategory[]=[], classificationReasons:string[]=[];
  const addCategory=(category:MailCategory,reason:string)=>{if(!categories.includes(category)){categories.push(category);classificationReasons.push(reason);}};
  for(const label of input.labels || []){
    const normalized=clean(label);
    const aliases:Record<string,MailCategory>={trabajo:'Trabajo',personal:'Personal',importante:'Importante',urgente:'Importante',finanzas:'Finanzas',boletines:'Boletines',suscripciones:'Boletines',category_promotions:'Boletines',category_social:'Boletines',category_personal:'Personal',important:'Importante'};
    if(aliases[normalized])addCategory(aliases[normalized],'Categoría existente: '+label);
  }
  const rules:[MailCategory,RegExp,string][]=[
    ['Finanzas',/\b(factura|invoice|recibo|comprobante|transferencia|payment|pago|estado de cuenta|saldo|cobro|presupuesto)\b/,'Referencias a pagos, facturas o movimientos financieros.'],
    ['Boletines',/\b(newsletter|boletin|unsubscribe|cancelar suscripcion|darse de baja|promocion|descuento|oferta|digest)\b/,'Contenido de boletín, promoción o suscripción.'],
    ['Trabajo',/\b(proyecto|tesis|reunion|meeting|entrega|informe|asignatura|matricula|universidad|clase|docente|estudiante|trabajo|equipo|sustentacion|entrevista|contrato)\b/,'Referencias laborales o académicas.'],
    ['Importante',/\b(urgente|urgent|vence|vencimiento|fecha limite|deadline|accion requerida|action required|seguridad|security alert)\b/,'Referencias a prioridad, plazos o seguridad.'],
    ['Personal',/\b(cumpleanos|familia|amigo|amiga|abrazo|saludos de|nos vemos|vacaciones)\b/,'Señales de conversación personal.']
  ];
  for(const [category,re,reason] of rules)if(re.test(hay))addCategory(category,reason);
  // No invented personal/work label when evidence is insufficient.
  const reasons:string[]=[], links:LinkFinding[]=[];let score=0;
  const warn=(reason:string,weight:number)=>{if(!reasons.includes(reason)){reasons.push(reason);score+=weight;}};
  if((input.labels || []).some(label=>label.toUpperCase()==='SPAM'))warn('Gmail ha colocado este mensaje en spam.',3);
  const senderDomain=input.sender.split('@').pop()?.toLowerCase() || '';
  const senderName=clean(input.senderName || '');
  for(const [brand,official] of [['microsoft',['microsoft.com','live.com','outlook.com','microsoftonline.com']],['google',['google.com']],['paypal',['paypal.com']]] as [string,string[]][]){
    if(senderDomain && new RegExp('\\b'+brand+'\\b').test(senderName) && !official.some(d=>senderDomain===d || senderDomain.endsWith('.'+d)))warn('El nombre del remitente menciona '+brand+', pero su dirección no pertenece a sus dominios habituales. Comprueba la identidad.',2);
  }
  const candidates=[...(parsed?.anchors || [])];
  for(const match of text.matchAll(/(?:https?:\/\/|www\.)[^\s<>"']+/gi)){
    if(candidates.length>MAX_LINKS)break;
    candidates.push({href:match[0].replace(/[.,;)\]}]+$/,''),text:''});
  }
  const seen=new Set<string>();
  for(const candidate of candidates.slice(0,MAX_LINKS)){
    const raw=candidate.href.trim();
    if(!raw || raw.startsWith('#') || /^(?:mailto|tel|cid):/i.test(raw))continue;
    const expanded=raw.startsWith('//')?'https:'+raw:/^www\./i.test(raw)?'https://'+raw:raw;
    if(seen.has(expanded))continue;seen.add(expanded);
    const linkReasons:string[]=[];
    const issue=(reason:string,weight:number)=>{linkReasons.push(reason);warn(reason,weight);};
    let url:URL;
    try{url=new URL(expanded);}catch{
      links.push({domain:'Destino no interpretable',reasons:['No se pudo comprobar el destino del enlace.']});
      warn('Un enlace no permite identificar su destino.',1);continue;
    }
    if(!['http:','https:'].includes(url.protocol)){
      issue('El enlace utiliza un protocolo que puede ejecutar contenido o abrir otra aplicación.',4);
      links.push({domain:'Protocolo bloqueado: '+url.protocol,reasons:linkReasons});continue;
    }
    const domain=url.hostname.toLowerCase();
    if(url.protocol==='http:')issue('Hay un enlace sin cifrado HTTPS.',1);
    if(url.username || url.password)issue('El enlace oculta el destino utilizando credenciales antes del dominio.',4);
    if(/(?:^|\.)xn--/i.test(domain))issue('El dominio contiene caracteres internacionalizados: comprueba posibles imitaciones.',1);
    if(/^\d{1,3}(?:\.\d{1,3}){3}$/.test(domain) || domain.includes(':'))issue('El enlace apunta a una dirección IP en lugar de un dominio.',2);
    if(shorteners.has(domain))issue('Un enlace acortado oculta el destino final.',1);
    if(/[\u200b-\u200f\u202a-\u202e\u2066-\u2069]/.test(raw))issue('El enlace contiene caracteres invisibles o de dirección de texto.',3);
    const displayed=candidate.text.trim().match(/^(?:https?:\/\/|www\.)[^\s]+$/i)?.[0];
    if(displayed){const visibleHost=host(/^www\./i.test(displayed)?'https://'+displayed:displayed);
      if(visibleHost && !related(visibleHost,domain))issue('El dominio del destino no coincide con la dirección mostrada en el enlace.',4);
    }
    if(sensitiveFiles.test(url.pathname))issue('El enlace parece descargar un archivo ejecutable o un acceso directo.',4);
    // Known brand names are a heuristic, never a sender authentication result.
    for(const [brand,official] of [['microsoft',['microsoft.com','live.com','office.com','microsoftonline.com']],['google',['google.com','gmail.com']],['paypal',['paypal.com']]] as [string,string[]][]){
      if(domain.includes(brand) && !official.some(d=>domain===d || domain.endsWith('.'+d)))issue('Un dominio incluye el nombre de '+brand+' fuera de sus dominios habituales.',2);
    }
    links.push({domain,reasons:linkReasons});
  }
  if(/\b(contrasena|password|codigo de verificacion|verification code|codigo otp|numero de tarjeta|cvv|frase semilla|seed phrase)\b/.test(hay)
      && /\b(envia|envie|enviar|comparte|compartir|introduce|ingresa|confirma|confirmar|verifica|verify|enter|provide|send|reply)\b/.test(hay))warn('El mensaje parece solicitar credenciales, códigos o información financiera.',3);
  if(links.length && /\b(suspendid[ao]|bloquead[ao]|ultima advertencia|ultimatum|within 24 hours|evita el cierre)\b/.test(hay))warn('Combina enlaces con presión para evitar un bloqueo o cierre de cuenta.',2);
  if(/\b(gana|ganaste|premio|loteria|lottery|winner)\b/.test(subject) && /\b(paga|pago|tarjeta|transferencia|deposito|fee|payment)\b/.test(hay))warn('Ofrece un premio y solicita un pago o información financiera.',3);
  if(input.replyTo && input.sender){const from=input.sender.split('@').pop()?.toLowerCase(),reply=input.replyTo.split('@').pop()?.toLowerCase();
    if(from && reply && !related(from,reply))warn('La dirección de respuesta pertenece a un dominio distinto al remitente. Puede ser legítimo; verifícalo.',1);}
  for(const filename of (input.filenames || []).slice(0,60)){
    if(sensitiveFiles.test(filename))warn('Incluye un adjunto ejecutable, script o acceso directo.',4);
    else if(activeFiles.test(filename))warn('Incluye un archivo comprimido o con contenido activo que requiere precaución.',1);
    if(/\.(?:pdf|docx?|xlsx?|jpe?g|png)\.[^.]+$/i.test(filename))warn('Un adjunto tiene doble extensión y puede ocultar su tipo real.',3);
  }
  const level=score>=4?'high':score>0?'review':'none';
  const partial=!!input.partial || !!parsed?.truncated || input.text.length>MAX_CONTENT || candidates.length>MAX_LINKS;
  return {categories,classificationReasons,level,label:level==='high'?'Posible phishing · Riesgo alto':level==='review'?'Requiere precaución':links.length?'Enlaces sin verificar':'Sin indicios detectados',reasons,links,partial,hasAttachments:!!input.hasAttachments || !!input.filenames?.length};
}
