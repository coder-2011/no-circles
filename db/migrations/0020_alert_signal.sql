create table if not exists public.admin_alert_state (
  alert_key text primary key,
  kind text not null,
  last_sent_at timestamptz not null,
  send_count integer not null default 1,
  last_payload_hash text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists admin_alert_state_kind_idx
  on public.admin_alert_state (kind);

create index if not exists admin_alert_state_last_sent_at_idx
  on public.admin_alert_state (last_sent_at);
