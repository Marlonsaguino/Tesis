import {environment} from './environments/environment';
import { bootstrapApplication } from '@angular/platform-browser';
import { appConfig } from './app/app.config';
import { AppComponent } from './app/app.component';

window.emailAgentHost.ready.then(()=>{const cfg=window.emailAgentHost.config;environment.apiBaseUrl=cfg.apiBaseUrl;environment.azure.clientId=cfg.microsoftClientId;environment.azure.authority='https://login.microsoftonline.com/'+(['consumers','common','organizations'].includes(cfg.microsoftTenant)?cfg.microsoftTenant:'common');environment.azure.redirectUri=window.emailAgentHost.microsoftRedirect();return bootstrapApplication(AppComponent,appConfig);})
  .catch((err) => console.error(err));
