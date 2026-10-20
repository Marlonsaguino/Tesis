import { 
  IPublicClientApplication, 
  PublicClientApplication, 
  BrowserCacheLocation, 
  LogLevel, 
  InteractionType 
} from '@azure/msal-browser';
import { 
  MsalInterceptorConfiguration, 
  MsalGuardConfiguration 
} from '@azure/msal-angular';
import { environment } from '../../environments/environment';

/**
 * Fábrica de la instancia de MSAL Browser con PKCE y almacenamiento exclusivo en SessionStorage.
 */
export function MSALInstanceFactory(): IPublicClientApplication {
  return new PublicClientApplication({
    auth: {
      clientId: environment.azure.clientId,
      authority: environment.azure.authority,
      redirectUri: environment.azure.redirectUri,
      postLogoutRedirectUri: environment.azure.redirectUri,
      navigateToLoginRequestUrl: false
    },
    cache: {
      // Requisito de seguridad: No usar localStorage, usar SessionStorage
      cacheLocation: BrowserCacheLocation.SessionStorage,
      storeAuthStateInCookie: false
    },
    system: {
      allowRedirectInIframe: true,
      loggerOptions: {
        loggerCallback: (level: LogLevel, message: string, containsPii: boolean) => {
          // Requisito estricto: No registrar tokens ni información sensible (PII)
          if (containsPii) {
            return;
          }
        },
        piiLoggingEnabled: false,
        logLevel: LogLevel.Warning
      }
    }
  });
}

/**
 * Configuración del interceptor HTTP para adjuntar tokens Bearer EXCLUSIVAMENTE a Microsoft Graph.
 * Las peticiones a FastAPI (/api/health) NO son interceptadas.
 */
export function MSALInterceptorConfigFactory(): MsalInterceptorConfiguration {
  const protectedResourceMap = new Map<string, Array<string> | null>();
  protectedResourceMap.set(environment.graph.baseUrl, environment.azure.scopes);

  return {
    interactionType: InteractionType.Popup,
    protectedResourceMap
  };
}

/**
 * Configuración de protección de rutas (MsalGuard).
 */
export function MSALGuardConfigFactory(): MsalGuardConfiguration {
  return {
    interactionType: InteractionType.Popup,
    authRequest: {
      scopes: environment.azure.scopes
    }
  };
}
