import {loadConfiguration} from './configuration.js';
import {getPageContext} from './page-context.js';
import {detectPlatform} from './platform.js';
import {installGoogleAuth} from './google-auth.js';
let googleHostPromise;
function googleHost(){
  if(!googleHostPromise)googleHostPromise=(async()=>{const host={config:{}};await installGoogleAuth(host);return host;})();
  return googleHostPromise;
}
// Tokens are returned only to our extension pages, never to content scripts.
// One worker coordinates renewals across multiple panels.
chrome.runtime.onMessage.addListener((message,sender,reply)=>{
  if(message?.type!=='EMAILAGENT_GOOGLE_AUTH')return;
  if(sender.id!==chrome.runtime.id || !sender.url?.startsWith(chrome.runtime.getURL('')))return;
  const methods=new Set(['googleLogin','googleRestore','googleAccessToken','googleInvalidateToken','googleDisconnect']);
  if(!methods.has(message.method) || !Array.isArray(message.args) || message.args.length>1 || message.args.some(arg=>typeof arg!=='string' || arg.length>16384)){reply({ok:false,error:'Solicitud de autorización no válida.'});return;}
  googleHost().then(async host=>{
    host.config=await loadConfiguration();
    const context=await getPageContext(message.contextKey,sender);
    return host[message.method](...message.args,context);
  }).then(value=>reply({ok:true,value:value ?? null})).catch(error=>reply({ok:false,error:error instanceof Error?error.message:'No se pudo recuperar la sesión de Google.'}));
  return true;
});
chrome.action.onClicked.addListener(async tab=>{
  if(!tab?.id || !detectPlatform(tab.url)){chrome.runtime.openOptionsPage();return;}
  try{await chrome.tabs.sendMessage(tab.id,{type:'EMAILAGENT_TOGGLE_FLOATING'});await chrome.action.setBadgeText({tabId:tab.id,text:''});}
  catch{await chrome.action.setBadgeText({tabId:tab.id,text:'!'});await chrome.action.setTitle({tabId:tab.id,title:'Recarga Gmail u Outlook para activar la burbuja EmailAgent.'});}
});
chrome.tabs.onUpdated.addListener((id,change,tab)=>{if(change.status==='complete' && detectPlatform(tab.url)){chrome.action.setBadgeText({tabId:id,text:''});chrome.action.setTitle({tabId:id,title:'Abrir o minimizar el chat flotante'});}});
chrome.runtime.onMessage.addListener((message,sender,reply)=>{
  if(message?.type==='EMAILAGENT_OPTIONS' && sender.id===chrome.runtime.id && sender.tab?.id && detectPlatform(sender.url)){chrome.runtime.openOptionsPage().then(()=>reply({ok:true}));return true;}
});
