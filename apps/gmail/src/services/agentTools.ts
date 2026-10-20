import type { ActionType, AgentStep, Email, PendingAction } from '../types/email';
import { guardrails } from './guardrails';

export const AGENT_TOOL_DEFINITIONS = [
  {
    type: 'function',
    function: {
      name: 'list_priority_emails',
      description:
        'Lista correos no leídos o de alta prioridad/urgentes en la bandeja actual. Solo lectura.',
      parameters: { type: 'object', properties: {}, additionalProperties: false },
    },
  },
  {
    type: 'function',
    function: {
      name: 'search_emails',
      description: 'Busca correos por texto en asunto, remitente o fragmento. Solo lectura.',
      parameters: {
        type: 'object',
        properties: {
          query: { type: 'string', description: 'Texto a buscar' },
        },
        required: ['query'],
        additionalProperties: false,
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'get_email_details',
      description: 'Obtiene el cuerpo completo de un correo por id. Solo lectura.',
      parameters: {
        type: 'object',
        properties: {
          email_id: { type: 'string' },
        },
        required: ['email_id'],
        additionalProperties: false,
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'prepare_send_email',
      description:
        'Prepara el envío de un correo. NO envía: crea acción pendiente de aprobación humana.',
      parameters: {
        type: 'object',
        properties: {
          recipient: { type: 'string', description: 'Email del destinatario' },
          subject: { type: 'string' },
          body: { type: 'string', description: 'Cuerpo del mensaje en texto plano' },
          reply_to_email_id: {
            type: 'string',
            description: 'Opcional: id del correo al que se responde',
          },
        },
        required: ['recipient', 'subject', 'body'],
        additionalProperties: false,
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'prepare_bulk_cleanup',
      description:
        'Prepara mover a papelera correos de promociones/spam/suscripciones. Requiere aprobación.',
      parameters: {
        type: 'object',
        properties: {
          email_ids: {
            type: 'array',
            items: { type: 'string' },
            description: 'Ids de correos a eliminar. Si vacío, el sistema elige candidatos obvios.',
          },
        },
        additionalProperties: false,
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'prepare_label_emails',
      description:
        'Prepara aplicar una etiqueta a uno o más correos. En modo estricto requiere aprobación.',
      parameters: {
        type: 'object',
        properties: {
          email_ids: { type: 'array', items: { type: 'string' } },
          label: { type: 'string', description: 'Nombre de la etiqueta' },
        },
        required: ['email_ids', 'label'],
        additionalProperties: false,
      },
    },
  },
] as const;

export interface ToolExecutionContext {
  emails: Email[];
  isReal: boolean;
  sessionKey: string;
  providerSource: string;
  strictMode: boolean;
}

export interface ToolExecutionResult {
  content: string;
  pendingActions: PendingAction[];
  steps: AgentStep[];
  audit?: { actionType: ActionType; details: string; status: 'AUTO_EXECUTED' | 'HUMAN_APPROVED' };
  autoLabel?: { emailIds: string[]; label: string };
}

function timestamp() {
  return new Date().toLocaleTimeString('es-ES', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });
}

function isCleanupCandidate(e: Email): boolean {
  return (
    e.category === 'Suscripciones' ||
    e.labels.includes('Spam') ||
    e.labels.includes('Promociones') ||
    e.labels.includes('CATEGORY_PROMOTIONS')
  );
}

export function buildInboxContextSummary(emails: Email[], providerSource: string): string {
  const lines = emails.slice(0, 20).map(
    (e) =>
      `- id=${e.id} | ${e.read ? 'leído' : 'NO LEÍDO'} | ${e.priority} | ${e.category} | De: ${e.senderName} <${e.sender}> | Asunto: ${e.subject} | Snippet: ${e.snippet.slice(0, 120)}`
  );
  return `Proveedor: ${providerSource}\nCorreos disponibles (${emails.length}):\n${lines.join('\n')}`;
}

export function executeAgentTool(
  name: string,
  args: Record<string, unknown>,
  ctx: ToolExecutionContext
): ToolExecutionResult {
  const steps: AgentStep[] = [];
  const pendingActions: PendingAction[] = [];

  steps.push({
    type: 'TOOL_CALL',
    message: `Herramienta \`${name}\` invocada con argumentos: ${JSON.stringify(args)}`,
    timestamp: timestamp(),
    details: { tool: name, args },
  });

  switch (name) {
    case 'list_priority_emails': {
      steps.push({
        type: 'GUARDRAIL_CHECK',
        message: 'list_priority_emails → SAFE_AUTO (solo lectura)',
        timestamp: timestamp(),
      });
      const unread = ctx.emails.filter(
        (e) => !e.read || e.priority === 'urgent' || e.priority === 'high'
      );
      const summary =
        unread.length > 0
          ? unread
              .map(
                (e) =>
                  `• [${e.category}] ${e.subject} — ${e.senderName} (${e.date}) id=${e.id}`
              )
              .join('\n')
          : 'No hay correos prioritarios o no leídos.';
      return {
        content: JSON.stringify({ count: unread.length, emails: summary }),
        pendingActions,
        steps,
        audit: {
          actionType: 'LIST_EMAILS',
          details: `Consultados ${unread.length} correos prioritarios`,
          status: 'AUTO_EXECUTED',
        },
      };
    }

    case 'search_emails': {
      const query = String(args.query ?? '').toLowerCase();
      steps.push({
        type: 'GUARDRAIL_CHECK',
        message: 'search_emails → SAFE_AUTO',
        timestamp: timestamp(),
      });
      const hits = ctx.emails.filter(
        (e) =>
          e.subject.toLowerCase().includes(query) ||
          e.snippet.toLowerCase().includes(query) ||
          e.senderName.toLowerCase().includes(query) ||
          e.sender.toLowerCase().includes(query)
      );
      return {
        content: JSON.stringify({
          query,
          count: hits.length,
          results: hits.map((e) => ({
            id: e.id,
            subject: e.subject,
            from: e.senderName,
            snippet: e.snippet,
          })),
        }),
        pendingActions,
        steps,
        audit: {
          actionType: 'LIST_EMAILS',
          details: `Búsqueda "${query}": ${hits.length} resultados`,
          status: 'AUTO_EXECUTED',
        },
      };
    }

    case 'get_email_details': {
      const id = String(args.email_id ?? '');
      const email = ctx.emails.find((e) => e.id === id);
      steps.push({
        type: 'GUARDRAIL_CHECK',
        message: 'get_email_details → SAFE_AUTO',
        timestamp: timestamp(),
      });
      if (!email) {
        return {
          content: JSON.stringify({ error: 'EMAIL_NOT_FOUND', email_id: id }),
          pendingActions,
          steps,
        };
      }
      return {
        content: JSON.stringify({
          id: email.id,
          subject: email.subject,
          from: email.sender,
          body: email.body,
          category: email.category,
          priority: email.priority,
        }),
        pendingActions,
        steps,
        audit: {
          actionType: 'SUMMARIZE_THREAD',
          details: `Detalle leído para ${id}`,
          status: 'AUTO_EXECUTED',
        },
      };
    }

    case 'prepare_send_email': {
      const recipient = String(args.recipient ?? '');
      let subject = String(args.subject ?? '');
      const body = String(args.body ?? '');
      const replyId = args.reply_to_email_id ? String(args.reply_to_email_id) : undefined;
      const replyEmail = replyId ? ctx.emails.find((e) => e.id === replyId) : undefined;
      if (replyEmail && !subject.toLowerCase().startsWith('re:')) {
        subject = `Re: ${replyEmail.subject}`;
      }

      steps.push({
        type: 'GUARDRAIL_CHECK',
        message: `prepare_send_email → REQUIRES_APPROVAL (${ctx.providerSource})`,
        timestamp: timestamp(),
      });

      const pending = guardrails.createPendingAction(
        'SEND_EMAIL',
        `Enviar correo a ${recipient}`,
        `Asunto: "${subject}"`,
        {
          recipient,
          subject,
          body,
          emailIds: replyId ? [replyId] : [],
          isReal: ctx.isReal,sessionKey:ctx.sessionKey,
        },
        `El agente preparó un envío real vía ${ctx.providerSource}. Edita y aprueba en Acciones Pendientes.`
      );
      pending.isEditable = true;
      pendingActions.push(pending);

      steps.push({
        type: 'ACTION_CREATED',
        message: `Acción ${pending.id} creada — esperando firma humana`,
        timestamp: timestamp(),
      });

      return {
        content: JSON.stringify({
          status: 'PENDING_APPROVAL',
          action_id: pending.id,
          recipient,
          subject,
        }),
        pendingActions,
        steps,
        audit: {
          actionType: 'SEND_EMAIL',
          details: `Borrador de envío a ${recipient}`,
          status: 'HUMAN_APPROVED',
        },
      };
    }

    case 'prepare_bulk_cleanup': {
      let ids = Array.isArray(args.email_ids)
        ? (args.email_ids as string[]).filter(Boolean)
        : [];
      if (ids.length === 0) {
        ids = ctx.emails.filter(isCleanupCandidate).map((e) => e.id);
        if (ids.length === 0) {
          ids = ctx.emails.slice(0, 2).map((e) => e.id);
        }
      }
      const targets = ctx.emails.filter((e) => ids.includes(e.id));

      steps.push({
        type: 'GUARDRAIL_CHECK',
        message: `prepare_bulk_cleanup → REQUIRES_APPROVAL (${targets.length} correos)`,
        timestamp: timestamp(),
      });

      const pending = guardrails.createPendingAction(
        'BULK_CLEANUP',
        `Eliminar ${targets.length} correo(s)`,
        `Remitentes: ${targets.map((t) => t.senderName).join(', ')}`,
        { emailIds: ids, reason: 'Limpieza solicitada por el usuario', isReal: ctx.isReal,sessionKey:ctx.sessionKey },
        'Acción destructiva: mover a papelera tras tu aprobación.'
      );
      pendingActions.push(pending);

      steps.push({
        type: 'ACTION_CREATED',
        message: `Acción ${pending.id} creada para limpieza masiva`,
        timestamp: timestamp(),
      });

      return {
        content: JSON.stringify({
          status: 'PENDING_APPROVAL',
          action_id: pending.id,
          count: targets.length,
          email_ids: ids,
        }),
        pendingActions,
        steps,
      };
    }

    case 'prepare_label_emails': {
      const ids = Array.isArray(args.email_ids) ? (args.email_ids as string[]) : [];
      const label = String(args.label ?? '').trim();
      const policy = guardrails.evaluateAction('LABEL_EMAIL', { emailIds: ids, label });

      if (policy.requiresHumanConfirmation || ctx.isReal) {
        steps.push({
          type: 'GUARDRAIL_CHECK',
          message: `prepare_label_emails → REQUIRES_APPROVAL (modo estricto)`,
          timestamp: timestamp(),
        });
        const pending = guardrails.createPendingAction(
          'LABEL_EMAIL',
          `Etiquetar ${ids.length} correo(s) con "${label}"`,
          `Ids: ${ids.join(', ')}`,
          { emailIds: ids, label, isReal: ctx.isReal,sessionKey:ctx.sessionKey },
          `Aplicar etiqueta "${label}" en ${ctx.providerSource}.`
        );
        if(ctx.isReal)pending.safetyLevel='REQUIRES_APPROVAL';
        pendingActions.push(pending);
        steps.push({
          type: 'ACTION_CREATED',
          message: `Acción ${pending.id} para etiquetado`,
          timestamp: timestamp(),
        });
        return {
          content: JSON.stringify({
            status: 'PENDING_APPROVAL',
            action_id: pending.id,
            label,
            email_ids: ids,
          }),
          pendingActions,
          steps,
        };
      }

      steps.push({
        type: 'GUARDRAIL_CHECK',
        message: 'prepare_label_emails → SAFE_AUTO (modo permisivo)',
        timestamp: timestamp(),
      });
      return {
        content: JSON.stringify({
          status: 'EXECUTED',
          label,
          email_ids: ids,
        }),
        pendingActions,
        steps,
        autoLabel: { emailIds: ids, label },
        audit: {
          actionType: 'LABEL_EMAIL',
          details: `Etiqueta "${label}" en ${ids.length} correo(s)`,
          status: 'AUTO_EXECUTED',
        },
      };
    }

    default:
      return {
        content: JSON.stringify({ error: 'UNKNOWN_TOOL', name }),
        pendingActions,
        steps,
      };
  }
}
