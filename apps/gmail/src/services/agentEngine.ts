import type { AgentStep, AuditLog, Email, PendingAction } from '../types/email';
import type { ChatMessage } from '../types/llm';
import { emailProvider } from './mockEmailProvider';
import { realGmailProvider } from './realGmailProvider';
import { guardrails } from './guardrails';
import { chatWithLlm, fetchLlmHealth } from './llmClient';
import {
  AGENT_TOOL_DEFINITIONS,
  buildInboxContextSummary,
  executeAgentTool,
} from './agentTools';

export interface AgentResponse {
  steps: AgentStep[];
  pendingActions: PendingAction[];
  finalAnswer: string;
  auditLogs: AuditLog[];
  usedLlm: boolean;
}

const SYSTEM_PROMPT = `Eres EmailAgent AI, un asistente experto en gestión de correo electrónico.
Respondes en español, de forma clara y profesional.

Reglas:
- Usa las herramientas disponibles para leer la bandeja y preparar acciones.
- NUNCA afirmes que enviaste o borraste correos: solo preparas acciones; el usuario debe aprobarlas en el panel.
- Para redactar respuestas, usa prepare_send_email con un cuerpo completo y cortés.
- Para limpiar spam/promociones, usa prepare_bulk_cleanup (puedes omitir email_ids para auto-selección).
- Para etiquetar, usa prepare_label_emails con ids concretos del contexto.
- Si falta información, pregunta al usuario o usa search_emails / get_email_details.
- Sé conciso en la respuesta final al usuario.`;

export class AgentEngine {
  /**
   * Rolling conversation history sent to the LLM for multi-turn context.
   * Capped at MAX_HISTORY_MESSAGES to stay within token limits.
   */
  private conversationHistory: ChatMessage[] = [];
  private static readonly MAX_HISTORY_MESSAGES = 12; // ~20 user/assistant pairs

  /** Clear all conversation memory (e.g. when starting a fresh session) */
  public clearHistory(): void {
    this.conversationHistory = [];
  }

  public restoreTextHistory(messages:{role:'user'|'assistant';content:string}[]):void {
    this.conversationHistory=messages.slice(-AgentEngine.MAX_HISTORY_MESSAGES).map(message=>({role:message.role,content:message.content}));
  }

  /** Trim history to stay within the max limit, preserving the most recent messages */
  private trimHistory(): void {
    if (this.conversationHistory.length > AgentEngine.MAX_HISTORY_MESSAGES) {
      // Keep only the most recent messages
      this.conversationHistory = this.conversationHistory.slice(
        this.conversationHistory.length - AgentEngine.MAX_HISTORY_MESSAGES
      );
    }
  }

  private async getAvailableEmails(): Promise<{ emails: Email[]; isReal: boolean }> {
    if (realGmailProvider.isConnected()) {
      try {
        const realEmails = await realGmailProvider.fetchEmails('in:inbox', 15);
        return { emails: realEmails, isReal: true };
      } catch (e) {
        throw new Error('Gmail real no está disponible. Renueva la autorización. No se ha cambiado al simulador.');
      }
    }
    return { emails: emailProvider.getEmails(), isReal: false };
  }

  private async applyLabels(emailIds: string[], label: string, isReal: boolean) {
    if (isReal) {
      await realGmailProvider.labelEmails(emailIds, label);
    } else {
      emailProvider.labelEmails(emailIds, label);
    }
  }

  private timestamp() {
    return new Date().toLocaleTimeString('es-ES', {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    });
  }

