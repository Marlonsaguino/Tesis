import {Injectable} from '@angular/core';
import {defer,from} from 'rxjs';
import {MSALInstanceFactory} from './msal.config';
import {environment} from '../../environments/environment';
import {EventType,AuthenticationResult,AccountInfo} from '@azure/msal-browser';
import {captureSession,hydrateSession} from './microsoft-session-cache';
@Injectable()
export class ExtensionMsalService {
 readonly instance=MSALInstanceFactory();
 private flowPending=false;
 constructor(){
   this.instance.addEventCallback(event=>{
     if(event.eventType===EventType.ACQUIRE_TOKEN_SUCCESS || event.eventType===EventType.LOGIN_SUCCESS){
       const account=(event.payload as AuthenticationResult|null)?.account;
       if(account)void this.checkpoint(account).catch(()=>{});
     }
   });
 }
 async restoreSessionCache():Promise<string|null>{
   try{
     const snapshot=await window.emailAgentHost.microsoftSession('get');
     if(!snapshot)return null;
     hydrateSession(environment.azure.clientId,snapshot);return snapshot.email;
   }catch{return null;}
 }
 private async checkpoint(account:AccountInfo):Promise<void>{
   const snapshot=captureSession(environment.azure.clientId,account);
   if(snapshot)await window.emailAgentHost.microsoftSession('set',snapshot);
 }
 private async flow(request:any,login:boolean,interactive=true):Promise<any>{
   if(this.flowPending)throw new Error('Ya hay una autorización de Microsoft en curso. Completa o cierra esa ventana antes de volver a intentarlo.');
   this.flowPending=true;
   try{
   let authorizationUrl='';
   const redirectRequest={...request,redirectUri:window.emailAgentHost.microsoftRedirect(),responseMode:'fragment',onRedirectNavigate:(url:string)=>{authorizationUrl=url;return false;}};
   await this.instance.handleRedirectPromise();
   if(login)await this.instance.loginRedirect(redirectRequest);else await this.instance.acquireTokenRedirect(redirectRequest);
   if(!authorizationUrl)throw new Error('Microsoft no preparó la autorización.');
   let response:string|undefined;
   try {response=await window.emailAgentHost.microsoftFlow(authorizationUrl,interactive);}catch(error){const state=new URL(authorizationUrl).searchParams.get('state') || '';try{await this.instance.handleRedirectPromise('#error=access_denied&error_description=Cancelled&state='+encodeURIComponent(state));}catch{}throw error;}
   const redirect=window.emailAgentHost.microsoftRedirect();
   if(!response || !response.startsWith(redirect+'#'))throw new Error('La autorización se canceló o no devolvió una respuesta válida.');
   const result=await this.instance.handleRedirectPromise(new URL(response).hash);
   if(!result?.account)throw new Error('Microsoft no devolvió una cuenta autorizada.');
   const expected=window.emailAgentHost.pageAccount?.email;
   if(expected && result.account.username.toLowerCase()!==expected.toLowerCase()){await this.instance.clearCache({account:result.account});throw new Error('La cuenta autorizada no coincide con la página de Outlook.');}
   this.instance.setActiveAccount(result.account);await window.emailAgentHost.microsoftRemember(result.account.username);
   await this.checkpoint(result.account).catch(()=>{});return result;
   }finally{this.flowPending=false;}
 }
 async restoreAccount(email:string){if(!email || !(await window.emailAgentHost.microsoftAutoAllowed(email)))return null;return this.flow({scopes:environment.azure.scopes,loginHint:email,prompt:'none'},true,false);}
 loginPopup(request:any){return defer(()=>from(this.flow({...request,loginHint:window.emailAgentHost.pageAccount?.email || request?.loginHint},true)));}
 acquireTokenPopup(request:any){return defer(()=>from(this.flow(request,false)));}
 logoutPopup(request:any){return defer(()=>from((async()=>{if(request?.account?.username){await window.emailAgentHost.microsoftRemember(request.account.username,true);await window.emailAgentHost.microsoftSession('clear',undefined,request.account.username).catch(()=>{});}await this.instance.clearCache({account:request?.account});})()));}
}
