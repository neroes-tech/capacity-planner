-- =============================================================
-- Capacity Planner — Migration: Google Calendar integration
-- Corre no Supabase SQL Editor (Dashboard → SQL Editor → New query)
-- =============================================================

-- 1. Ampliar a constraint CHECK de entries.source
ALTER TABLE entries DROP CONSTRAINT IF EXISTS entries_source_check;
ALTER TABLE entries ADD CONSTRAINT entries_source_check
  CHECK (source IN ('manual', 'motion', 'gcal'));

-- 2. Mapeamento de eventos recorrentes → workspace
CREATE TABLE IF NOT EXISTS recurring_mappings (
  id                   uuid        PRIMARY KEY DEFAULT uuid_generate_v4(),
  recurring_event_id   text        NOT NULL UNIQUE,
  summary              text,
  planner_workspace_id uuid        REFERENCES workspaces(id) ON DELETE SET NULL,
  is_personal          boolean     NOT NULL DEFAULT false,
  created_at           timestamptz NOT NULL DEFAULT now(),
  updated_at           timestamptz NOT NULL DEFAULT now()
);

-- 3. Mapeamento de cor do Google Calendar → workspace (para one-offs)
CREATE TABLE IF NOT EXISTS workspace_colors (
  id                   uuid        PRIMARY KEY DEFAULT uuid_generate_v4(),
  color_id             text        NOT NULL UNIQUE,
  planner_workspace_id uuid        REFERENCES workspaces(id) ON DELETE SET NULL,
  created_at           timestamptz NOT NULL DEFAULT now()
);

-- 4. Override manual de evento específico → workspace
CREATE TABLE IF NOT EXISTS event_overrides (
  id                   uuid        PRIMARY KEY DEFAULT uuid_generate_v4(),
  event_id             text        NOT NULL UNIQUE,
  planner_workspace_id uuid        REFERENCES workspaces(id) ON DELETE SET NULL,
  created_at           timestamptz NOT NULL DEFAULT now()
);

-- Índices
CREATE INDEX IF NOT EXISTS recurring_mappings_ws_idx  ON recurring_mappings(planner_workspace_id);
CREATE INDEX IF NOT EXISTS workspace_colors_ws_idx    ON workspace_colors(planner_workspace_id);
CREATE INDEX IF NOT EXISTS event_overrides_ws_idx     ON event_overrides(planner_workspace_id);

-- RLS — mesmo padrão das outras tabelas (anon_all)
ALTER TABLE recurring_mappings ENABLE ROW LEVEL SECURITY;
ALTER TABLE workspace_colors   ENABLE ROW LEVEL SECURITY;
ALTER TABLE event_overrides    ENABLE ROW LEVEL SECURITY;

CREATE POLICY "anon_all" ON recurring_mappings FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "anon_all" ON workspace_colors   FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "anon_all" ON event_overrides    FOR ALL USING (true) WITH CHECK (true);
