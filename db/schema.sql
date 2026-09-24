-- Fermer: схема БД (PostgreSQL 14+; Vercel Postgres / Neon / Supabase).
-- Скрипт идемпотентен: его можно запускать повторно (npm run db:migrate).

create table if not exists users (
  id          bigserial primary key,
  telegram_id bigint      not null unique,
  name        text        not null,
  username    text,
  role        text        not null default 'worker' check (role in ('worker', 'admin')),
  created_at  timestamptz not null default now()
);

create table if not exists marks (
  id            bigserial primary key,
  worker_id     bigint           not null references users(id) on delete restrict,
  created_by_id bigint           not null references users(id) on delete restrict,
  lat           double precision not null check (lat between -90 and 90),
  lng           double precision not null check (lng between -180 and 180),
  bales_count   integer          not null check (bales_count > 0 and bales_count <= 100000),
  date          timestamptz      not null default now(),
  created_at    timestamptz      not null default now(),
  updated_by_id bigint           references users(id) on delete restrict,
  updated_at    timestamptz
);

create index if not exists marks_worker_date_idx on marks (worker_id, date);
create index if not exists marks_date_idx on marks (date);

-- Журнал аудита: создание / изменение / удаление отметок и смена ролей.
-- entity_id без внешнего ключа, чтобы запись переживала удаление отметки.
create table if not exists audit_log (
  id          bigserial primary key,
  entity      text        not null check (entity in ('mark', 'user')),
  entity_id   bigint      not null,
  action      text        not null,
  actor_id    bigint      not null references users(id) on delete restrict,
  before      jsonb,
  after       jsonb,
  created_at  timestamptz not null default now()
);

-- Миграции поверх первой версии схемы (идемпотентно).
-- name_custom = true: пользователь задал имя сам, при входе оно не перезаписывается именем из Telegram.
alter table users add column if not exists name_custom boolean not null default false;
alter table audit_log drop constraint if exists audit_log_action_check;
alter table audit_log add constraint audit_log_action_check
  check (action in ('create', 'update', 'delete', 'role', 'rename'));

-- Вход без Telegram: пользователь создаётся по имени, telegram_id пустой.
alter table users alter column telegram_id drop not null;
-- kind: telegram — вошёл через бота; web — зарегистрировался в браузере;
-- manual — рабочий, вписанный админом в отметку (сам в приложение не входит).
alter table users add column if not exists kind text not null default 'telegram';
alter table users drop constraint if exists users_kind_check;
alter table users add constraint users_kind_check check (kind in ('telegram', 'web', 'manual'));
create unique index if not exists users_manual_name_idx on users (lower(name)) where kind = 'manual';

-- Логин и пароль для входа через браузер. Отдельная таблица, чтобы хэш пароля
-- никогда не попадал в ответы API вместе с записью пользователя.
create table if not exists user_credentials (
  user_id       bigint      primary key references users(id) on delete cascade,
  login         text        not null,
  password_hash text        not null,
  updated_at    timestamptz not null default now()
);
create unique index if not exists user_credentials_login_idx on user_credentials (lower(login));

create index if not exists audit_log_entity_idx on audit_log (entity, entity_id, created_at desc);
create index if not exists audit_log_created_idx on audit_log (created_at desc);

-- Счётчики rate limiting (фиксированное окно), общие для всех serverless-инстансов.
create table if not exists rate_limits (
  key          text        not null,
  window_start timestamptz not null,
  count        integer     not null default 0,
  primary key (key, window_start)
);

create index if not exists rate_limits_window_idx on rate_limits (window_start);

-- Сессии браузерного входа: в БД хранится только SHA-256 токена из cookie.
create table if not exists sessions (
  token_hash   text        primary key,
  user_id      bigint      not null references users(id) on delete cascade,
  created_at   timestamptz not null default now(),
  last_seen_at timestamptz not null default now(),
  expires_at   timestamptz not null
);

create index if not exists sessions_user_idx on sessions (user_id);

-- Supabase публикует схему public через REST API (anon key). Приложение ходит в БД
-- напрямую под владельцем таблиц, поэтому включаем RLS без политик — это закрывает
-- доступ через PostgREST. На Neon/Vercel Postgres команды безвредны.
alter table users       enable row level security;
alter table marks       enable row level security;
alter table audit_log   enable row level security;
alter table rate_limits enable row level security;
alter table sessions    enable row level security;
alter table user_credentials enable row level security;
