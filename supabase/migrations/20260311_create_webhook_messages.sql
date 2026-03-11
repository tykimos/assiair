-- Webhook messages table: stores pending triggers from external systems.
-- The widget subscribes via Supabase Realtime and fires them through the orchestration pipeline.

create table if not exists webhook_messages (
  id            bigint generated always as identity primary key,
  message_id    text not null unique,
  app           text not null default 'default',
  session_id    text not null,
  message       text not null,
  context       jsonb not null default '{}',
  status        text not null default 'pending',   -- 'pending' | 'consumed'
  consumed_at   timestamptz,
  created_at    timestamptz not null default now()
);

-- Index for finding pending messages by session_id
create index if not exists idx_webhook_messages_session_status
  on webhook_messages (session_id, status)
  where status = 'pending';

-- Index for cleanup of old consumed messages
create index if not exists idx_webhook_messages_created_at
  on webhook_messages (created_at);

-- Enable Realtime for this table so the widget receives INSERT events instantly
alter publication supabase_realtime add table webhook_messages;
