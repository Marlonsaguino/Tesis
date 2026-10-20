import { Component, Input, Output, EventEmitter, ViewChild, ElementRef, OnInit, AfterViewInit, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { PendingAction } from '../models/outlook.model';
import { ActionService } from '../services/action.service';
import { OutlookService } from '../services/outlook.service';
@Component({selector:'app-action-editor',standalone:true,imports:[FormsModule],template:`
<dialog #dialog class="action-editor" aria-labelledby="action-edit-title" (cancel)="closed.emit()">
  <form (ngSubmit)="save()" class="p-4">
    <h2 class="h5" id="action-edit-title">Revisar propuesta · versión {{action.payloadVersion}}</h2>
    <p>{{action.parameters['subject']}}</p>
    @if(error) {<div role="alert" class="alert alert-danger">{{error}}</div>}
    @if(action.action_type === 'ADD_CATEGORY') {
      <label class="form-label w-100">Categoría <select class="form-select" name="category" [(ngModel)]="parameters['category']">
      @for(category of categories;track category) {<option [value]="category">{{category}}</option>}
      </select></label>
    } @else if(action.action_type === 'MOVE_EMAIL') {
      <label class="form-label w-100">Carpeta <select class="form-select" name="folder" [(ngModel)]="parameters['folder']">
        <option value="inbox">Entrada</option><option value="archive">Archivo</option><option value="deleteditems">Papelera</option>
        @if(mail.operationMode() === 'real') { @for(folder of mail.folders();track folder.id) {<option [value]="folder.id">{{folder.displayName}}</option>} }
      </select></label>
    } @else if(action.action_type === 'SET_FLAG') {
      <label class="d-block mb-3"><input name="flagged" type="checkbox" [(ngModel)]="parameters['flagged']"> Destacado</label>
    } @else {
      <p>El objetivo es fijo. Para cambiarlo, rechaza esta propuesta y selecciona otro correo.</p>
    }
    <p class="small">Guardar crea una nueva versión que requiere aprobación.</p>
    <div class="d-flex gap-2"><button class="btn btn-primary">Guardar nueva versión</button><button type="button" class="btn btn-outline-secondary" (click)="closed.emit()">Cancelar</button></div>
  </form>
</dialog>`,styles:[`.action-editor{width:min(540px,94vw);border:0;border-radius:18px;padding:0;max-height:90dvh;}.action-editor::backdrop{background:#15223888;}`]})
export class ActionEditorComponent implements OnInit,AfterViewInit {
 @Input({required:true}) action!:PendingAction;
 @Output() closed=new EventEmitter<void>();
 @ViewChild('dialog') dialog!:ElementRef<HTMLDialogElement>;
 readonly mail=inject(OutlookService);private readonly actions=inject(ActionService);
 readonly categories=['Trabajo','Personal','Importante','Finanzas','Boletines'];
 parameters:Record<string,any>={};error='';
 ngOnInit():void{this.parameters=structuredClone(this.action.parameters);}
 ngAfterViewInit():void{this.dialog.nativeElement.showModal();}
 save():void{
   if(this.action.accountKey!==this.mail.accountKey() || this.action.mode!==this.mail.operationMode()){this.error='Cambió la cuenta o el modo.';return;}
   try{this.actions.edit(this.action.id,this.parameters);this.closed.emit();}catch(e){this.error=(e as Error).message;}
 }
}
