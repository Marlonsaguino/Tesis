import { Component, type ReactNode } from 'react';

export class StartupBoundary extends Component<{children:ReactNode},{failed:boolean}>{
  state={failed:false};
  static getDerivedStateFromError(){return {failed:true};}
  componentDidCatch(){
    const bridge=new URLSearchParams(location.search).get('bridge');
    if(bridge && window.parent!==window)window.parent.postMessage({type:'EMAILAGENT_APP_ERROR',bridge},location.origin);
  }
  render(){
    if(this.state.failed)return <section role="alert" className="workspace-card"><h2>No se pudo abrir Gmail en NexoMail</h2><p>Recarga la pestaña del correo para cargar la versión actual de la extensión.</p><button type="button" className="workspace-button" onClick={()=>location.reload()}>Volver a abrir</button></section>;
    return this.props.children;
  }
}
