import {realGmailProvider} from './services/realGmailProvider';
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'
import {StartupBoundary} from './components/StartupBoundary';

async function bounded<T>(promise:Promise<T>):Promise<T>{
  let timer:ReturnType<typeof setTimeout>;
  try{return await Promise.race([promise,new Promise<never>((_,reject)=>{timer=setTimeout(()=>reject(new Error('Inicio no disponible')),30000);})]);}
  finally{clearTimeout(timer!);}
}
async function start(){
  await bounded(window.emailAgentHost.ready);
  await bounded(realGmailProvider.restoreSession());
  createRoot(document.getElementById('root')!).render(<StrictMode><StartupBoundary><App/></StartupBoundary></StrictMode>);
}
start().catch(()=>{
  const bridge=new URLSearchParams(location.search).get('bridge');
  if(bridge && window.parent!==window)window.parent.postMessage({type:'EMAILAGENT_APP_ERROR',bridge},location.origin);
  const root=document.getElementById('root')!;
  const card=document.createElement('section');card.className='workspace-card';card.setAttribute('role','alert');
  const title=document.createElement('h2');title.textContent='No se pudo iniciar Gmail en NexoMail';
  const text=document.createElement('p');text.textContent='Recarga la pestaña del correo después de actualizar la extensión. Tu autorización de Google permanece guardada.';
  const retry=document.createElement('button');retry.className='workspace-button';retry.textContent='Volver a abrir';retry.addEventListener('click',()=>location.reload());
  card.append(title,text,retry);root.replaceChildren(card);
});

import './outlook-workspace.css'
