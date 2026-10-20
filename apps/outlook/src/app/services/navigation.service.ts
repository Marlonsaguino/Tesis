import { Injectable, signal } from '@angular/core';
import { NavSection, NavItem } from '../models/outlook.model';

@Injectable({ providedIn: 'root' })
export class NavigationService {
  /** Sección activa seleccionada */
  readonly activeSection = signal<NavSection>(new URLSearchParams(location.search).get('floating')==='1'?'agente':'bandeja');
  readonly sidebarOpen   = signal<boolean>(new URLSearchParams(location.search).get('floating')!=='1');

  readonly navItems: NavItem[] = [
    { id: 'bandeja',       label: 'Bandeja de Entrada', icon: 'bi-inbox-fill',         real: true  },
    { id: 'agente',        label: 'Chat del Agente',    icon: 'bi-robot',              real: true  },
    { id: 'acciones',      label: 'Acciones Pendientes', icon: 'bi-shield-check',      real: true  },
    { id: 'auditoria',     label: 'Auditoría',          icon: 'bi-journal-text',       real: true  },
    { id: 'inicio',        label: 'Resumen General',    icon: 'bi-speedometer2',       real: true  },
    { id: 'configuracion', label: 'Configuración',      icon: 'bi-gear-fill',          real: true  },
  ];

  constructor(){
    const params=new URLSearchParams(location.search),bridge=params.get('bridge');
    if(params.get('floating')!=='1' || !bridge)return;
    window.addEventListener('message',(event:MessageEvent)=>{
      if(event.source!==window.parent || event.origin!==location.origin || event.data?.bridge!==bridge || event.data.type!=='EMAILAGENT_NAV')return;
      const sections:Record<string,NavSection>={chat:'agente',mail:'bandeja',actions:'acciones',history:'auditoria',settings:'configuracion'};
      const section=sections[event.data.section];if(section)this.navigateTo(section);
    });
  }

  navigateTo(section: NavSection): void {
    this.activeSection.set(section);
  }

  toggleSidebar(): void {
    this.sidebarOpen.update(v => !v);
  }

  closeSidebarOnMobile(): void {
    if (window.innerWidth < 992) {
      this.sidebarOpen.set(false);
    }
  }
}
