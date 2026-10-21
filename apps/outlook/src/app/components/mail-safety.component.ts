import {Component,Input} from '@angular/core';
import {MailInsights} from '../services/mail-insights';
@Component({selector:'app-mail-safety',standalone:true,template:`
  @if(report;as r){
    <section class="mail-safety" [class.high]="r.level==='high'" [class.review]="r.level==='review'" aria-label="Análisis de seguridad del correo">
      <strong>{{r.label}}</strong>
      @if(r.reasons.length){<ul>@for(reason of r.reasons;track reason){<li>{{reason}}</li>}</ul>}
      @if(r.level==='high'){<p>No introduzcas contraseñas ni códigos desde este mensaje. Comprueba la solicitud por otro canal.</p>}
      <details><summary>Detalles del análisis local{{r.partial?' · Contenido parcial':''}}</summary>
        <p>Se revisan señales del texto y los destinos visibles; no se visitan los enlaces. No verifica SPF/DKIM, reputación en Internet ni analiza virus en archivos. La ausencia de indicios no garantiza seguridad.</p>
        @if(r.partial){<p>Solo se pudo revisar parte del mensaje o faltan enlaces del cuerpo completo.</p>}
        @if(r.hasAttachments){<p>Contiene adjuntos. Solo se revisan los nombres disponibles; su contenido no ha sido analizado.</p>}
        @if(r.links.length){<ul>@for(link of r.links;track $index){<li><code>{{link.domain}}</code>{{link.reasons.length?'':' · Destino sin verificar'}}</li>}</ul>}
        <p>Categorías automáticas: {{r.categories.join(', ') || 'Sin clasificar'}}.</p>
        @if(r.specificLabels.length){<p>Descriptores automáticos específicos: {{r.specificLabels.join('; ')}}.</p>}
        @for(reason of r.classificationReasons;track reason){<p>{{reason}}</p>}
      </details>
    </section>
  }
`,styleUrl:'./mail-safety.component.css'})
export class MailSafetyComponent {@Input() report:MailInsights|null=null;}
