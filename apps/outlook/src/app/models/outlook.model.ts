/**
 * Modelos para la integración con Microsoft Outlook, Microsoft Graph API v1.0
 * y el Agente IA (Human-in-the-Loop, Acciones Pendientes y Auditoría).
 */

export interface EmailAddress {
  name: string;
  address: string;
}

export interface EmailSender {
  emailAddress: EmailAddress;
}

export interface MessageBody {
  contentType: 'text' | 'html';
  content: string;
}

export interface OutlookMessage {
  id: string;
  subject: string;
  bodyPreview?: string;
  body?: MessageBody;
  isRead?: boolean;
  receivedDateTime: string;
  from?: EmailSender;
  categories?: string[];
  folderKey?: string;
  parentFolderId?: string;
  isDraft?: boolean;
  flag?: { flagStatus: string };
  toRecipients?: EmailSender[];
  ccRecipients?: EmailSender[];
  bccRecipients?: EmailSender[];
  replyTo?: EmailSender[];
  hasAttachments?: boolean;
  attachments?: MailAttachment[];
}

export interface GraphMessagesResponse {
  '@odata.context'?: string;
  '@odata.nextLink'?: string;
  value: OutlookMessage[];
}

export interface GraphUserProfile {
  id?: string;
  displayName?: string;
  givenName?: string;
  surname?: string;
  mail?: string;
  userPrincipalName?: string;
  jobTitle?: string;
}

export type NavSection =
  | 'bandeja'
  | 'agente'
  | 'acciones'
  | 'auditoria'
  | 'inicio'
  | 'configuracion';

export interface NavItem {
  id: NavSection;
  label: string;
  icon: string;
  badge?: number | null;
  real: boolean;
}

// ─── Modelos para el Agente IA y Human-in-the-Loop ─────────────────
export type ActionType =
  | 'SEND_EMAIL'
  | 'DELETE_EMAIL'
  | 'ADD_CATEGORY'
  | 'MARK_AS_READ'
  | 'MARK_AS_UNREAD'
  | 'MOVE_EMAIL'
  | 'SET_FLAG';

export type ActionStatus = 'PENDING' | 'EXECUTING' | 'APPROVED' | 'REJECTED' | 'FAILED' | 'UNCERTAIN';
export type ExecutionMode = 'real' | 'simulated';

export interface PendingAction {
  id: string;
  action_type: ActionType;
  description: string;
  provider: 'microsoft';
  mode: ExecutionMode;
  parameters: Record<string, any>;
  requires_approval: boolean;
  status: ActionStatus;
  createdAt: Date;
  accountKey: string;
  accountLabel?: string;
  payloadVersion: number;
  payloadSnapshot?: string;
  errorMessage?: string;
}

export interface AuditLogItem {
  id: string;
  timestamp: Date;
  action_type: ActionType;
  description: string;
  provider: 'microsoft';
  mode: ExecutionMode;
  status: 'ACCEPTED' | 'APPROVED' | 'REJECTED' | 'FAILED' | 'UNCERTAIN' | 'EXECUTING' | 'EDITED';
  accountKey?: string;
  payloadVersion?: number;
  details?: string;
}

export interface ChatMessageUI {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
  proposed_actions?: PendingAction[];
}

export interface OutlookCategory {
  id: string;
  label: string;
  color: string;
  description: string;
}

export interface MailAttachment {
  id?: string;
  name: string;
  contentType: string;
  size: number;
  contentBytes?: string;
  isInline?: boolean;
}
export interface MailDraft {
  id: string;
  accountKey: string;
  mode: ExecutionMode;
  to: string;
  cc: string;
  bcc: string;
  subject: string;
  body: string;
  attachments: MailAttachment[];
  replyToId?: string;
  editingActionId?: string;
}
export interface MailFolder { id: string; displayName: string; parentFolderId?: string; }
