import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '../lib/supabase'
import { toDateString, addDays, parseDateString } from '../lib/utils'
import type {
  Person, Workspace, Settings, EntryWithRelations,
  WeeklyObjective, MotionMapping, SyncResult,
} from '../types'

// ─── Queries ────────────────────────────────────────────────────────────────

export function usePeople() {
  return useQuery<Person[]>({
    queryKey: ['people'],
    queryFn: async () => {
      const { data, error } = await supabase.from('people').select('*').order('name')
      if (error) throw error
      return data
    },
    staleTime: Infinity,
  })
}

export function useWorkspaces() {
  return useQuery<Workspace[]>({
    queryKey: ['workspaces'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('workspaces').select('*').order('team_objective_pct', { ascending: false })
      if (error) throw error
      return data
    },
    staleTime: Infinity,
  })
}

export function useSettings() {
  return useQuery<Settings>({
    queryKey: ['settings'],
    queryFn: async () => {
      const { data, error } = await supabase.from('settings').select('*').single()
      if (error) throw error
      return data
    },
    staleTime: Infinity,
  })
}

export function useWeekEntries(week: string) {
  return useQuery<EntryWithRelations[]>({
    queryKey: ['entries', week],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('entries')
        .select(`
          *,
          person:people(id, name, weekly_hours, email),
          workspace:workspaces(id, name, short_name, color, team_objective_pct)
        `)
        .eq('week', week)
        .order('created_at', { ascending: false })
      if (error) throw error
      return data as EntryWithRelations[]
    },
  })
}

export function useAllRealEntries() {
  return useQuery<{ week: string; hours: number }[]>({
    queryKey: ['entries', 'all-real'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('entries').select('week, hours').eq('tipo', 'Real').order('week')
      if (error) throw error
      return data
    },
  })
}

export function useWeeklyObjectives(week: string) {
  return useQuery<WeeklyObjective[]>({
    queryKey: ['weekly_objectives', week],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('weekly_objectives').select('*').eq('week', week)
      if (error) throw error
      return data ?? []
    },
  })
}

export function useMotionMappings() {
  return useQuery<MotionMapping[]>({
    queryKey: ['motion_mappings'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('motion_mappings').select('*').order('motion_workspace_name')
      if (error) throw error
      return data ?? []
    },
  })
}

// ─── Entry Mutations ─────────────────────────────────────────────────────────

interface NewEntry {
  week: string
  person_id: string
  workspace_id: string
  tipo: 'Real' | 'Planeado'
  hours: number
  note?: string
}

export function useAddEntry() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (entry: NewEntry) => {
      const { error } = await supabase.from('entries').insert({ ...entry, source: 'manual' })
      if (error) throw error
    },
    onSuccess: (_d, vars) => {
      qc.invalidateQueries({ queryKey: ['entries', vars.week] })
      qc.invalidateQueries({ queryKey: ['entries', 'all-real'] })
    },
  })
}

export function useDeleteEntry() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ id, week }: { id: string; week: string }) => {
      const { error } = await supabase.from('entries').delete().eq('id', id)
      if (error) throw error
      return week
    },
    onSuccess: (_d, vars) => {
      qc.invalidateQueries({ queryKey: ['entries', vars.week] })
      qc.invalidateQueries({ queryKey: ['entries', 'all-real'] })
    },
  })
}

export function useGenerateNextWeekPlan() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (currentWeek: string) => {
      const nextWeek = toDateString(addDays(parseDateString(currentWeek), 7))

      const { data: realEntries, error: fetchErr } = await supabase
        .from('entries')
        .select('person_id, workspace_id, hours, note')
        .eq('week', currentWeek)
        .eq('tipo', 'Real')

      if (fetchErr) throw fetchErr
      if (!realEntries || realEntries.length === 0)
        throw new Error('Não há registos Reais nesta semana para copiar.')

      const { error: delErr } = await supabase
        .from('entries').delete().eq('week', nextWeek).eq('tipo', 'Planeado')
      if (delErr) throw delErr

      const { error: insErr } = await supabase.from('entries').insert(
        realEntries.map((e) => ({
          week: nextWeek, person_id: e.person_id, workspace_id: e.workspace_id,
          tipo: 'Planeado' as const, hours: e.hours, note: e.note, source: 'manual',
        })),
      )
      if (insErr) throw insErr
      return nextWeek
    },
    onSuccess: (nextWeek) => {
      qc.invalidateQueries({ queryKey: ['entries', nextWeek] })
    },
  })
}

// ─── People Mutations ────────────────────────────────────────────────────────

type PersonInput = Pick<Person, 'name' | 'weekly_hours'> & { email?: string | null }

export function useAddPerson() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (data: PersonInput) => {
      const { error } = await supabase.from('people').insert(data)
      if (error) throw error
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['people'] }),
  })
}

export function useUpdatePerson() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ id, ...data }: Partial<PersonInput> & { id: string }) => {
      const { error } = await supabase.from('people').update(data).eq('id', id)
      if (error) throw error
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['people'] }),
  })
}

export function useDeletePerson() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('people').delete().eq('id', id)
      if (error) throw error
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['people'] }),
  })
}

// ─── Workspace Mutations ─────────────────────────────────────────────────────

type WorkspaceInput = Omit<Workspace, 'id'>

export function useAddWorkspace() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (data: WorkspaceInput) => {
      const { error } = await supabase.from('workspaces').insert(data)
      if (error) throw error
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['workspaces'] }),
  })
}

export function useUpdateWorkspace() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ id, ...data }: Partial<WorkspaceInput> & { id: string }) => {
      const { error } = await supabase.from('workspaces').update(data).eq('id', id)
      if (error) throw error
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['workspaces'] }),
  })
}

export function useDeleteWorkspace() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('workspaces').delete().eq('id', id)
      if (error) throw error
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['workspaces'] }),
  })
}

// ─── Weekly Objectives ───────────────────────────────────────────────────────

export function useUpsertWeeklyObjectives() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({
      week, objectives,
    }: { week: string; objectives: { workspace_id: string; target_pct: number }[] }) => {
      const { error } = await supabase
        .from('weekly_objectives')
        .upsert(objectives.map((o) => ({ week, ...o })), { onConflict: 'week,workspace_id' })
      if (error) throw error
    },
    onSuccess: (_d, vars) => {
      qc.invalidateQueries({ queryKey: ['weekly_objectives', vars.week] })
    },
  })
}

// ─── Settings ────────────────────────────────────────────────────────────────

export function useUpdateSettings() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (efficiency_factor: number) => {
      const { error } = await supabase.from('settings').update({ efficiency_factor }).eq('id', 1)
      if (error) throw error
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['settings'] }),
  })
}

// ─── Motion Mappings ─────────────────────────────────────────────────────────

export function useUpdateMotionMapping() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ id, planner_workspace_id }: { id: string; planner_workspace_id: string | null }) => {
      const { error } = await supabase
        .from('motion_mappings').update({ planner_workspace_id }).eq('id', id)
      if (error) throw error
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['motion_mappings'] }),
  })
}

// ─── Motion Sync ─────────────────────────────────────────────────────────────

export function useSyncMotion() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (): Promise<SyncResult> => {
      const { data, error } = await supabase.functions.invoke('sync-motion')
      if (error) throw error
      return data as SyncResult
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['entries'] })
      qc.invalidateQueries({ queryKey: ['motion_mappings'] })
    },
  })
}
