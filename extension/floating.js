const query=new URLSearchParams(location.search);
const provider=query.get('provider'),bridge=query.get('bridge');
const allowedOrigins=new Set(['https://mail.google.com','https://outlook.live.com','https://outlook.office.com','https://outlook.office365.com','https://outlook.cloud.microsoft']);
const parentOrigin=query.get('parentOrigin');
const extensionOrigin=`chrome-extension://${chrome.runtime.id}`;
let section='chat',frame,ready=false,loadTimer,expanded=query.get('expanded')==='1';
const loading=document.getElementById('loading'),status=document.getElementById('status'),recovery=document.getElementById('recovery');
function waitForApp(){ready=false;loading.hidden=false;recovery.hidden=true;status.textContent='Abriendo el asistente…';clearTimeout(loadTimer);loadTimer=setTimeout(()=>{if(!ready){status.textContent='El navegador no pudo abrir el módulo del chat. Comprueba que NexoMail esté actualizado y recarga la pestaña de correo.';recovery.hidden=false;}},35000);}
function sendSection(){if(frame?.contentWindow){frame.contentWindow.postMessage({type:'EMAILAGENT_DISPLAY_MODE',expanded,bridge},extensionOrigin);frame.contentWindow.postMessage({type:'EMAILAGENT_NAV',section,bridge},extensionOrigin);}}
function select(value){section=value==='mail' && !expanded?'chat':value;for(const button of document.querySelectorAll('[data-section]'))button.setAttribute('aria-pressed',String(button.dataset.section===section));}
function displayMode(value){
  expanded=value;
  const mailButton=document.querySelector('[data-section="mail"]');
  const restoreFocus=!expanded && document.activeElement===mailButton;
  mailButton.hidden=!expanded;
  mailButton.setAttribute('aria-hidden',String(!expanded));
  document.body.dataset.displayMode=expanded?'expanded':'compact';
  if(!expanded && section==='mail'){select('chat');sendSection();}
  else if(ready)sendSection();
  if(restoreFocus)document.querySelector('[data-section="chat"]').focus();
}
if(!['gmail','outlook'].includes(provider) || !bridge || !allowedOrigins.has(parentOrigin)){
  status.textContent='Abre el chat desde la burbuja de NexoMail en Gmail u Outlook.';
}else{
  displayMode(expanded);
  frame=document.createElement('iframe');frame.title=provider==='gmail'?'Chat de Gmail':'Chat de Outlook';
  frame.src=chrome.runtime.getURL(`apps/${provider}/index.html`)+`?floating=1&bridge=${encodeURIComponent(bridge)}&version=1.7.0`;
  frame.addEventListener('load',sendSection);document.getElementById('workspace').append(frame);waitForApp();
  document.getElementById('retry').addEventListener('click',()=>{waitForApp();frame.src=chrome.runtime.getURL(`apps/${provider}/index.html`)+`?floating=1&bridge=${encodeURIComponent(bridge)}&version=1.7.0`;});
  document.getElementById('open-full').addEventListener('click',()=>chrome.tabs.create({url:chrome.runtime.getURL(`apps/${provider}/index.html`)}));
  for(const button of document.querySelectorAll('[data-section]'))button.addEventListener('click',()=>{select(button.dataset.section);sendSection();});
  window.addEventListener('message',event=>{
    if(event.source===window.parent && event.origin===parentOrigin && event.data?.bridge===bridge && event.data.type==='EMAILAGENT_DISPLAY_MODE'){
      if(typeof event.data.expanded==='boolean')displayMode(event.data.expanded);
      return;
    }
    if(event.origin!==extensionOrigin || event.source!==frame.contentWindow || event.data?.bridge!==bridge)return;
    if(event.data.type==='EMAILAGENT_APP_ERROR'){clearTimeout(loadTimer);loading.hidden=false;status.textContent='La interfaz no pudo iniciar. Vuelve a abrir el chat o recarga la pestaña del correo después de actualizar NexoMail.';recovery.hidden=false;}
    if(event.data.type==='EMAILAGENT_APP_READY'){ready=true;clearTimeout(loadTimer);loading.hidden=true;sendSection();}
    if(event.data.type==='EMAILAGENT_VIEW' && ['chat','mail','actions','history','settings'].includes(event.data.section)){
      select(event.data.section);
      if(event.data.section==='mail' && !expanded)sendSection();
    }
    if(event.data.type==='EMAILAGENT_MINIMIZE')window.parent.postMessage({type:'EMAILAGENT_MINIMIZE',bridge},parentOrigin);
  });
  window.parent.postMessage({type:'EMAILAGENT_DISPLAY_READY',bridge},parentOrigin);
  document.addEventListener('keydown',event=>{if(event.key==='Escape')window.parent.postMessage({type:'EMAILAGENT_MINIMIZE',bridge},parentOrigin);});
}
