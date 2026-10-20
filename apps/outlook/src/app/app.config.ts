import {ExtensionMsalService} from './core/extension-msal.service';
import {HttpInterceptorFn,withInterceptors} from '@angular/common/http';
const localAgentHeaders:HttpInterceptorFn=(req,next)=>{const cfg=window.emailAgentHost.config;return next(req.url.startsWith(cfg.apiBaseUrl+'/api/')?req.clone({setHeaders:{'X-EmailAgent-Token':cfg.pairingToken}}):req);};
import { ApplicationConfig, provideZoneChangeDetection } from '@angular/core';
import { provideHttpClient } from '@angular/common/http';
import { 
  MsalService, 
  MsalBroadcastService, 
  MsalGuard, 
  MSAL_INSTANCE, 
  MSAL_GUARD_CONFIG, 
  MSAL_INTERCEPTOR_CONFIG 
} from '@azure/msal-angular';
import { 
  MSALInstanceFactory, 
  MSALGuardConfigFactory, 
  MSALInterceptorConfigFactory 
} from './core/msal.config';

export const appConfig: ApplicationConfig = {
  providers: [
    provideZoneChangeDetection({ eventCoalescing: true }),
    provideHttpClient(withInterceptors([localAgentHeaders])),
    {provide:MsalService,useClass:ExtensionMsalService},
    MsalBroadcastService,
    MsalGuard,
    {
      provide: MSAL_INSTANCE,
      useFactory: MSALInstanceFactory
    },
    {
      provide: MSAL_GUARD_CONFIG,
      useFactory: MSALGuardConfigFactory
    },
    {
      provide: MSAL_INTERCEPTOR_CONFIG,
      useFactory: MSALInterceptorConfigFactory
    }
  ]
};
