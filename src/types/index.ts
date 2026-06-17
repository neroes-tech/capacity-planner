export interface Person {
  id: string
  name: string
  weekly_hours: number
  email: string | null
}

export interface Workspace {
  id: string
  name: string
  short_name: string
  color: string
  team_objective_pct: number
}

export interface Entry {
  id: string
  week: string
  person_id: string
  workspace_id: string
  tipo: 'Real' | 'Planeado'
  hours: number
  note: string | null
  source: 'manual' | 'motion'
  motion_task_id: string | null
  created_at: string
}

export interface EntryWithRelations extends Entry {
  person: Person
  workspace: Workspace
}

export interface Settings {
  id: number
  efficiency_factor: number
}

export interface WeeklyObjective {
  id: string
  week: string
  workspace_id: string
  target_pct: number
}

export interface MotionMapping {
  id: string
  motion_workspace_id: string
  motion_workspace_name: string
  planner_workspace_id: string | null
  created_at: string
}

export interface SyncResult {
  success: boolean
  imported: number
  updated: number
  unmappedWorkspaces: string[]
  unknownAssignees: string[]
  errors: string[]
}
