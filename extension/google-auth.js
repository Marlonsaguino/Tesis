// Google authorization for Chrome, Edge and Brave: reuse the session and renew
// through a non-interactive OAuth window when Google can authorize it silently.
const META='emailagent.google.account';
const CACHE='emailagent.google.access';
const ATTEMPT='emailagent.google.loginAttempt';
const SCOPES=['https://www.googleapis.com/auth/gmail.modify','https://www.googleapis.com/auth/gmail.send'];

export async function installGoogleAuth(host){
  let metadata=(await chrome.storage.local.get(META))[META] || null;

  chrome.storage.onChanged.addListener((changes,area)=>{
    if(area==='local' && changes[META])metadata=changes[META].newValue || null;
  });
  host.googleSessionId=()=>metadata?.sessionId || '';

  async function authorize(clientId,{interactive,email}={interactive:true}){
    if(!clientId?.endsWith('.apps.googleusercontent.com'))throw new Error('Configura el Client ID de Google en las opciones de EmailAgent.');
    const state=crypto.randomUUID(),redirect=chrome.identity.getRedirectURL('google');
    const params={client_id:clientId,redirect_uri:redirect,response_type:'token',scope:SCOPES.join(' '),state,prompt:interactive?'select_account consent':'none'};
    if(email)params.login_hint=email;
    const url=new URL('https://accounts.google.com/o/oauth2/v2/auth');url.search=new URLSearchParams(params).toString();
    let response;
    try{response=await chrome.identity.launchWebAuthFlow({url:url.href,interactive,...(!interactive?{abortOnLoadForNonInteractive:false,timeoutMsForNonInteractive:10000}:{})});}
    catch{throw new Error(interactive?'Google no completó la autorización. Revisa el Client ID y la dirección de retorno.':'Google necesita que confirmes tu sesión. Pulsa Reautorizar con Google; no necesitas pegar un token.');}
    if(!response || !response.startsWith(redirect+'#'))throw new Error('Google no devolvió una autorización válida.');
    const result=new URLSearchParams(new URL(response).hash.slice(1));
    if(result.get('state')!==state)throw new Error('La respuesta de autorización no coincide con la solicitud.');
    if(result.get('error'))throw new Error('Google requiere autorización. Pulsa Reautorizar con Google.');
    const accessToken=result.get('access_token');
    const granted=new Set((result.get('scope') || '').split(' '));
    if(!accessToken || SCOPES.some(scope=>!granted.has(scope)))throw new Error('Google no concedió los permisos necesarios de Gmail.');
    const seconds=Number(result.get('expires_in') || 3600);
    if(!Number.isFinite(seconds) || seconds<=0)throw new Error('La autorización de Google no tiene una vigencia válida.');
    const res=await fetch('https://gmail.googleapis.com/gmail/v1/users/me/profile',{headers:{Authorization:`Bearer ${accessToken}`},signal:AbortSignal.timeout(15000)});
    if(!res.ok)throw new Error('No se pudo verificar la cuenta autorizada de Gmail.');
    const profile=await res.json();
    if(!profile.emailAddress)throw new Error('Google no devolvió el correo de la cuenta autorizada.');
    if(email && profile.emailAddress.toLowerCase()!==email.toLowerCase())throw new Error('Google devolvió otra cuenta. No se cambiará de cuenta automáticamente.');
    return {accessToken,expiresAt:Date.now()+seconds*1000,email:profile.emailAddress,clientId};
  }

  const ACCOUNTS='nexomail.google.accounts',TOKENS='nexomail.google.tokens',BLOCKED='nexomail.google.disconnected';
  const keyFor=(email,client)=>client+':'+email.toLowerCase();
  async function records(){
    const values=await chrome.storage.local.get([ACCOUNTS,META]);
    const all=values[ACCOUNTS] || {};
    const old=values[META];
    if(old?.email && !all[keyFor(old.email,old.clientId)])all[keyFor(old.email,old.clientId)]=old;
    return all;
  }
  async function cache(account){
    const tokens=(await chrome.storage.session.get(TOKENS))[TOKENS] || {};
    let value=tokens[account.sessionId];
    if(!value){const legacy=(await chrome.storage.session.get(CACHE))[CACHE];if(legacy?.sessionId===account.sessionId)value=legacy;}
    return value;
  }
  let writes=Promise.resolve();
  function queued(work){const next=writes.then(work,work);writes=next.catch(()=>{});return next;}
  function store(auth,account){return queued(async()=>{
    const blocked=(await chrome.storage.local.get(BLOCKED))[BLOCKED] || {};
    if(blocked[keyFor(account.email,account.clientId)])throw new Error('La cuenta se desconectó durante la recuperación.');
    const all=await records();all[keyFor(account.email,account.clientId)]=account;
    await chrome.storage.local.set({[ACCOUNTS]:all});
    const tokens=(await chrome.storage.session.get(TOKENS))[TOKENS] || {};
    tokens[account.sessionId]={...auth,sessionId:account.sessionId};await chrome.storage.session.set({[TOKENS]:tokens});
    return {...auth,...account};
  });}
  const matches=(account,context)=>!context || !context.email || account.email.toLowerCase()===context.email;
  host.googleLogin=async(clientId,context)=>{
    const attempt=crypto.randomUUID(),attemptKey=ATTEMPT+':'+(context?.tabId || 'standalone');await chrome.storage.session.set({[attemptKey]:attempt});
    const auth=await authorize(clientId,{interactive:true,email:context?.email || undefined});
    if((await chrome.storage.session.get(attemptKey))[attemptKey]!==attempt)throw new Error('La autorización se sustituyó o se canceló.');
    const account={clientId,email:auth.email,sessionId:crypto.randomUUID()};
    const blocked=(await chrome.storage.local.get(BLOCKED))[BLOCKED] || {};delete blocked[keyFor(auth.email,clientId)];await chrome.storage.local.set({[BLOCKED]:blocked});
    return store(auth,account);
  };
  host.googleRestore=async(context)=>{
    const clientId=host.config.googleClientId;
    const all=await records();
    // An embedded module never guesses which of several site accounts to use.
    const expected=context?.email || (!context?(await chrome.storage.local.get(META))[META]?.email:'');
    if(!expected || !clientId)return null;
    let account=all[keyFor(expected,clientId)];
    const blocked=(await chrome.storage.local.get(BLOCKED))[BLOCKED] || {};
    if(blocked[keyFor(expected,clientId)])return null;
    if(!account){
      try{const auth=await authorize(clientId,{interactive:false,email:expected});account={clientId,email:auth.email,sessionId:crypto.randomUUID()};return await store(auth,account);}catch{return null;}
    }
    const token=await cache(account);
    return {...account,accessToken:token?.accessToken || '',expiresAt:token?.expiresAt || 0};
  };
  const renewals=new Map();
  host.googleAccessToken=async(expectedSession,context)=>{
    const all=await records();
    const account=Object.values(all).find(value=>value.sessionId===expectedSession);
    if(!account || !matches(account,context))throw new Error('La cuenta de la página cambió. Vuelve a abrir NexoMail.');
    const blocked=(await chrome.storage.local.get(BLOCKED))[BLOCKED] || {};
    if(blocked[keyFor(account.email,account.clientId)])throw new Error('Esta cuenta se desconectó. Conéctala de nuevo para continuar.');
    const token=await cache(account);
    if(token?.expiresAt>Date.now()+60000)return token.accessToken;
    if(renewals.has(expectedSession))return renewals.get(expectedSession);
    const promise=(async()=>{
      const auth=await authorize(account.clientId,{interactive:false,email:account.email});
      const latest=await records();if(latest[keyFor(account.email,account.clientId)]?.sessionId!==expectedSession)throw new Error('La sesión cambió durante la renovación.');
      await store(auth,account);return auth.accessToken;
    })();renewals.set(expectedSession,promise);
    try{return await promise;}finally{renewals.delete(expectedSession);}
  };
  host.googleInvalidateToken=async(token)=>{
    const tokens=(await chrome.storage.session.get(TOKENS))[TOKENS] || {};
    for(const [key,value] of Object.entries(tokens))if(value.accessToken===token)delete tokens[key];
    await chrome.storage.session.set({[TOKENS]:tokens});
    const legacy=(await chrome.storage.session.get(CACHE))[CACHE];if(legacy?.accessToken===token)await chrome.storage.session.remove(CACHE);
  };
  host.googleDisconnect=async(sessionId,context)=>{
    const all=await records();const current=Object.values(all).find(account=>account.sessionId===sessionId);const expected=context?.email || current?.email;
    if(!expected)return;
    const blocked=(await chrome.storage.local.get(BLOCKED))[BLOCKED] || {};
    for(const [key,account] of Object.entries(all)){if(account.email.toLowerCase()===expected.toLowerCase()){blocked[key]=true;delete all[key];}}
    await chrome.storage.local.set({[ACCOUNTS]:all,[BLOCKED]:blocked});
    // Do not reimport a legacy record after an explicit disconnection.
    const legacy=(await chrome.storage.local.get(META))[META];if(!expected || legacy?.email?.toLowerCase()===expected)await chrome.storage.local.remove(META);
  };
}
