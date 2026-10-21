(() => {
  const savedTheme=localStorage.getItem('theme');document.documentElement.setAttribute('data-theme',savedTheme==='light'?'light':'dark');
  const host={config:null,pageAccount:null};let googleAccount=null;
  const contextKey=new URLSearchParams(location.search).get('bridge') || '';
  chrome.storage.onChanged.addListener((changes,area)=>{if(area==='local' && changes['nexomail.google.accounts'] && googleAccount){const records=changes['nexomail.google.accounts'].newValue || {};if(!Object.values(records).some(record=>record.sessionId===googleAccount.sessionId))googleAccount=null;}});
  host.ready=(async()=>{const {loadConfiguration}=await import(chrome.runtime.getURL('configuration.js'));host.config=await loadConfiguration();if(contextKey){const context=await chrome.runtime.sendMessage({type:'EMAILAGENT_GET_PAGE_ACCOUNT',bridge:contextKey});if(!context?.ok)throw new Error('No se pudo identificar la pestaña del correo.');host.pageAccount=context.value;}return host.config;})();
  for(const method of ['googleLogin','googleRestore','googleAccessToken','googleInvalidateToken','googleDisconnect']){
    host[method]=async(...args)=>{
      if(method==='googleDisconnect')args=[googleAccount?.sessionId || ''];
      const result=await chrome.runtime.sendMessage({type:'EMAILAGENT_GOOGLE_AUTH',method,args,contextKey});
      if(!result?.ok)throw new Error(result?.error || 'Recarga la extensión para recuperar la sesión de Google.');
      if((method==='googleLogin' || method==='googleRestore') && result.value)googleAccount=result.value;
      if(method==='googleDisconnect')googleAccount=null;
      return result.value;
    };
  }
  host.googleSessionId=()=>googleAccount?.sessionId || '';
  host.validatePageAccount=async(email)=>{if(!contextKey)return;const result=await chrome.runtime.sendMessage({type:'EMAILAGENT_VALIDATE_PAGE_ACCOUNT',bridge:contextKey,email});if(!result?.ok)throw new Error('La cuenta de la página cambió. Vuelve a abrir NexoMail.');};
  host.microsoftFlow=(url,interactive=true)=>chrome.identity.launchWebAuthFlow({url,interactive,...(!interactive?{abortOnLoadForNonInteractive:false,timeoutMsForNonInteractive:10000}:{})});
  host.microsoftAutoAllowed=async(email)=>!(await chrome.storage.local.get('nexomail.microsoft.disconnected'))['nexomail.microsoft.disconnected']?.[email.toLowerCase()];
  host.microsoftRemember=async(email,disconnected=false)=>{const key='nexomail.microsoft.disconnected',records=(await chrome.storage.local.get(key))[key] || {};records[email.toLowerCase()]=disconnected;await chrome.storage.local.set({[key]:records});};
  host.microsoftRedirect=()=>chrome.identity.getRedirectURL('microsoft');
  host.microsoftSession=async(method,snapshot,email)=>{
    const result=await chrome.runtime.sendMessage({type:'NEXOMAIL_MICROSOFT_SESSION',method,snapshot,email,contextKey});
    if(!result?.ok)throw new Error(result?.error || 'No se pudo recuperar la sesión temporal de Microsoft.');
    return result.value;
  };
  host.openOptions=()=>chrome.runtime.openOptionsPage();
  window.emailAgentHost=host;
})();
