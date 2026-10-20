import React, { useState } from 'react';
import { ShieldAlert, Check, X, Mail, Trash2, Tag, AlertTriangle, Info, Edit3, Save, ShieldCheck } from 'lucide-react';
import type { PendingAction } from '../types/email';

interface PendingActionsListProps {
  pendingActions: PendingAction[];
  onApprove: (action: PendingAction) => void;
  onReject: (action: PendingAction) => void;
}

export const PendingActionsList: React.FC<PendingActionsListProps> = ({
  pendingActions,
  onApprove,
  onReject
}) => {
  const [editingActionId, setEditingActionId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState<{ recipient: string; subject: string; body: string }>({
    recipient: '',
    subject: '',
    body: ''
  });

  if (pendingActions.length === 0) {
    return (
      <div className="empty-pending-card">
        <ShieldCheck className="w-8 h-8 text-emerald-400 mb-2 opacity-80" />
        <h3 className="font-semibold text-slate-200 text-sm">No hay acciones pendientes</h3>
        <p className="text-xs text-slate-400 max-w-sm text-center mt-1.5 leading-relaxed">
          Las propuestas del agente aparecerán aquí para que puedas revisarlas y aprobarlas antes de ejecutarlas.
        </p>
      </div>
    );
  }

  const handleStartEdit = (action: PendingAction) => {
    setEditingActionId(action.id);
    setEditForm({
      recipient: action.payload.recipient || '',
      subject: action.payload.subject || '',
      body: action.payload.body || ''
    });
  };

  const handleSaveEdit = (action: PendingAction) => {
    action.payload.recipient = editForm.recipient;
    action.payload.subject = editForm.subject;
    action.payload.body = editForm.body;
    action.title = `Enviar correo a ${editForm.recipient || 'Destinatario'}`;
    action.description = `Asunto: "${editForm.subject}"`;
    setEditingActionId(null);
  };

  return (
    <div className="pending-actions-container">
      <div className="pending-header">
        <div className="pending-header-title">
          <ShieldAlert className="w-4 h-4 text-amber-400" />
          <h3>Propuestas para revisar ({pendingActions.length})</h3>
        </div>
        <span className="security-pill">Aprobación humana</span>
      </div>

      <div className="pending-cards-grid">
        {pendingActions.map(action => {
          const isEditing = editingActionId === action.id;

          return (
            <div key={action.id} className="pending-card">
              <div className="card-top">
                <div className="flex items-center gap-2">
                  {action.actionType === 'SEND_EMAIL' && <Mail className="w-4 h-4 text-sky-400" />}
                  {action.actionType === 'DELETE_EMAIL' && <Trash2 className="w-4 h-4 text-rose-400" />}
                  {action.actionType === 'BULK_CLEANUP' && <Trash2 className="w-4 h-4 text-amber-400" />}
                  {action.actionType === 'LABEL_EMAIL' && <Tag className="w-4 h-4 text-indigo-400" />}
                  <span className="action-title">{action.title}</span>
                </div>

                <span className={`impact-badge ${action.impactScore.toLowerCase()}`}>
                  Impacto {action.impactScore}
                </span>
              </div>

              <p className="card-desc">{action.description}</p>

              {/* Action Payload Preview or Edit Mode */}
              {isEditing ? (
                <div className="payload-preview edit-mode">
                  <div className="flex justify-between items-center mb-2.5 pb-2 border-b border-white/10">
                    <span className="text-xs font-semibold text-sky-300 flex items-center gap-1.5">
                      <Edit3 className="w-3.5 h-3.5" /> Modificar Parámetros del Borrador
                    </span>
                    <button
                      onClick={() => handleSaveEdit(action)}
                      className="btn-approve text-xs py-1 px-2.5"
                    >
                      <Save className="w-3 h-3 mr-1 inline" /> Guardar Cambios
                    </button>
                  </div>

                  <div className="mb-2">
                    <label className="text-[11px] text-slate-400 block mb-1 font-mono">Destinatario:</label>
                    <input
                      type="email"
                      value={editForm.recipient}
                      onChange={e => setEditForm(prev => ({ ...prev, recipient: e.target.value }))}
                      className="chat-input w-full text-xs"
                    />
                  </div>

                  <div className="mb-2">
                    <label className="text-[11px] text-slate-400 block mb-1 font-mono">Asunto:</label>
                    <input
                      type="text"
                      value={editForm.subject}
                      onChange={e => setEditForm(prev => ({ ...prev, subject: e.target.value }))}
                      className="chat-input w-full text-xs"
                    />
                  </div>

                  <div>
                    <label className="text-[11px] text-slate-400 block mb-1 font-mono">Cuerpo del Mensaje:</label>
                    <textarea
                      rows={4}
                      value={editForm.body}
                      onChange={e => setEditForm(prev => ({ ...prev, body: e.target.value }))}
                      className="chat-input w-full text-xs font-mono"
                    />
                  </div>
                </div>
              ) : (
                <div className="payload-preview">
                  <div className="flex justify-between items-center mb-1.5">
                    <div className="preview-label">
                      <Info className="w-3.5 h-3.5" />
                      <span>Parámetros de la Acción:</span>
                    </div>

                    {action.actionType === 'SEND_EMAIL' && (
                      <button
                        onClick={() => handleStartEdit(action)}
                        className="text-xs text-sky-400 hover:text-sky-300 flex items-center gap-1 bg-transparent border-0 cursor-pointer p-0 font-medium"
                      >
                        <Edit3 className="w-3 h-3" /> Editar Borrador
                      </button>
                    )}
                  </div>

                  {action.payload.recipient && (
                    <div className="preview-row">
                      <span className="field-name">Para:</span>
                      <span className="field-val font-mono text-sky-300">{action.payload.recipient}</span>
                    </div>
                  )}

                  {action.payload.subject && (
                    <div className="preview-row">
                      <span className="field-name">Asunto:</span>
                      <span className="field-val font-medium">{action.payload.subject}</span>
                    </div>
                  )}

                  {action.payload.emailIds && action.payload.emailIds.length > 0 && (
                    <div className="preview-row">
                      <span className="field-name">Elementos:</span>
                      <span className="field-val font-mono">{action.payload.emailIds.length} correos afectados</span>
                    </div>
                  )}

                  {action.payload.body && (
                    <div className="preview-body-box">
                      <span className="field-name block mb-1">Cuerpo:</span>
                      <p className="body-text">{action.payload.body}</p>
                    </div>
                  )}
                </div>
              )}

              {/* AI Guardrail Explanation */}
              <div className="ai-explanation">
                <AlertTriangle className="w-3.5 h-3.5 shrink-0 mt-0.5" />
                <p>{action.aiExplanation}</p>
              </div>

              {/* Action Buttons */}
              <div className="action-buttons">
                <button
                  onClick={() => onReject(action)}
                  className="btn-reject"
                  title="Cancelar y descartar esta acción"
                >
                  <X className="w-3.5 h-3.5" />
                  <span>Rechazar</span>
                </button>

                <button
                  onClick={() => onApprove(action)}
                  className="btn-approve"
                  title="Aprobar esta propuesta y ejecutarla en Gmail"
                >
                  <Check className="w-3.5 h-3.5" />
                  <span>Aprobar y ejecutar</span>
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
