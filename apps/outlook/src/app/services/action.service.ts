import { Injectable, signal, computed } from '@angular/core';
import { PendingAction, AuditLogItem } from '../models/outlook.model';

@Injectable({ providedIn: 'root' })
export class ActionService {
  readonly pendingActions = signal<PendingAction[]>([]);
  readonly auditLog = signal<AuditLogItem[]>([]);
  private readonly states = signal<Record<string, PendingAction>>({});
  readonly pendingCount = computed(() => this.pendingActions().filter(a => a.status === 'PENDING').length);
  get(id: string): PendingAction | undefined { return this.states()[id]; }
  canApprove(id: string): boolean { return this.get(id)?.status === 'PENDING'; }
  addProposedAction(action: Omit<PendingAction, 'status' | 'createdAt'>): void {
    if (this.get(action.id)) return;
    this.save({ ...structuredClone(action), provider: 'microsoft', status: 'PENDING', createdAt: new Date(),
      payloadVersion: action.payloadVersion || 1, requires_approval: true });
  }
  private save(action: PendingAction): void {
    this.states.update(s => ({ ...s, [action.id]: action }));
    this.pendingActions.update(list => ['PENDING', 'EXECUTING', 'FAILED', 'UNCERTAIN'].includes(action.status)
      ? [action, ...list.filter(a => a.id !== action.id)] : list.filter(a => a.id !== action.id));
  }
  private record(action: PendingAction, status: AuditLogItem['status'], details: string): void {
    this.auditLog.update(log => [{ id: crypto.randomUUID(), timestamp: new Date(), action_type: action.action_type,
      description: action.description, provider: action.provider, mode: action.mode, status, details,
      accountKey: action.accountKey, payloadVersion: action.payloadVersion }, ...log]);
  }
  edit(id: string, parameters: Record<string, any>): void {
    const action = this.get(id);
    if (!action || action.status !== 'PENDING') throw new Error('La propuesta ya no es editable.');
    const updated = { ...action, parameters: structuredClone(parameters), payloadVersion: action.payloadVersion + 1,
      payloadSnapshot: undefined, requires_approval: true };
    this.save(updated);
    this.record(updated, 'EDITED', 'Contenido modificado; requiere una nueva aprobación.');
  }
  begin(id: string, accountKey: string, mode: string): PendingAction {
    const action = this.get(id);
    if (!action || action.status !== 'PENDING') throw new Error('Esta propuesta ya fue procesada o está bloqueada.');
    if (action.accountKey !== accountKey || action.mode !== mode) throw new Error('Selecciona la cuenta y el modo de origen.');
    const executing: PendingAction = { ...structuredClone(action), status: 'EXECUTING',
      payloadSnapshot: JSON.stringify(action.parameters) };
    this.save(executing);
    this.record(executing, 'EXECUTING', 'Aprobación humana registrada para esta versión; comienza el intento.');
    return structuredClone(executing);
  }
  markApproved(action: PendingAction): void {
    this.save({ ...action, status: 'APPROVED' });
    this.record(action, action.action_type === 'SEND_EMAIL' && action.mode === 'real' ? 'ACCEPTED' : 'APPROVED', action.action_type === 'SEND_EMAIL' && action.mode === 'real'
      ? 'Microsoft aceptó la solicitud. Entrega sin confirmar: aparecer en Enviados no acredita la entrega. Sincroniza para buscar avisos de entrega fallida.' : 'Ejecución completada.');
  }
  authorizationRequired(action: PendingAction): void {
    this.save({...action,status:'PENDING',payloadSnapshot:undefined,errorMessage:undefined});
    this.record(action,'FAILED','Intento detenido antes de modificar correo: falta autorización Microsoft. La propuesta conserva su versión y necesita aprobación de nuevo.');
  }
  markFailed(action: PendingAction, message: string, uncertain = false): void {
    const status = uncertain ? 'UNCERTAIN' : 'FAILED';
    this.save({ ...action, status, errorMessage: message });
    this.record(action, status, message + (uncertain ? ' Comprueba el buzón antes de crear otra propuesta. Sin reintento automático.' : ''));
  }
  rejectAction(id: string): void {
    const action = this.get(id);
    if (!action || action.status !== 'PENDING') return;
    this.save({ ...action, status: 'REJECTED' });
    this.record(action, 'REJECTED', 'Propuesta rechazada expresamente.');
  }
}
