-- NexoMail: migration 001. Execute with nexomail_app, not postgres.
CREATE TABLE IF NOT EXISTS nexomail.schema_migrations (
    version integer PRIMARY KEY, applied_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS nexomail.accounts (
    id uuid PRIMARY KEY,
    provider text NOT NULL CHECK(provider IN ('gmail','microsoft')),
    provider_subject text NOT NULL,
    email text NOT NULL,
    display_name text NOT NULL DEFAULT '',
    created_at timestamptz NOT NULL DEFAULT now(),
    last_seen_at timestamptz NOT NULL DEFAULT now(),
    UNIQUE(provider,provider_subject)
);
CREATE TABLE IF NOT EXISTS nexomail.workspace_versions (
    account_id uuid NOT NULL REFERENCES nexomail.accounts(id) ON DELETE CASCADE,
    section text NOT NULL CHECK(section IN ('chat','drafts','preferences')),
    revision integer NOT NULL DEFAULT 0 CHECK(revision>=0),
    updated_at timestamptz NOT NULL DEFAULT now(),
    PRIMARY KEY(account_id,section)
);
CREATE TABLE IF NOT EXISTS nexomail.chat_messages (
    account_id uuid NOT NULL REFERENCES nexomail.accounts(id) ON DELETE CASCADE,
    message_id text NOT NULL,
    role text NOT NULL CHECK(role IN ('user','assistant')),
    content text NOT NULL,
    created_at timestamptz NOT NULL,
    position integer NOT NULL,
    PRIMARY KEY(account_id,message_id)
);
CREATE TABLE IF NOT EXISTS nexomail.mail_drafts (
    account_id uuid NOT NULL REFERENCES nexomail.accounts(id) ON DELETE CASCADE,
    draft_id text NOT NULL,
    recipient text NOT NULL DEFAULT '', cc text NOT NULL DEFAULT '', bcc text NOT NULL DEFAULT '',
    subject text NOT NULL DEFAULT '', body text NOT NULL DEFAULT '',
    reply_to_id text,
    attachments_omitted boolean NOT NULL DEFAULT false,
    created_at timestamptz NOT NULL,
    updated_at timestamptz NOT NULL DEFAULT now(),
    PRIMARY KEY(account_id,draft_id)
);
CREATE TABLE IF NOT EXISTS nexomail.user_preferences (
    account_id uuid PRIMARY KEY REFERENCES nexomail.accounts(id) ON DELETE CASCADE,
    theme text NOT NULL CHECK(theme IN ('light','dark')),
    strict_mode boolean NOT NULL DEFAULT true,
    llm_enabled boolean NOT NULL DEFAULT true,
    auto_grouping boolean NOT NULL DEFAULT true
);
CREATE TABLE IF NOT EXISTS nexomail.audit_events (
    account_id uuid NOT NULL REFERENCES nexomail.accounts(id) ON DELETE CASCADE,
    event_id text NOT NULL,
    action_type text NOT NULL,
    status text NOT NULL,
    description text NOT NULL DEFAULT '',
    details text NOT NULL DEFAULT '',
    occurred_at timestamptz NOT NULL,
    recorded_at timestamptz NOT NULL DEFAULT now(),
    source text NOT NULL DEFAULT 'extension_client' CHECK(source='extension_client'),
    PRIMARY KEY(account_id,event_id)
);
CREATE INDEX IF NOT EXISTS audit_account_time ON nexomail.audit_events(account_id,occurred_at DESC);
CREATE INDEX IF NOT EXISTS chat_account_order ON nexomail.chat_messages(account_id,position);
INSERT INTO nexomail.schema_migrations(version) VALUES(1) ON CONFLICT DO NOTHING;