  private buildAudit(
    actionType: AuditLog['actionType'],
    prompt: string,
    executionStatus: AuditLog['executionStatus'],
    details: string
  ): AuditLog {
    return {
      id: `aud_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
      timestamp: new Date().toLocaleString(),
      actionType,
      prompt,
      executionStatus,
      details,
    };
  }

  private async runLlmAgent(
    prompt: string,
    emails: Email[],
    isReal: boolean,
    providerSource: string
  ): Promise<AgentResponse> {
    const steps: AgentStep[] = [];
    const pendingActions: PendingAction[] = [];
    const auditLogs: AuditLog[] = [];

    steps.push({
      type: 'THINKING',
      message: `Modelo LLM analizando la solicitud [${providerSource}]`,
      timestamp: this.timestamp(),
    });

    const inboxContext = buildInboxContextSummary(emails, providerSource);

    // Dynamic system prompt including real-time inbox state
    const systemInstruction = `${SYSTEM_PROMPT}

---
ESTADO ACTUAL DE LA BANDEJA DE ENTRADA:
${inboxContext}`;

    // Clean user message for the current turn
    const currentUserMessage: ChatMessage = {
      role: 'user',
      content: prompt,
    };

    // Full multi-turn context: updated system prompt + previous turns + current turn
    const messages: ChatMessage[] = [
      { role: 'system', content: systemInstruction },
      ...this.conversationHistory,
      currentUserMessage,
    ];

    const toolCtx = {
      emails,
      isReal,
      providerSource,
      strictMode: guardrails.isStrictMode() || isReal,
      sessionKey: realGmailProvider.getSessionKey(),
    };

    let finalContent: string | null = null;
    const maxRounds = 3;

    for (let round = 0; round < maxRounds; round++) {
      const llmRes = await chatWithLlm(messages, [...AGENT_TOOL_DEFINITIONS]);
      if(toolCtx.sessionKey!==realGmailProvider.getSessionKey()) throw new Error('La sesión cambió durante la consulta.');
      const assistantMsg = llmRes.message;

      if (assistantMsg.tool_calls?.length) {
        messages.push({
          role: 'assistant',
          content: assistantMsg.content,
          tool_calls: assistantMsg.tool_calls,
        });

        for (const call of assistantMsg.tool_calls) {
          let args: Record<string, unknown> = {};
          try {
            args =
              typeof call.function.arguments === 'string'
                ? (JSON.parse(call.function.arguments || '{}') as Record<string, unknown>)
                : ((call.function.arguments || {}) as Record<string, unknown>);
          } catch {
            args = {};
          }

          const result = executeAgentTool(call.function.name, args, toolCtx);
          steps.push(...result.steps);
          pendingActions.push(...result.pendingActions);

          if (result.autoLabel) {
            await this.applyLabels(result.autoLabel.emailIds, result.autoLabel.label, isReal);
          }
          if (result.audit) {
            auditLogs.push(
              this.buildAudit(
                result.audit.actionType,
                prompt,
                result.audit.status,
                result.audit.details
              )
            );
          }

          messages.push({
            role: 'tool',
            tool_call_id: call.id,
            content: result.content,
          });
        }
        continue;
      }

      finalContent = assistantMsg.content;
      break;
    }

    if (!finalContent) {
      finalContent =
        'He ejecutado las herramientas necesarias. Revisa **Acciones Pendientes** si hay envíos o borrados por confirmar.';
    }

    if (pendingActions.length > 0) {
      steps.push({
        type: 'RESPONSE',
        message: `${pendingActions.length} acción(es) esperando tu aprobación`,
        timestamp: this.timestamp(),
      });
    }

    // Persist this turn into memory for multi-turn conversational recall
    this.conversationHistory.push(currentUserMessage);
    this.conversationHistory.push({
      role: 'assistant',
      content: finalContent,
    });
    this.trimHistory();

    return {
      steps,
      pendingActions,
      finalAnswer: finalContent,
      auditLogs,
      usedLlm: true,
    };
  }

  /** Fallback sin LLM (keywords) cuando no hay API key o falla la red */
  private async runRuleBasedAgent(
    prompt: string,
    emails: Email[],
    isReal: boolean,
    providerSource: string
  ): Promise<AgentResponse> {
    const toolCtx = {
      emails,
      isReal,
      providerSource,
      strictMode: guardrails.isStrictMode() || isReal,
      sessionKey: realGmailProvider.getSessionKey(),
    };
    const steps: AgentStep[] = [
      {
        type: 'THINKING',
        message: `Modo local (sin LLM): interpretando "${prompt}"`,
        timestamp: this.timestamp(),
      },
    ];
    const pendingActions: PendingAction[] = [];
    const auditLogs: AuditLog[] = [];
    const lower = prompt.toLowerCase();

    let toolName: string | null = null;
    let args: Record<string, unknown> = {};

    if (
      lower.includes('envia') ||
      lower.includes('enviar') ||
      lower.includes('responde') ||
      lower.includes('redacta') ||
      lower.includes('correo a')
    ) {
      const emailRegex = /([a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,})/i;
      const match = prompt.match(emailRegex);
      const defaultTarget = emails[0];
      toolName = 'prepare_send_email';
      args = {
        recipient: match?.[0] || defaultTarget?.sender || 'destinatario@ejemplo.com',
        subject: defaultTarget ? `Re: ${defaultTarget.subject}` : 'Comunicación vía EmailAgent AI',
        body: `Hola,\n\n${prompt}\n\nSaludos,\nEmailAgent AI`,
        reply_to_email_id: defaultTarget?.id,
      };
    } else if (
      lower.includes('urgente') ||
      lower.includes('resumen') ||
      lower.includes('resumir') ||
      lower.includes('no leídos')
    ) {
      toolName = 'list_priority_emails';
    } else if (
      lower.includes('borr') ||
      lower.includes('eliminar') ||
      lower.includes('limpia') ||
      lower.includes('spam') ||
      lower.includes('suscripciones')
    ) {
      toolName = 'prepare_bulk_cleanup';
    } else if (lower.includes('etiquet') || lower.includes('label')) {
      toolName = 'prepare_label_emails';
      const workIds = emails.filter((e) => e.category === 'Trabajo').map((e) => e.id);
      args = { email_ids: workIds.length ? workIds : emails.slice(0, 2).map((e) => e.id), label: 'Trabajo' };
    } else {
      toolName = 'search_emails';
      args = { query: prompt };
    }

    const result = executeAgentTool(toolName, args, toolCtx);
    steps.push(...result.steps);
    pendingActions.push(...result.pendingActions);
    if (result.autoLabel) {
      await this.applyLabels(result.autoLabel.emailIds, result.autoLabel.label, isReal);
    }
    if (result.audit) {
      auditLogs.push(
        this.buildAudit(result.audit.actionType, prompt, result.audit.status, result.audit.details)
      );
    }

    let finalAnswer = 'Listo. Revisa el panel para más detalles.';
    if (toolName === 'list_priority_emails') {
      const data = JSON.parse(result.content) as { count: number; emails: string };
      finalAnswer = `Encontré **${data.count}** correo(s) prioritario(s):\n\n${data.emails}`;
    } else if (pendingActions.length > 0) {
      finalAnswer = `Preparé **${pendingActions.length}** acción(es) que requieren tu firma en **Acciones Pendientes**.`;
    } else {
      try {
        const data = JSON.parse(result.content) as { count?: number; results?: unknown[] };
        if (data.count !== undefined) {
          finalAnswer = `Encontré **${data.count}** correo(s) relacionados con tu búsqueda.`;
        }
      } catch {
        /* keep default */
      }
    }

    // Keep memory consistent even in fallback/rule-based mode
    this.conversationHistory.push({ role: 'user', content: prompt });
    this.conversationHistory.push({ role: 'assistant', content: finalAnswer });
    this.trimHistory();

    return { steps, pendingActions, finalAnswer, auditLogs, usedLlm: false };
  }

  public async processPrompt(prompt: string): Promise<AgentResponse> {
    const sessionKey=realGmailProvider.getSessionKey();
    const { emails, isReal } = await this.getAvailableEmails();
    if(sessionKey!==realGmailProvider.getSessionKey())throw new Error('La sesión cambió durante la lectura.');
    const providerSource = isReal
      ? 'Gmail API Real (Tu Cuenta Personal)'
      : 'Servidor de Pruebas (Simulado)';

    const health = await fetchLlmHealth();

    if (health.configured) {
      try {
        return await this.runLlmAgent(prompt, emails, isReal, providerSource);
      } catch (err) {
        if(sessionKey!==realGmailProvider.getSessionKey())throw new Error('La sesión cambió. Inicia otra consulta.');
        console.warn('LLM no disponible; se usará el motor de reglas.');
        const fallback = await this.runRuleBasedAgent(prompt, emails, isReal, providerSource);
        fallback.steps.unshift({
          type: 'GUARDRAIL_CHECK',
          message: `LLM no disponible (${err instanceof Error ? err.message : 'error'}). Fallback activado.`,
          timestamp: this.timestamp(),
        });
        return fallback;
      }
    }

    return this.runRuleBasedAgent(prompt, emails, isReal, providerSource);
  }
}

export const agentEngine = new AgentEngine();
