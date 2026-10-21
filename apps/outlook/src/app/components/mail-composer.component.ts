import { Component, inject, Input, OnInit, ViewChild, ElementRef, AfterViewInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MailDraft, MailAttachment } from '../models/outlook.model';
import { OutlookService } from '../services/outlook.service';
import { ActionService } from '../services/action.service';

@Component({
  selector: 'app-mail-composer', standalone: true, imports: [CommonModule, FormsModule],
  template: `
  <dialog #dialog class="composer-dialog" aria-labelledby="compose-title" (cancel)="$event.preventDefault(); save()">
    <header class="d-flex align-items-center justify-content-between border-bottom p-3">
      <h2 id="compose-title" class="h5 mb-0">{{ draft.editingActionId ? 'Editar propuesta' : 'Redactar correo' }}</h2>
      <div class="d-flex align-items-center gap-2"><span class="badge bg-secondary">{{ draft.mode === 'real' ? 'Outlook real' : 'Simulador' }}</span><button class="icon-button" type="button" (click)="save()" [disabled]="busy" [attr.aria-label]="draft.editingActionId ? 'Cancelar edición' : 'Guardar borrador y cerrar'"><i class="bi bi-x-lg" aria-hidden="true"></i></button></div>
    </header>
    <form class="p-3" (ngSubmit)="propose()">
      <p class="small text-secondary">{{draft.editingActionId ? 'Al guardar, se creará una nueva versión pendiente de tu aprobación.' : 'Escribe con calma. El mensaje no se envía hasta que apruebes su propuesta.'}}</p>
      @if(draft.attachmentsOmitted){<div class="alert alert-warning">Este borrador tenía adjuntos de una sesión anterior que no se conservaron. Vuelve a adjuntarlos y revisa el mensaje antes de aprobar.</div>}
      @if(error) { <div class="alert alert-danger" role="alert">{{error}}</div> }
      <label class="form-label w-100">Para <input autofocus type="text" class="form-control" name="to" [(ngModel)]="draft.to" required placeholder="correo@ejemplo.com" autocomplete="off" inputmode="email"></label>
      <div class="row"><label class="form-label col-md-6">CC <input class="form-control" name="cc" [(ngModel)]="draft.cc"></label>
      <label class="form-label col-md-6">CCO (copia oculta) <input class="form-control" name="bcc" [(ngModel)]="draft.bcc"></label></div>
      <label class="form-label w-100">Asunto <input class="form-control" name="subject" [(ngModel)]="draft.subject" maxlength="998"></label>
      <label class="form-label w-100">Mensaje <textarea class="form-control" rows="7" name="body" [(ngModel)]="draft.body" required></textarea></label>
      <label class="form-label">Adjuntos · hasta 2 MB en total
        <input type="file" class="form-control" multiple (change)="attach($event)" [disabled]="busy">
      </label>
      @for(file of draft.attachments; track $index) {
        <div class="d-flex justify-content-between border rounded p-2 mb-1"><span>{{file.name}} · {{file.size | number}} bytes</span>
        <button type="button" class="btn btn-sm btn-outline-danger" (click)="remove($index)" [disabled]="busy" [attr.aria-label]="'Quitar '+file.name">Quitar</button></div>
      }
      <footer class="d-flex gap-2 flex-wrap mt-3 border-top pt-3">
        <button class="btn btn-primary" type="submit" [disabled]="busy">{{draft.editingActionId ? 'Guardar cambios para nueva aprobación' : 'Preparar propuesta de envío'}}</button>
        <button class="btn btn-outline-secondary" type="button" (click)="save()" [disabled]="busy">{{draft.editingActionId ? 'Cancelar edición' : 'Guardar borrador y cerrar'}}</button>
      </footer>
      <p class="small text-secondary mt-2 mb-0">Con PostgreSQL conectado, los borradores guardados se conservan por cuenta. Los archivos adjuntos permanecen en memoria; vuelve a adjuntarlos después de recargar.</p>
    </form>
  </dialog>`,
  styles: [`.composer-dialog{width:min(740px,96vw);max-height:92dvh;border-radius:18px;padding:0;box-shadow:0 24px 90px #08162844;}.form-label{margin-bottom:12px;}.form-label input,.form-label textarea{margin-top:6px;}header h2{color:var(--ui-text);}`]
})
export class MailComposerComponent implements OnInit, AfterViewInit {
  @Input({required:true}) draft!: MailDraft;
  @ViewChild('dialog') dialog!: ElementRef<HTMLDialogElement>;
  readonly mail = inject(OutlookService);
  private readonly actions = inject(ActionService);
  error = ''; busy = false;
  ngOnInit(): void { this.draft = structuredClone(this.draft); }
  ngAfterViewInit(): void { this.dialog.nativeElement.showModal(); }
  remove(index: number): void { this.draft.attachments.splice(index,1); }
  async attach(event: Event): Promise<void> {
    const input = event.target as HTMLInputElement;
    const files = Array.from(input.files || []); input.value = '';
    if (files.reduce((n,f)=>n+f.size,0)+this.draft.attachments.reduce((n,f)=>n+f.size,0)>2*1024*1024) { this.error='El total de adjuntos supera 2 MB.'; return; }
    this.busy=true; this.error='';
    try {
      const attachments = await Promise.all(files.map(file => new Promise<MailAttachment>((resolve,reject) => {
        const reader = new FileReader(); reader.onerror=()=>reject(new Error('No se pudo leer '+file.name));
        reader.onload=()=>resolve({name:file.name,contentType:file.type || 'application/octet-stream',size:file.size,contentBytes:String(reader.result).split(',')[1]});
        reader.readAsDataURL(file);
      })));
      this.draft.attachments.push(...attachments);
    } catch(e) { this.error=(e as Error).message; } finally {this.busy=false;}
  }
  save(): void {
    if(this.busy) return;
    if (this.draft.editingActionId) this.mail.composer.set(null);
    else this.mail.saveDraft(this.draft);
  }
  propose(): void {
    this.error='';
    if(this.busy) return;
    if (this.draft.accountKey !== this.mail.accountKey() || this.draft.mode !== this.mail.operationMode()) {this.error='La cuenta o el modo cambió. Vuelve a abrir el editor.'; return;}
    const valid=(raw:string)=>!raw.trim() || raw.split(/[;,]/).every(a=>/^[^\s<>@]+@[^\s<>@]+\.[^\s<>@]+$/.test(a.trim()));
    if (!this.draft.to.trim() || !valid(this.draft.to) || !valid(this.draft.cc) || !valid(this.draft.bcc)) {this.error='Revisa las direcciones de Para, CC y CCO.'; return;}
    if (!this.draft.body.trim()) {this.error='Escribe el contenido del mensaje.'; return;}
    if(/\[(Completa|Escribe|Tu Nombre)/i.test(this.draft.body)) {this.error='Sustituye los textos de ejemplo entre corchetes antes de preparar el envío.';return;}
    const parameters={to:this.draft.to,cc:this.draft.cc,bcc:this.draft.bcc,subject:this.draft.subject,body:this.draft.body,
      attachments:structuredClone(this.draft.attachments),replyToId:this.draft.replyToId};
    try {
      if(this.draft.editingActionId) this.actions.edit(this.draft.editingActionId,parameters);
      else this.actions.addProposedAction({id:crypto.randomUUID(),action_type:'SEND_EMAIL',description:`Enviar: ${this.draft.subject || '(Sin asunto)'}`,
        provider:'microsoft',mode:this.draft.mode,accountKey:this.draft.accountKey,accountLabel:this.draft.mode==='simulated' ? 'Cuenta simulada' : this.mail.currentAccount()?.username,payloadVersion:1,requires_approval:true,parameters});
      this.mail.discardDraft(this.draft.id); this.mail.composer.set(null);
    } catch(e) {this.error=(e as Error).message;}
  }
}
