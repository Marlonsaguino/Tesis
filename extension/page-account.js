// Read only the identity shown in the account/header controls, never message text.
function readPageAccount(provider){
  const emails=new Set();
  const add=value=>{for(const match of (value || '').matchAll(/[A-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi))emails.add(match[0].toLowerCase());};
  const url=new URL(location.href);
  const hint=url.searchParams.get('authuser');if(hint?.includes('@'))add(hint);
  const roots=provider==='gmail'
    ?document.querySelectorAll('#gb,[aria-label^="Google Account"],[aria-label^="Cuenta de Google"]')
    :document.querySelectorAll('#mectrl,#O365_MainLink_Me,[role="banner"],header');
  for(const root of roots){
    const elements=[root,...root.querySelectorAll('[aria-label],[title],[data-upn]')].slice(0,200);
    for(const el of elements){
      const label=(el.getAttribute('aria-label') || '')+' '+(el.getAttribute('title') || '');
      if(/google|account|cuenta|profile|perfil|mectrl/i.test(label+' '+el.id))add(label);
      if(el.hasAttribute('data-upn'))add(el.getAttribute('data-upn'));
    }
  }
  const slot=provider==='gmail'?(url.pathname.match(/\/u\/([^/]+)/)?.[1] || hint || 'default'):(url.pathname.match(/\/mail\/([^/]+@[^/]+|\d+)(?:\/|$)/)?.[1] || 'default');
  return {email:emails.size===1?[...emails][0]:'',slot};
}
