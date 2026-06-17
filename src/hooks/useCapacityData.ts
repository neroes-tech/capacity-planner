import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '../lib/supabase'
import { toDateString, addDays, parseDateString } from '../lib/utils'
import type { Person, Workspace, Settings, EntryWithRelations } from '../types'

// ─── Queries ────────────────────────────────────────────────────────────────

export function usePeople() {
  return useQuery<Person[]>({
    queryKey: ['people'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('people')
        .select('*')
        .order('name')
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
        .from('workspaces')
        .select('*')
        .order('team_objective_pct', { ascending: false })
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
      const { data, error } = await supabase
        .from('settings')
        .select('*')
        .single()
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
          person:people(id, name, weekly_hours),
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
        .from('entries')
        .select('week, hours')
        .eq('tipo', 'Real')
        .order('week')
      if (error) throw error
      return data
    },
  })
}

// ─── Mutations ───────────────────────────────────────────────────────────────

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
      const { error } = await supabase.from('entries').insert(entry)
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
      if (!realEntries || realEntries.length === 0) {
        throw new Error('Não há registos Reais nesta semana para copiar.')
      }

      const { error: delErr } = await supabase
        .from('entries')
        .delete()
        .eq('week', nextWeek)
        .eq('tipo', 'Planeado')
      if (delErr) throw delErr

      const newEntries = realEntries.map((e) => ({
        week: nextWeek,
        person_id: e.person_id,
        workspace_id: e.workspace_id,
        tipo: 'Planeado' as const,
        hours: e.hours,
        note: e.note,
      }))

      const { error: insErr } = await supabase.from('entries').insert(newEntries)
      if (insErr) throw insErr

      return nextWeek
    },
    onSuccess: (nextWeek) => {
      qc.invalidateQueries({ queryKey: ['entries', nextWeek] })
    },
  })
}
