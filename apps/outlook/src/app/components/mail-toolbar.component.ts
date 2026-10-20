import { Component, computed, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { OutlookService } from '../services/outlook.service';
@Component({selector:'app-mail-toolbar',standalone:true,imports:[CommonModule,FormsModule],template:`
<div class="workspace-head">
  <div class="workspace-heading"><span class="eyebrow">TU ESPACIO DE CORREO</span><h1>{{locationName()}}</h1>
    <p>{{mail.activeFolder() === 'localdrafts' ? 'Continúa tus mensajes antes de preparar el envío.' : 'Consulta, responde y organiza tus mensajes desde un solo lugar.'}}</p>
  </div>
  <button class="btn btn-primary compose-button" (click)="mail.startCompose()"><i class="bi bi-pencil-square" aria-hidden="true"></i> Nuevo correo</button>
</div>
<div class="workspace-location">
  <label for="mail-location">Ubicación</label>
  <select id="mail-location" class="form-select form-select-sm" [ngModel]="mail.activeFolder()" (ngModelChange)="mail.selectFolder($event)">
    @for(folder of locations;track folder.id) {<option [value]="folder.id">{{folder.name}}</option>}
    @if(mail.operationMode() === 'real' && extraFolders().length) {
      <optgroup label="Otras carpetas de Outlook">@for(folder of extraFolders();track folder.id) {<option [value]="folder.id">{{folder.displayName}}</option>}</optgroup>
    }
  </select>
  <span class="location-note"><i class="bi" [class.bi-cloud-check]="mail.operationMode() === 'real'" [class.bi-flask]="mail.operationMode() === 'simulated'"></i> {{mail.operationMode() === 'real' ? 'Tu cuenta de Outlook' : 'Datos de demostración'}}</span>
  @if(mail.nextLink() && mail.activeFolder() !== 'localdrafts') {<button class="btn btn-outline-primary btn-sm ms-auto" (click)="mail.loadMore()" [disabled]="mail.isLoading()">Cargar más</button>}
</div>
@if(mail.errorMessage()) {<div class="workspace-error alert alert-danger" role="alert">{{mail.errorMessage()}}</div>}
@if(mail.activeFolder() === 'localdrafts') {
  <section class="drafts-workspace" aria-labelledby="draft-list-title">
    <div class="draft-list-heading"><h2 id="draft-list-title">Guardados en esta sesión <span>{{mail.visibleDrafts().length}}</span></h2><p>Los borradores locales se conservan mientras esta pestaña esté abierta. No se han enviado.</p></div>
    <div class="draft-grid">
    @for(draft of mail.visibleDrafts();track draft.id) {
      <article class="draft-card">
        <div class="draft-card-top"><span class="draft-icon"><i class="bi bi-file-earmark-text"></i></span><span class="badge draft-status">Sin enviar</span></div>
        <button class="draft-subject" (click)="mail.openDraft(draft)">{{draft.subject || '(Sin asunto)'}}</button>
        <p class="draft-recipient">Para: {{draft.to || 'Pendiente de destinatario'}}</p>
        <p class="draft-preview">{{draft.body || 'Todavía no has escrito el mensaje.'}}</p>
        <div class="draft-actions"><button class="btn btn-sm btn-outline-primary" (click)="mail.openDraft(draft)"><i class="bi bi-pencil me-1"></i> Continuar</button><button class="btn btn-sm btn-outline-danger" (click)="discard(draft.id)" [attr.aria-label]="'Descartar borrador '+(draft.subject || 'sin asunto')"><i class="bi bi-trash3 me-1"></i> Descartar</button></div>
      </article>
    } @empty {
      <div class="draft-empty"><i class="bi bi-file-earmark-text"></i><h3>Tus ideas empiezan aquí</h3><p>Escribe un mensaje y elige «Guardar borrador y cerrar» para retomarlo después.</p><button class="btn btn-primary" (click)="mail.startCompose()">Crear un borrador</button></div>
    }
    </div>
  </section>
}`,styles:[`
:host{display:block;flex-shrink:0;background:var(--ui-surface);}:host(.drafts-view){flex:1;min-height:0;overflow:auto;}
.workspace-head{display:flex;align-items:center;justify-content:space-between;gap:16px;padding:24px 24px 16px;}.eyebrow{font-size:.58rem;letter-spacing:.13em;color:var(--ui-muted);font-weight:750;}.workspace-heading h1{font-size:1.45rem;letter-spacing:-.035em;margin:5px 0 4px;font-weight:750;}.workspace-heading p{font-size:.76rem;color:var(--ui-muted);margin:0;}.compose-button{display:flex;align-items:center;gap:7px;white-space:nowrap;}.workspace-location{display:flex;align-items:center;gap:10px;padding:0 24px 18px;border-bottom:1px solid var(--ui-border);}.workspace-location label{font-size:.73rem;color:var(--ui-muted);font-weight:600;margin:0;}.workspace-location .form-select{width:210px;font-size:.77rem;min-height:36px;padding-top:6px;padding-bottom:6px;}.location-note{font-size:.68rem;color:var(--ui-muted);display:flex;align-items:center;gap:6px;}.workspace-error{margin:16px 24px;}.drafts-workspace{background:var(--ui-bg);padding:26px 24px;min-height:calc(100% - 150px);}.draft-list-heading h2{font-size:.95rem;font-weight:650;}.draft-list-heading h2 span{font-size:.68rem;padding:3px 7px;border-radius:5px;background:var(--ui-surface);margin-left:7px;color:var(--ui-muted);}.draft-list-heading p{font-size:.74rem;color:var(--ui-muted);margin-bottom:22px;}.draft-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(min(290px,100%),1fr));gap:16px;max-width:1250px;}.draft-card{border:1px solid var(--ui-border);border-radius:13px;background:var(--ui-surface);padding:21px;min-width:0;box-shadow:var(--ui-shadow);}.draft-card-top{display:flex;justify-content:space-between;align-items:center;margin-bottom:18px;}.draft-icon{background:var(--ui-primary-soft);color:var(--ui-primary);width:35px;height:35px;display:grid;place-items:center;border-radius:9px;font-size:17px;}.draft-status{background:var(--ui-warning-soft);color:var(--ui-warning);}.draft-subject{border:0;padding:0;background:none;color:var(--ui-text);font-size:.9rem;font-weight:700;text-align:left;line-height:1.5;overflow-wrap:anywhere;}.draft-subject:hover{color:var(--ui-primary);}.draft-recipient{font-size:.71rem;margin:7px 0 12px;color:var(--ui-muted);overflow-wrap:anywhere;}.draft-preview{font-size:.79rem;line-height:1.75;color:var(--ui-muted);display:-webkit-box;-webkit-line-clamp:3;-webkit-box-orient:vertical;overflow:hidden;min-height:65px;white-space:pre-wrap;overflow-wrap:anywhere;}.draft-actions{display:flex;gap:8px;padding-top:16px;border-top:1px solid var(--ui-border);flex-wrap:wrap;}.draft-empty{grid-column:1/-1;min-height:330px;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:8px;text-align:center;border:1px dashed var(--ui-border-strong);border-radius:14px;padding:24px;}.draft-empty>i{font-size:36px;color:var(--ui-muted);}.draft-empty h3{font-size:1.05rem;font-weight:650;}.draft-empty p{max-width:360px;font-size:.8rem;color:var(--ui-muted);}
@media(max-width:767.98px){.workspace-head{padding:18px 15px 14px;align-items:flex-start;}.workspace-heading h1{font-size:1.2rem;}.workspace-heading p{display:none;}.compose-button{font-size:.72rem;padding:8px 10px;}.eyebrow{font-size:.52rem;}.workspace-location{padding:0 15px 14px;gap:8px;flex-wrap:wrap;}.workspace-location .form-select{width:190px;}.location-note{font-size:.62rem;}.drafts-workspace{padding:20px 15px;}.workspace-error{margin:12px 15px;}.draft-grid{grid-template-columns:1fr;}}
`]})
export class MailToolbarComponent {
 readonly mail=inject(OutlookService);
 readonly locations=[{id:'inbox',name:'Entrada'},{id:'sentitems',name:'Enviados'},{id:'localdrafts',name:'Borradores locales'},
   {id:'flagged',name:'Destacados'},{id:'archive',name:'Archivo'},{id:'deleteditems',name:'Papelera'}];
 readonly locationName=computed(()=>this.locations.find(f=>f.id===this.mail.activeFolder())?.name || this.mail.folders().find(f=>f.id===this.mail.activeFolder())?.displayName || 'Correo');
 readonly extraFolders=computed(()=>this.mail.folders().filter(f=>!['inbox','bandeja de entrada','sent items','elementos enviados','archive','archivo','deleted items','elementos eliminados','papelera'].includes(f.displayName.toLowerCase())));
 discard(id:string):void{if(window.confirm('¿Descartar este borrador local? No se enviará ningún correo.'))this.mail.discardDraft(id);}
}
