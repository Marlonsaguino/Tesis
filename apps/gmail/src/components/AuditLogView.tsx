import { useState } from 'react';
import { History, Search } from 'lucide-react';
import type { AuditLog } from '../types/email';
export function AuditLogView({logs}:{logs:AuditLog[]}){
  const [query,setQuery]=useState('');
  const labels={AUTO_EXECUTED:'Consulta completada',HUMAN_APPROVED:'Aprobada',HUMAN_REJECTED:'Rechazada',FAILED:'Error'};
  const filtered=logs.filter(log=>`${log.actionType} ${log.prompt} ${log.details} ${labels[log.executionStatus]}`.toLowerCase().includes(query.toLowerCase()));
  return <><div className="workspace-section-heading"><History size={21}/><h2>Registro de auditoría y trazabilidad</h2></div><div className="workspace-page-body"><label className="gmail-search"><Search size={17}/><input value={query} onChange={event=>setQuery(event.target.value)} placeholder="Buscar por acción, descripción o resultado…" aria-label="Buscar en auditoría"/></label><p className="workspace-muted">Eventos de esta sesión. {filtered.length} resultados.</p><div className="gmail-audit-table-wrap"><table className="gmail-audit-table"><thead><tr><th>Fecha / hora</th><th>Acción</th><th>Descripción</th><th>Resultado</th><th>Detalles</th></tr></thead><tbody>{filtered.map(log=><tr key={log.id}><td>{log.timestamp}</td><td><span className="gmail-action-type">{log.actionType}</span></td><td>{log.prompt}</td><td><span className={`gmail-status ${log.executionStatus.toLowerCase()}`}>{labels[log.executionStatus]}</span></td><td>{log.details}</td></tr>)}</tbody></table>{filtered.length===0 && <div className="workspace-empty"><History size={30}/><p>No hay eventos que coincidan con la búsqueda.</p></div>}</div></div></>;
}
