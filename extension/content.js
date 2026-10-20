(() => {
  if(document.getElementById('emailagent-floating-root'))return;
  const provider=location.hostname==='mail.google.com'?'gmail':'outlook';
  const storageKey='emailagent.floating.geometry.'+provider;
  const bridge=crypto.randomUUID(),extensionOrigin=`chrome-extension://${chrome.runtime.id}`;
  const extensionVersion=chrome.runtime.getManifest().version;
  const host=document.createElement('div');host.id='emailagent-floating-root';
  for(const [name,value] of Object.entries({position:'fixed',top:'0',left:'0',width:'0',height:'0',overflow:'visible','z-index':'2147483646','pointer-events':'none'}))host.style.setProperty(name,value,'important');
  const shadow=host.attachShadow({mode:'closed'});
  const style=document.createElement('style');
  style.textContent=`*{box-sizing:border-box}button{font-family:Segoe UI,Arial;cursor:pointer}button:focus-visible,.handle:focus-visible{outline:3px solid #8dbbff;outline-offset:3px}[hidden]{display:none!important}.bubble{position:fixed;width:58px;height:58px;border:2px solid #ffffffb0;border-radius:50%;background:linear-gradient(140deg,#377fee,#1551ba);color:#fff;box-shadow:0 6px 24px #12366340;display:grid;place-items:center;pointer-events:auto;touch-action:none;user-select:none;cursor:grab}.bubble:active{cursor:grabbing}.bubble svg{width:58px;height:58px;pointer-events:none}.box{position:fixed;display:flex;flex-direction:column;pointer-events:auto;background:#fff;border:1px solid #d4e0ef;border-radius:17px;box-shadow:0 16px 65px #0c25483b;overflow:hidden;resize:both;min-width:min(320px,calc(100vw - 20px));min-height:min(350px,calc(100dvh - 24px));max-width:calc(100vw - 20px);max-height:calc(100dvh - 24px);padding-bottom:9px}.handle{display:flex;justify-content:space-between;align-items:center;gap:8px;padding:9px 12px;background:#163969;color:#fff;min-height:48px;flex-shrink:0;touch-action:none;cursor:grab;user-select:none;font:600 13px Segoe UI,Arial}.handle strong{display:block;font-weight:650}.handle small{display:block;font-size:10px;color:#c1d5f0;margin-top:2px}.controls{display:flex;gap:4px}.controls button{width:30px;height:30px;border:1px solid #ffffff24;border-radius:8px;color:#fff;background:#ffffff0c;font:17px Segoe UI}.controls button:hover{background:#ffffff24}.shell-status{padding:22px 18px;background:#f4f6fa;color:#415b79;font:13px/1.7 Segoe UI,Arial;flex-shrink:0}.shell-status p{margin:0 0 12px}.shell-status button{padding:9px 13px;margin-right:8px;background:#fff;color:#164c94;border:1px solid #c8d7eb;border-radius:8px;font:600 12px Segoe UI,Arial}.box iframe{display:block;width:100%;min-height:0;flex:1;border:0;background:#f4f6fa}.box.dragging iframe{pointer-events:none}.dragging{cursor:grabbing!important}.box.expanded{left:0!important;top:0!important;width:100vw!important;height:100dvh!important;max-width:none;max-height:none;min-width:0;min-height:0;border:0;border-radius:0;resize:none;padding-bottom:0}.box.expanded .hint{display:none}.box.expanded .handle{cursor:default}.box{border-radius:16px;box-shadow:0 24px 80px #10233f40}.handle{background:linear-gradient(110deg,#10243f,#203e60);padding:12px 14px;min-height:60px}.handle strong{font-size:15px;letter-spacing:-.3px}.handle small{font-size:11px;color:#cedbed;margin-top:4px}.controls button{width:34px;height:34px;border-radius:9px}.bubble{background:#142d4e;border:0}.brand-title{position:relative;padding-left:42px}.brand-mark{position:absolute;left:0;top:0;width:34px;height:34px}.brand-mark svg{width:100%;height:100%}.hint{font:10px Segoe UI,Arial;color:#67809d;text-align:right;padding:0 7px;position:absolute;bottom:0;right:5px;pointer-events:none}`;
  const bubble=document.createElement('button');bubble.className='bubble';bubble.type='button';bubble.title='Abrir chat de NexoMail · arrastra para mover';bubble.setAttribute('aria-label','Abrir chat de NexoMail. Puedes arrastrar la burbuja o moverla con las flechas.');bubble.setAttribute('aria-expanded','false');bubble.setAttribute('aria-controls','emailagent-floating-chat');
  // Constant local icon; no email or webpage data is inserted as markup.
  bubble.innerHTML="<svg xmlns=\"http://www.w3.org/2000/svg\" viewBox=\"0 0 256 256\" fill=\"none\"><rect x=\"8\" y=\"8\" width=\"240\" height=\"240\" rx=\"58\" fill=\"#142d4e\"/><rect x=\"48\" y=\"68\" width=\"160\" height=\"120\" rx=\"22\" stroke=\"#f1f6ff\" stroke-width=\"12\"/><path d=\"M54 78l74 56 74-56\" stroke=\"#f1f6ff\" stroke-width=\"12\" stroke-linecap=\"round\" stroke-linejoin=\"round\"/><path d=\"M80 164v-46l96 46v-46\" stroke=\"#48d6c2\" stroke-width=\"13\" stroke-linecap=\"round\" stroke-linejoin=\"round\"/></svg>";
  const box=document.createElement('section');box.id='emailagent-floating-chat';box.className='box';box.hidden=true;box.setAttribute('role','dialog');box.setAttribute('aria-label',`Chat de NexoMail para ${provider==='gmail'?'Gmail':'Outlook'}`);box.setAttribute('aria-modal','false');
  const handle=document.createElement('header');handle.className='handle';handle.tabIndex=0;handle.setAttribute('aria-label','Mover ventana de chat. Arrastra o usa las flechas.');
  const title=document.createElement('div');const name=document.createElement('strong');name.textContent='NexoMail';const caption=document.createElement('small');caption.textContent=(provider==='gmail'?'Gmail':'Outlook')+' · Asistente de correo · v'+extensionVersion;title.append(name,caption);const brandMark=document.createElement('span');brandMark.className='brand-mark';brandMark.innerHTML="<svg xmlns=\"http://www.w3.org/2000/svg\" viewBox=\"0 0 256 256\" fill=\"none\"><rect x=\"8\" y=\"8\" width=\"240\" height=\"240\" rx=\"58\" fill=\"#142d4e\"/><rect x=\"48\" y=\"68\" width=\"160\" height=\"120\" rx=\"22\" stroke=\"#f1f6ff\" stroke-width=\"12\"/><path d=\"M54 78l74 56 74-56\" stroke=\"#f1f6ff\" stroke-width=\"12\" stroke-linecap=\"round\" stroke-linejoin=\"round\"/><path d=\"M80 164v-46l96 46v-46\" stroke=\"#48d6c2\" stroke-width=\"13\" stroke-linecap=\"round\" stroke-linejoin=\"round\"/></svg>";title.className='brand-title';title.prepend(brandMark);
  const controls=document.createElement('div');controls.className='controls';
  function control(text,label,action){const button=document.createElement('button');button.type='button';button.textContent=text;button.title=label;button.setAttribute('aria-label',label);button.addEventListener('click',action);controls.append(button);return button;}
  control('⚙','Opciones de NexoMail',()=>chrome.runtime.sendMessage({type:'EMAILAGENT_OPTIONS'}).catch(()=>{}));
  const expandButton=control('⛶','Pantalla completa',()=>toggleExpanded());
  expandButton.setAttribute('aria-pressed','false');
  control('−','Minimizar chat',()=>minimize());
  const frame=document.createElement('iframe');frame.title=`Asistente flotante de ${provider==='gmail'?'Gmail':'Outlook'}`;
  const hint=document.createElement('span');hint.className='hint';hint.textContent='↘ Cambiar tamaño';
  const shellStatus=document.createElement('div');shellStatus.className='shell-status';shellStatus.setAttribute('role','status');
  const shellText=document.createElement('p');shellText.textContent='Abriendo NexoMail…';
  const retryShell=document.createElement('button');retryShell.type='button';retryShell.textContent='Volver a abrir';retryShell.hidden=true;retryShell.addEventListener('click',()=>loadShell());
  const reloadTab=document.createElement('button');reloadTab.type='button';reloadTab.textContent='Recargar pestaña del correo';reloadTab.hidden=true;reloadTab.addEventListener('click',()=>location.reload());
  shellStatus.append(shellText,retryShell,reloadTab);
  handle.append(title,controls);box.append(handle,shellStatus,frame,hint);shadow.append(style,box,bubble);document.documentElement.append(host);

  let ball={x:innerWidth-80,y:innerHeight-82};
  let expanded=false,previousWindow=null;
  function sendDisplayMode(){if(initialized)frame.contentWindow.postMessage({type:'EMAILAGENT_DISPLAY_MODE',expanded,bridge},extensionOrigin);}
  frame.addEventListener('load',sendDisplayMode);
  let position=null,initialized=false,interacted=false,lastDrag=0,persistTimer,shellTimer;
  async function loadShell(){
    clearTimeout(shellTimer);shellStatus.hidden=false;retryShell.hidden=true;reloadTab.hidden=true;shellText.textContent='Abriendo NexoMail…';
    await pageSync;
    frame.src=extensionOrigin+'/floating.html?'+new URLSearchParams({provider,bridge,parentOrigin:location.origin,expanded:expanded?'1':'0',version:extensionVersion}).toString();
    initialized=true;
    shellTimer=setTimeout(()=>{shellStatus.hidden=false;shellText.textContent='NexoMail no pudo abrirse. Si acabas de actualizar la extensión, recarga esta pestaña del correo.';retryShell.hidden=false;reloadTab.hidden=false;},12000);
  }
  let pageSignature='',pageSync=Promise.resolve(),missingSince=0;
  function syncPageAccount(){
    if(document.hidden)return;
    const identity=readPageAccount(provider);
    if(!identity.email){if(!missingSince)missingSince=Date.now();if(Date.now()-missingSince<4000 && pageSignature)return;}else missingSince=0;
    const signature=identity.slot+':'+identity.email;
    if(signature===pageSignature)return;
    const wasInitialized=initialized;
    pageSignature=signature;
    if(wasInitialized){initialized=false;frame.src='about:blank';shellStatus.hidden=false;shellText.textContent='Identificando la cuenta del correo…';}
    pageSync=chrome.runtime.sendMessage({type:'EMAILAGENT_PAGE_ACCOUNT',bridge,...identity}).then(reply=>{if(!reply?.ok)throw new Error('No se pudo identificar la cuenta.');}).catch(()=>{});
    if(wasInitialized)loadShell();
  }
  syncPageAccount();
  const accountWatch=setInterval(()=>{if(!host.isConnected){clearInterval(accountWatch);return;}syncPageAccount();},2000);
  document.addEventListener('visibilitychange',()=>{if(!document.hidden)syncPageAccount();});
  // Prepare only a previously authorized session; this never opens an interactive login.
  pageSync.then(()=>{if(!initialized)loadShell();});
  const clamp=(value,min,max)=>Math.max(min,Math.min(value,Math.max(min,max)));
  function placeBubble(){ball.x=clamp(ball.x,10,innerWidth-68);ball.y=clamp(ball.y,10,innerHeight-68);bubble.style.left=ball.x+'px';bubble.style.top=ball.y+'px';}
  function placeBox(){if(expanded || !position)return;const rect=box.getBoundingClientRect();position.x=clamp(position.x,10,innerWidth-rect.width-10);position.y=clamp(position.y,10,innerHeight-rect.height-10);box.style.left=position.x+'px';box.style.top=position.y+'px';}
  function save(){clearTimeout(persistTimer);if(expanded)return;persistTimer=setTimeout(()=>{if(expanded)return;const rect=box.getBoundingClientRect();const geometry={bubble:{x:ball.x/Math.max(1,innerWidth-58),y:ball.y/Math.max(1,innerHeight-58)},window:position?{x:position.x/Math.max(1,innerWidth),y:position.y/Math.max(1,innerHeight),width:box.hidden?parseFloat(box.style.width):rect.width,height:box.hidden?parseFloat(box.style.height):rect.height}:null};chrome.storage.local.set({[storageKey]:geometry}).catch(()=>{});},200);}
  function open(){interacted=true;if(!initialized)loadShell();box.hidden=false;bubble.hidden=true;bubble.setAttribute('aria-expanded','true');if(!position){const width=Math.min(430,innerWidth-20),height=Math.min(640,innerHeight-24);box.style.width=width+'px';box.style.height=height+'px';position={x:ball.x+58-width,y:ball.y-height-12};}placeBox();handle.focus({preventScroll:true});}
  function toggleExpanded(){
    if(!expanded){const rect=box.getBoundingClientRect();previousWindow={x:position.x,y:position.y,width:rect.width,height:rect.height};expanded=true;box.classList.add('expanded');}
    else{expanded=false;box.classList.remove('expanded');if(previousWindow){position={x:previousWindow.x,y:previousWindow.y};box.style.width=previousWindow.width+'px';box.style.height=previousWindow.height+'px';}placeBox();save();}
    const label=expanded?'Restaurar tamaño':'Pantalla completa';expandButton.textContent=expanded?'❐':'⛶';expandButton.title=label;expandButton.setAttribute('aria-label',label);expandButton.setAttribute('aria-pressed',String(expanded));
    sendDisplayMode();
  }
  function minimize(){box.hidden=true;bubble.hidden=false;bubble.setAttribute('aria-expanded','false');placeBubble();bubble.focus({preventScroll:true});save();}
  bubble.addEventListener('click',()=>{if(Date.now()-lastDrag<300)return;open();});

  function draggable(element,kind){let drag=null;
    element.addEventListener('pointerdown',event=>{if((kind==='window' && expanded) || event.button!==0 || event.target.closest('button') && kind!=='bubble')return;interacted=true;const origin=kind==='bubble'?ball:position;drag={id:event.pointerId,x:event.clientX,y:event.clientY,start:{...origin},moved:false};element.setPointerCapture(event.pointerId);if(kind!=='bubble')event.preventDefault();});
    element.addEventListener('pointermove',event=>{if(!drag || event.pointerId!==drag.id)return;const dx=event.clientX-drag.x,dy=event.clientY-drag.y;if(!drag.moved && Math.hypot(dx,dy)<5)return;drag.moved=true;event.preventDefault();element.classList.add('dragging');box.classList.add('dragging');if(kind==='bubble'){ball={x:drag.start.x+dx,y:drag.start.y+dy};placeBubble();}else{position={x:drag.start.x+dx,y:drag.start.y+dy};placeBox();}});
    const end=event=>{if(!drag || event.pointerId!==drag.id)return;if(drag.moved)lastDrag=Date.now();drag=null;element.classList.remove('dragging');box.classList.remove('dragging');if(element.hasPointerCapture(event.pointerId))element.releasePointerCapture(event.pointerId);save();};
    element.addEventListener('pointerup',end);element.addEventListener('pointercancel',end);element.addEventListener('lostpointercapture',end);
    element.addEventListener('keydown',event=>{if((kind==='window' && expanded) || event.target!==element || !['ArrowLeft','ArrowRight','ArrowUp','ArrowDown'].includes(event.key))return;event.preventDefault();interacted=true;const target=kind==='bubble'?ball:position;if(!target)return;target.x+=(event.key==='ArrowRight'?12:event.key==='ArrowLeft'?-12:0);target.y+=(event.key==='ArrowDown'?12:event.key==='ArrowUp'?-12:0);if(kind==='bubble')placeBubble();else placeBox();save();});
  }
  draggable(bubble,'bubble');draggable(handle,'window');placeBubble();
  const observer=new ResizeObserver(()=>{if(!box.hidden){placeBox();save();}});observer.observe(box);
  window.addEventListener('resize',()=>{placeBubble();if(!box.hidden)placeBox();});
  shadow.addEventListener('keydown',event=>{if(event.key==='Escape' && !box.hidden){event.stopPropagation();minimize();}});
  window.addEventListener('message',event=>{
    if(event.source!==frame.contentWindow || event.origin!==extensionOrigin || event.data?.bridge!==bridge)return;
    if(event.data.type==='EMAILAGENT_MINIMIZE')minimize();
    if(event.data.type==='EMAILAGENT_DISPLAY_READY'){clearTimeout(shellTimer);shellStatus.hidden=true;sendDisplayMode();}
  });
  chrome.runtime.onMessage.addListener((message,sender,reply)=>{if(sender.id===chrome.runtime.id && message?.type==='EMAILAGENT_TOGGLE_FLOATING'){if(box.hidden)open();else minimize();reply({ok:true});}});
  chrome.runtime.onMessage.addListener((message,sender,reply)=>{if(sender.id===chrome.runtime.id && message?.type==='EMAILAGENT_READ_PAGE_ACCOUNT' && message.bridge===bridge){reply(readPageAccount(provider));}});
  chrome.storage.local.get(storageKey).then(saved=>{if(interacted)return;const geometry=saved[storageKey];if(!geometry)return;if(Number.isFinite(geometry.bubble?.x) && Number.isFinite(geometry.bubble?.y)){ball={x:geometry.bubble.x*Math.max(1,innerWidth-58),y:geometry.bubble.y*Math.max(1,innerHeight-58)};placeBubble();}if(geometry.window && Number.isFinite(geometry.window.x) && Number.isFinite(geometry.window.y) && Number.isFinite(geometry.window.width) && Number.isFinite(geometry.window.height)){position={x:geometry.window.x*innerWidth,y:geometry.window.y*innerHeight};box.style.width=clamp(geometry.window.width,Math.min(320,innerWidth-20),innerWidth-20)+'px';box.style.height=clamp(geometry.window.height,Math.min(350,innerHeight-24),innerHeight-24)+'px';}}).catch(()=>{});
})();
