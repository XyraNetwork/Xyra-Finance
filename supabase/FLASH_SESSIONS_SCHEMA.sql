create table if not exists public.flash_sessions (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  status text not null default 'opened',
  user_address text not null,
  strategy_wallet text not null,
  asset_id text not null check (asset_id in ('0field','1field','2field')),
  principal_micro bigint not null,
  min_profit_micro bigint not null default 0,
  strategy_id_field text not null,
  flash_open_tx_id text not null,
  vault_fund_tx_id text null,
  flash_settle_tx_id text null,
  expected_repay_micro bigint null,
  actual_repay_micro bigint null,
  profit_micro bigint null,
  idempotency_key text null unique,
  expires_at timestamptz null,
  error_message text null
);

create index if not exists flash_sessions_status_idx on public.flash_sessions(status);
create index if not exists flash_sessions_created_at_idx on public.flash_sessions(created_at desc);
create index if not exists flash_sessions_open_tx_idx on public.flash_sessions(flash_open_tx_id);

