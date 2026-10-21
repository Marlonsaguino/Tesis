import { Mail, RefreshCw, Sun, Moon, ShieldCheck } from 'lucide-react';
interface HeaderProps {strictMode:boolean;onToggleStrictMode:()=>void;pendingCount:number;totalEmails:number;unreadCount:number;onRefresh:()=>void;isGmailConnected:boolean;onOpenGmailAuth:()=>void;onOpenSettings:()=>void;theme:'dark'|'light';onToggleTheme:()=>void}
export function Header(p:HeaderProps){
  return <header className="workspace-topbar">
    <div className="workspace-brand"><img src="./nexomail.svg" width="34" height="34" alt=""/><strong>NexoMail</strong><span className="workspace-provider">GMAIL</span></div>
    <button type="button" className={`workspace-connection ${p.isGmailConnected?'connected':''}`} onClick={p.onOpenGmailAuth} title={p.isGmailConnected?"Gestionar cuenta de Gmail":"Conectar con Google"}><span className="connection-dot"/><Mail size={14}/>{p.isGmailConnected?'Gmail real':window.emailAgentHost.pageAccount?'Conectar Gmail':'Demostración'}</button>
    <div className="workspace-topbar-actions"><span className="workspace-mail-count">{p.totalEmails} correos · {p.unreadCount} sin leer</span>{p.pendingCount>0 && <span className="workspace-pending-count">{p.pendingCount} pendientes</span>}
      <button type="button" className="workspace-icon" onClick={p.onToggleStrictMode} aria-pressed={p.strictMode} aria-label="Activar o desactivar revisión estricta" title={p.strictMode?'Revisión estricta activada':'Revisión estricta desactivada'}><ShieldCheck size={17}/></button>
      <button type="button" className="workspace-icon" onClick={p.onToggleTheme} aria-label={p.theme==='light'?'Activar tema oscuro':'Activar tema claro'} title="Cambiar apariencia">{p.theme==='light'?<Moon size={17}/>:<Sun size={17}/>}</button>
      <button type="button" className="workspace-icon" onClick={p.onRefresh} aria-label="Sincronizar correos" title="Sincronizar correos"><RefreshCw size={17}/></button>
      <button type="button" className="workspace-button" onClick={p.onOpenSettings}>Configuración</button>
    </div>
  </header>;
}
