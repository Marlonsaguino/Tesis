// Public application settings only. The local pairing value is preserved during migration.
const audienceVersion='nexomail.accountAudienceVersion';
export async function loadConfiguration(){
  const defaults=await (await fetch(chrome.runtime.getURL('config.json'))).json();
  const saved=await chrome.storage.local.get(['emailagentConfig',audienceVersion]);
  let config=saved.emailagentConfig || {};
  if((saved[audienceVersion] || 0)<1){
    // Version 1.6 enables personal and organizational Microsoft accounts as requested.
    config={...config,microsoftTenant:'common'};
    await chrome.storage.local.set({emailagentConfig:config,[audienceVersion]:1});
  }
  return {...defaults,...config,apiBaseUrl:'http://127.0.0.1:8000'};
}
