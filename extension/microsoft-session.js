import {loadConfiguration} from './configuration.js';
import {getPageContext} from './page-context.js';

const cachePrefix='nexomail.microsoft.session.';
const bindingPrefix='nexomail.microsoft.tab.';
const normal=value=>String(value || '').trim().toLowerCase();
const emailValid=value=>typeof value==='string' && value.length<=254 && /^[^\s<>@]+@[^\s<>@]+\.[^\s<>@]+$/.test(value);
const recordKey=(client,email)=>cachePrefix+client+'.'+encodeURIComponent(email);
const bindingKey=(client,ctx)=>bindingPrefix+client+'.'+ctx.tabId+'.'+encodeURIComponent(ctx.slot);
function validate(snapshot,client){
  if(!snapshot || snapshot.version!==1 || !emailValid(snapshot.email) || typeof snapshot.homeAccountId!=='string' || snapshot.homeAccountId.length>300 || !snapshot.homeAccountId)throw new Error('La sesión de Microsoft no tiene un formato válido.');
  if(typeof snapshot.accountKey!=='string' || snapshot.accountKey.length>1000 || !snapshot.accountKey.toLowerCase().startsWith(snapshot.homeAccountId.toLowerCase()+'-'))throw new Error('Cuenta de Microsoft no válida.');
  if(typeof snapshot.accountValue!=='string' || snapshot.accountValue.length>80000 || !Array.isArray(snapshot.tokens) || snapshot.tokens.length>60)throw new Error('Caché de Microsoft no válida.');
  const account=JSON.parse(snapshot.accountValue);
  if(normal(account.username)!==normal(snapshot.email) || account.homeAccountId!==snapshot.homeAccountId)throw new Error('La caché no pertenece a la cuenta autorizada.');
  const tokens=snapshot.tokens.map(token=>{
    if(!['idToken','accessToken','refreshToken'].includes(token.kind) || typeof token.key!=='string' || token.key.length>1600 || typeof token.value!=='string' || token.value.length>80000)throw new Error('Credencial de Microsoft no válida.');
    const data=JSON.parse(token.value);
    if(data.homeAccountId!==snapshot.homeAccountId || normal(data.clientId)!==normal(client) || normal(data.credentialType)!==normal(token.kind) || !token.key.toLowerCase().startsWith(snapshot.homeAccountId.toLowerCase()+'-'))throw new Error('Credencial de otra cuenta o aplicación.');
    return {key:token.key,value:token.value,kind:token.kind};
  });
  const result={version:1,email:normal(snapshot.email),homeAccountId:snapshot.homeAccountId,accountKey:snapshot.accountKey,accountValue:snapshot.accountValue,tokens};
  if(JSON.stringify(result).length>512000)throw new Error('La caché supera el límite de sesión.');
  return result;
}

chrome.runtime.onMessage.addListener((message,sender,reply)=>{
  if(message?.type!=='NEXOMAIL_MICROSOFT_SESSION')return;
  if(sender.id!==chrome.runtime.id || !sender.url?.startsWith(chrome.runtime.getURL('apps/outlook/')))return;
  if(!['get','set','clear'].includes(message.method)){reply({ok:false,error:'Operación de sesión no válida.'});return;}
  (async()=>{
    const config=await loadConfiguration(),client=normal(config.microsoftClientId);
    const ctx=await getPageContext(message.contextKey,sender);
    if(!ctx || ctx.provider!=='outlook')return null;
    const boundKey=bindingKey(client,ctx);
    const bound=(await chrome.storage.session.get(boundKey))[boundKey];
    const expected=normal(ctx.email || bound?.email);
    if(message.method==='get'){
      if(!emailValid(expected))return null;
      const blocked=(await chrome.storage.local.get('nexomail.microsoft.disconnected'))['nexomail.microsoft.disconnected'] || {};
      if(blocked[expected])return null;
      const record=(await chrome.storage.session.get(recordKey(client,expected)))[recordKey(client,expected)];
      if(!record || record.expiresAt<Date.now())return null;
      return validate(record.snapshot,client);
    }
    if(message.method==='clear'){
      const email=normal(message.email);
      if(!emailValid(email) || (expected && email!==expected))throw new Error('La cuenta de la pestaña cambió.');
      const records=await chrome.storage.session.get(null);
      const remove=Object.keys(records).filter(key=>key.startsWith(bindingPrefix+client+'.') && normal(records[key]?.email)===email);
      remove.push(recordKey(client,email));await chrome.storage.session.remove(remove);return true;
    }
    const snapshot=validate(message.snapshot,client);
    if(ctx.email && normal(ctx.email)!==snapshot.email)throw new Error('La cuenta de Microsoft no coincide con la pestaña de Outlook.');
    const blocked=(await chrome.storage.local.get('nexomail.microsoft.disconnected'))['nexomail.microsoft.disconnected'] || {};
    if(blocked[snapshot.email])throw new Error('La cuenta fue desconectada expresamente.');
    await chrome.storage.session.set({[recordKey(client,snapshot.email)]:{snapshot,expiresAt:Date.now()+24*60*60*1000},[boundKey]:{email:snapshot.email}});
    return true;
  })().then(value=>reply({ok:true,value:value ?? null})).catch(()=>reply({ok:false,error:'No se pudo recuperar o guardar la sesión temporal de Microsoft.'}));
  return true;
});
chrome.tabs.onRemoved.addListener(async tabId=>{
  const all=await chrome.storage.session.get(null);
  const keys=Object.keys(all).filter(key=>key.startsWith(bindingPrefix) && key.split('.')[4]===String(tabId));
  if(keys.length)await chrome.storage.session.remove(keys);
});
