import type { MailInsights } from '../services/mail-insights';

export function MailSafety({report}:{report:MailInsights}) {
  return <section className={`mail-safety ${report.level}`} aria-label="Análisis de seguridad del correo">
    <strong>{report.label}</strong>
    {report.reasons.length>0 && <ul>{report.reasons.map(reason=><li key={reason}>{reason}</li>)}</ul>}
    {report.level==='high' && <p>No introduzcas contraseñas ni códigos desde este mensaje. Comprueba la solicitud por otro canal.</p>}
    <details><summary>Detalles del análisis local{report.partial?' · Contenido parcial':''}</summary>
      <p>Se revisan señales del texto y los destinos visibles; no se visitan los enlaces. No verifica SPF/DKIM, reputación en Internet ni analiza virus en archivos. La ausencia de indicios no garantiza seguridad.</p>
      {report.partial && <p>Solo se pudo revisar parte del mensaje o faltan enlaces del cuerpo completo.</p>}
      {report.hasAttachments && <p>Contiene adjuntos. Solo se revisan los nombres disponibles; su contenido no ha sido analizado.</p>}
      {report.links.length>0 && <ul>{report.links.map((link,index)=><li key={index}><code>{link.domain}</code>{link.reasons.length===0?' · Destino sin verificar':''}</li>)}</ul>}
      <p>Categorías automáticas: {report.categories.join(', ') || 'Sin clasificar'}.</p>
      {report.classificationReasons.map(reason=><p key={reason}>{reason}</p>)}
    </details>
  </section>;
}
