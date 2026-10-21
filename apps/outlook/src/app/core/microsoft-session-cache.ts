import type {AccountInfo} from '@azure/msal-browser';

interface Snapshot {version:1;email:string;homeAccountId:string;accountKey:string;accountValue:string;tokens:{key:string;value:string;kind:'idToken'|'accessToken'|'refreshToken'}[]}
const parse=(value:string|null):any=>{try{return value?JSON.parse(value):null;}catch{return null;}};
/** Export only stable MSAL records. PKCE requests and interaction-in-progress flags stay transient. */
export function captureSession(clientId:string,account:AccountInfo):Snapshot|null{
  const accounts=parse(sessionStorage.getItem('msal.account.keys'));
  if(!Array.isArray(accounts))return null;
  const accountKey=accounts.find((key:unknown)=>{
    if(typeof key!=='string')return false;
    const record=parse(sessionStorage.getItem(key));
    return record?.homeAccountId===account.homeAccountId && record?.username?.toLowerCase()===account.username.toLowerCase();
  });
  if(!accountKey)return null;
  const index=parse(sessionStorage.getItem('msal.token.keys.'+clientId));
  const tokens:Snapshot['tokens']=[];
  for(const kind of ['idToken','accessToken','refreshToken'] as const){
    for(const key of Array.isArray(index?.[kind])?index[kind]:[]){
      if(typeof key!=='string')continue;
      const value=sessionStorage.getItem(key),record=parse(value);
      if(value && record?.homeAccountId===account.homeAccountId && record?.clientId?.toLowerCase()===clientId.toLowerCase())tokens.push({key,value,kind});
    }
  }
  return {version:1,email:account.username.toLowerCase(),homeAccountId:account.homeAccountId,accountKey,accountValue:sessionStorage.getItem(accountKey)!,tokens};
}
export function hydrateSession(clientId:string,snapshot:Snapshot):void{
  const accounts=parse(sessionStorage.getItem('msal.account.keys'));
  const index=parse(sessionStorage.getItem('msal.token.keys.'+clientId)) || {};
  sessionStorage.setItem(snapshot.accountKey,snapshot.accountValue);
  sessionStorage.setItem('msal.account.keys',JSON.stringify([...new Set([...(Array.isArray(accounts)?accounts:[]),snapshot.accountKey])]));
  for(const token of snapshot.tokens){
    sessionStorage.setItem(token.key,token.value);
    index[token.kind]=[...new Set([...(Array.isArray(index[token.kind])?index[token.kind]:[]),token.key])];
  }
  for(const kind of ['idToken','accessToken','refreshToken'])if(!Array.isArray(index[kind]))index[kind]=[];
  sessionStorage.setItem('msal.token.keys.'+clientId,JSON.stringify(index));
}
