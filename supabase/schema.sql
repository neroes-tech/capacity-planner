-- =============================================================
-- Capacity Planner – Neroes
-- Corre este ficheiro no SQL Editor do Supabase
-- =============================================================

-- Extensão para UUIDs
create extension if not exists "uuid-ossp";

-- =============================================================
-- TABELAS
-- =============================================================

create table people (
  id           uuid primary key default uuid_generate_v4(),
  name         text not null,
  weekly_hours numeric not null default 40 check (weekly_hours > 0)
);

create table workspaces (
  id                  uuid primary key default uuid_generate_v4(),
  name                text not null,
  short_name          text not null,
  color               text not null,
  team_objective_pct  numeric not null check (team_objective_pct >= 0 and team_objective_pct <= 100)
);

-- Tabela de settings com uma única linha garantida
create table settings (
  id               integer primary key default 1,
  efficiency_factor numeric not null default 0.85 check (efficiency_factor > 0 and efficiency_factor <= 1),
  constraint single_row check (id = 1)
);

create table entries (
  id           uuid primary key default uuid_generate_v4(),
  week         date not null,  -- sempre uma quarta-feira (YYYY-MM-DD)
  person_id    uuid not null references people(id) on delete cascade,
  workspace_id uuid not null references workspaces(id) on delete cascade,
  tipo         text not null check (tipo in ('Real', 'Planeado')),
  hours        numeric not null check (hours > 0),
  note         text,
  created_at   timestamptz not null default now()
);

create index entries_week_idx        on entries(week);
create index entries_person_week_idx on entries(person_id, week);

-- =============================================================
-- ROW LEVEL SECURITY
-- =============================================================
-- Por defeito: requer sessão autenticada.
-- Para uso interno sem autenticação, vê a secção OPÇÃO B abaixo.

alter table people     enable row level security;
alter table workspaces enable row level security;
alter table settings   enable row level security;
alter table entries    enable row level security;

-- OPÇÃO A – utilizadores autenticados (modo padrão)
create policy "auth_select" on people     for select using (auth.role() = 'authenticated');
create policy "auth_all"    on people     for all    using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated');

create policy "auth_select" on workspaces for select using (auth.role() = 'authenticated');
create policy "auth_all"    on workspaces for all    using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated');

create policy "auth_select" on settings   for select using (auth.role() = 'authenticated');
create policy "auth_all"    on settings   for all    using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated');

create policy "auth_select" on entries    for select using (auth.role() = 'authenticated');
create policy "auth_all"    on entries    for all    using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated');

-- OPÇÃO B – acesso livre com chave anon (uso interno sem login)
-- Descomenta este bloco e comenta a OPÇÃO A se não quiseres autenticação:
--
-- drop policy if exists "auth_select" on people;
-- drop policy if exists "auth_all"    on people;
-- create policy "anon_all" on people     for all using (true) with check (true);
--
-- drop policy if exists "auth_select" on workspaces;
-- drop policy if exists "auth_all"    on workspaces;
-- create policy "anon_all" on workspaces for all using (true) with check (true);
--
-- drop policy if exists "auth_select" on settings;
-- drop policy if exists "auth_all"    on settings;
-- create policy "anon_all" on settings   for all using (true) with check (true);
--
-- drop policy if exists "auth_select" on entries;
-- drop policy if exists "auth_all"    on entries;
-- create policy "anon_all" on entries    for all using (true) with check (true);

-- =============================================================
-- SEEDS
-- =============================================================

insert into settings (id, efficiency_factor) values (1, 0.85)
  on conflict (id) do nothing;

insert into people (name, weekly_hours) values
  ('Pedro',   24),
  ('Bruno',   40),
  ('Matilde', 40),
  ('André',   24),
  ('Duarte',  40),
  ('Joana',   20),
  ('Sofia',   20);

insert into workspaces (name, short_name, color, team_objective_pct) values
  ('Current value-stream bottleneck', 'Bottleneck',     '#C94A57', 45),
  ('Customer/cash commitments',       'Commitments',    '#1B7F8E', 18),
  ('Productization + AI leverage',    'Productization', '#6A4FB3', 14),
  ('Future Demand Creation',          'Future Demand',  '#D9892B',  9),
  ('Operating Foundation',            'Foundation',     '#578A56',  9),
  ('Protected deep R&D',              'R&D',            '#44546A',  5);
