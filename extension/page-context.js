import {detectPlatform} from './platform.js';
const prefix='nexomail.page.';
const validKey=key=>typeof key==='string' && /^[a-f0-9-]{36}$/i.test(key);
export async function getPageContext(key,sender){
  if(!key)return null;
  if(!validKey(key))throw new Error('Contexto de cuenta inválido.');
  const ctx=(await chrome.storage.session.get(prefix+key))[prefix+key];
  if(!ctx || (sender.tab?.id && sender.tab.id!==ctx.tabId))throw new Error('Recarga la pestaña de correo para identificar su cuenta.');
  const current=await chrome.tabs.sendMessage(ctx.tabId,{type:'EMAILAGENT_READ_PAGE_ACCOUNT',bridge:key});
  if(!current || current.slot!==ctx.slot || current.email!==ctx.email)throw new Error('La cuenta de la página cambió. Espera a que NexoMail vuelva a conectarse.');
  return ctx;
}
chrome.runtime.onMessage.addListener((message,sender,reply)=>{
  if(message?.type==='EMAILAGENT_PAGE_ACCOUNT'){
    const provider=detectPlatform(sender.url);
    if(sender.id!==chrome.runtime.id || !sender.tab?.id || !provider || !validKey(message.bridge))return;
    const email=typeof message.email==='string'?message.email.trim().toLowerCase():'';
    if(email && (!/^[^\s<>@]+@[^\s<>@]+\.[^\s<>@]+$/.test(email) || email.length>254))return;
    const ctx={provider,email,tabId:sender.tab.id,slot:String(message.slot || '').slice(0,100)};
    chrome.storage.session.set({[prefix+message.bridge]:ctx}).then(()=>reply({ok:true})).catch(()=>reply({ok:false}));
    return true;
  }
  if(message?.type==='EMAILAGENT_GET_PAGE_ACCOUNT'){
    if(sender.id!==chrome.runtime.id || !sender.url?.startsWith(chrome.runtime.getURL('')))return;
    getPageContext(message.bridge,sender).then(value=>reply({ok:true,value})).catch(()=>reply({ok:false}));return true;
  }
  if(message?.type==='EMAILAGENT_VALIDATE_PAGE_ACCOUNT'){
    if(sender.id!==chrome.runtime.id || !sender.url?.startsWith(chrome.runtime.getURL('')))return;
    getPageContext(message.bridge,sender).then(value=>{if(value?.email && value.email!==String(message.email || '').toLowerCase())throw new Error('Cuenta distinta');reply({ok:true});}).catch(()=>reply({ok:false}));return true;
  }
});
chrome.tabs.onRemoved.addListener(async tabId=>{
  const all=await chrome.storage.session.get(null);
  const keys=Object.keys(all).filter(key=>key.startsWith(prefix) && all[key]?.tabId===tabId);
  if(keys.length)await chrome.storage.session.remove(keys);
});
