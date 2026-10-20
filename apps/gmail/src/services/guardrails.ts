import {realGmailProvider} from './realGmailProvider';
import type { ActionType, SafetyLevel, PendingAction } from '../types/email';

export interface GuardrailPolicy {
  actionType: ActionType;
  safetyLevel: SafetyLevel;
  impactScore: 'Bajo' | 'Medio' | 'Alto' | 'Crítico';
  requiresHumanConfirmation: boolean;
  explanationPattern: string;
}

export const GUARDRAIL_POLICIES: Record<ActionType, GuardrailPolicy> = {
  LIST_EMAILS: {
    actionType: 'LIST_EMAILS',
    safetyLevel: 'SAFE_AUTO',
    impactScore: 'Bajo',
    requiresHumanConfirmation: false,
    explanationPattern: 'Operación de solo lectura. Consulta correos sin modificar el estado del servidor.',
  },
  SUMMARIZE_THREAD: {
    actionType: 'SUMMARIZE_THREAD',
    safetyLevel: 'SAFE_AUTO',
    impactScore: 'Bajo',
    requiresHumanConfirmation: false,
    explanationPattern: 'Operación de lectura y síntesis por IA. No altera ningún correo.',
  },
  MARK_READ: {
    actionType: 'MARK_READ',
    safetyLevel: 'SAFE_AUTO',
    impactScore: 'Bajo',
    requiresHumanConfirmation: false,
    explanationPattern: 'Actualización menor de estado de lectura.',
  },
  LABEL_EMAIL: {
    actionType: 'LABEL_EMAIL',
    safetyLevel: 'SAFE_AUTO',
    impactScore: 'Bajo',
    requiresHumanConfirmation: false,
    explanationPattern: 'Organización interna de etiquetas. No elimina ni envía mensajes.',
  },
  DRAFT_REPLY: {
    actionType: 'DRAFT_REPLY',
    safetyLevel: 'SAFE_AUTO',
    impactScore: 'Medio',
    requiresHumanConfirmation: false,
    explanationPattern: 'Creación de borrador local. El correo NO será enviado hasta que el usuario lo autorice.',
  },
  SEND_EMAIL: {
    actionType: 'SEND_EMAIL',
    safetyLevel: 'REQUIRES_APPROVAL',
    impactScore: 'Alto',
    requiresHumanConfirmation: true,
    explanationPattern: 'ACCION SENSIBLE: Envío de comunicación externa en nombre del usuario.',
  },
  DELETE_EMAIL: {
    actionType: 'DELETE_EMAIL',
    safetyLevel: 'REQUIRES_APPROVAL',
    impactScore: 'Alto',
    requiresHumanConfirmation: true,
    explanationPattern: 'ACCION DESTRUCTIVA: Movimiento a la papelera / eliminación de correos.',
  },
  BULK_CLEANUP: {
    actionType: 'BULK_CLEANUP',
    safetyLevel: 'REQUIRES_APPROVAL',
    impactScore: 'Crítico',
    requiresHumanConfirmation: true,
    explanationPattern: 'ACCION MASIVA CRÍTICA: Modificación de múltiples correos de forma simultánea.',
  }
};

export class GuardrailsService {
  private strictMode: boolean = true;

  public setStrictMode(enabled: boolean) {
    this.strictMode = enabled;
  }

  public isStrictMode(): boolean {
    return this.strictMode;
  }

  public evaluateAction(actionType: ActionType, _payload: unknown): GuardrailPolicy {
    const policy = { ...GUARDRAIL_POLICIES[actionType] };
    if (this.strictMode && policy.safetyLevel === 'SAFE_AUTO' && actionType === 'LABEL_EMAIL') {
      return {
        ...policy,
        safetyLevel: 'REQUIRES_APPROVAL',
        requiresHumanConfirmation: true,
        impactScore: 'Medio',
        explanationPattern:
          'Modo estricto: aplicar etiquetas requiere confirmación explícita del usuario.',
      };
    }
    if (!this.strictMode && actionType === 'LABEL_EMAIL') {
      return policy;
    }
    return policy;
  }

  public createPendingAction(
    actionType: ActionType,
    title: string,
    description: string,
    payload: any,
    customExplanation?: string
  ): PendingAction {
    const policy = this.evaluateAction(actionType, payload);
    
    return {
      id: `act_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`,
      actionType,
      title,
      description,
      safetyLevel: policy.safetyLevel,
      impactScore: policy.impactScore,
      payload: {...payload,isReal:payload.isReal ?? realGmailProvider.isConnected(),sessionKey:payload.sessionKey ?? realGmailProvider.getSessionKey()},
      status: 'PENDING',
      createdAt: new Date().toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' }),
      aiExplanation: customExplanation || policy.explanationPattern
    };
  }
}

export const guardrails = new GuardrailsService();
