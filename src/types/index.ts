export interface Person {
  id: string
  name: string
  weekly_hours: number
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
