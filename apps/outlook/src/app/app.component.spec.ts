import { TestBed, ComponentFixture } from '@angular/core/testing';
import { AppComponent } from './app.component';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import {
  MSAL_INSTANCE,
  MSAL_GUARD_CONFIG,
  MSAL_INTERCEPTOR_CONFIG,
  MsalService,
  MsalBroadcastService
} from '@azure/msal-angular';
import {
  PublicClientApplication,
  LogLevel
} from '@azure/msal-browser';

// ─── Fábrica de instancia MSAL para tests ─────────────────────────────────────
function msalInstanceFactory() {
  return new PublicClientApplication({
    auth: {
      clientId: 'test-client-id',
      authority: 'https://login.microsoftonline.com/consumers',
      redirectUri: 'http://localhost:4200'
    },
    cache: { cacheLocation: 'sessionStorage' },
    system: {
      loggerOptions: {
        logLevel: LogLevel.Error,
        piiLoggingEnabled: false
      }
    }
  });
}

describe('AppComponent', () => {
  let fixture: ComponentFixture<AppComponent>;
  let component: AppComponent;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [AppComponent],
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        {
          provide: MSAL_INSTANCE,
          useFactory: msalInstanceFactory
        },
        {
          provide: MSAL_GUARD_CONFIG,
          useValue: {}
        },
        {
          provide: MSAL_INTERCEPTOR_CONFIG,
          useValue: {
            interactionType: 'popup',
            protectedResourceMap: new Map()
          }
        },
        MsalService,
        MsalBroadcastService
      ]
    }).compileComponents();

    fixture  = TestBed.createComponent(AppComponent);
    component = fixture.componentInstance;
  });

  it('debe crearse sin errores', () => {
    expect(component).toBeTruthy();
  });

  it('debe tener el nombre del proyecto correcto', () => {
    expect(component.projectName).toContain('EmailAgent AI');
  });

  it('debe inicializar el backend como cargando', () => {
    expect(component.isBackendLoading()).toBeTrue();
  });

  it('debe inicializar la sección activa en "bandeja"', () => {
    expect(component.nav.activeSection()).toBe('bandeja');
  });

  it('debe navegar a la sección de agente', () => {
    component.navigate('agente');
    expect(component.nav.activeSection()).toBe('agente');
  });

  it('debe tener los ítems de navegación configurados', () => {
    expect(component.nav.navItems.length).toBe(6);
  });

  it('debe alternar entre Modo Real y Modo Simulado', () => {
    expect(component.outlookService.operationMode()).toBe('real');
    component.toggleOperationMode();
    expect(component.outlookService.operationMode()).toBe('simulated');
  });
});
