import { useEffect, useState } from 'react'
import {
  useWorkspaces,
  useWeeklyObjectives,
  useUpsertWeeklyObjectives,
} from '../../hooks/useCapacityData'
import { toWednesday, toDateString, addDays, parseDateString, formatWeekLabel } from '../../lib/utils'

interface Props {
  currentWeek: string
}

export default function WeeklyObjectivesAdmin({ currentWeek }: Props) {
  const [week, setWeek] = useState(currentWeek)
  const { data: workspaces } = useWorkspaces()
  const { data: objectives, isLoading } = useWeeklyObjectives(week)
  const upsert = useUpsertWeeklyObjectives()

  // pcts[workspace_id] = string value
  const [pcts, setPcts] = useState<Record<string, string>>({})
  const [saved, setSaved] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Sync pcts when objectives or workspaces load
  useEffect(() => {
    if (!workspaces) return
    const next: Record<string, string> = {}
    workspaces.forEach((ws) => {
      const obj = objectives?.find((o) => o.workspace_id === ws.id)
      next[ws.id] = String(obj ? obj.target_pct : ws.team_objective_pct)
    })
    setPcts(next)
    setSaved(false)
  }, [objectives, workspaces, week])

  const total = Object.values(pcts).reduce((s, v) => s + (parseFloat(v) || 0), 0)
  const hasCustom = objectives && objectives.length > 0

  async function handleSave() {
    setError(null)
    const rows = (workspaces ?? []).map((ws) => ({
      workspace_id: ws.id,
      target_pct: parseFloat(pcts[ws.id] ?? '0') || 0,
    }))
    try {
      await upsert.mutateAsync({ week, objectives: rows })
      setSaved(true)
    } catch {
      setError('Erro ao guardar objetivos.')
    }
  }

  function shiftWeek(days: number) {
    setWeek(toDateString(addDays(parseDateString(week), days)))
    setSaved(false)
    setError(null)
  }

  function handleDateChange(e: React.ChangeEvent<HTMLInputElement>) {
    if (!e.target.value) return
    setWeek(toDateString(toWednesday(new Date(e.target.value + 'T12:00:00'))))
    setSaved(false)
  }

  return (
    <div className="space-y-4">
      <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wide">
        Objetivos por Semana
      </h3>
      <p className="text-xs text-gray-500">
        Define % objetivo por workspace para uma semana específica.
        Se não definires, usa o padrão de cada workspace.
      </p>

      {/* Seletor de semana */}
      <div className="flex items-center gap-2">
        <button onClick={() => shiftWeek(-7)} aria-label="Semana anterior"
          className="w-7 h-7 flex items-center justify-center rounded-lg border border-gray-200 hover:bg-gray-50 text-sm">
          ←
        </button>
        <div className="relative flex-1 text-center">
          <span className="text-sm font-medium text-[#1E2B26]">{formatWeekLabel(week)}</span>
          <input type="date" defaultValue={week} onChange={handleDateChange}
            className="absolute inset-0 opacity-0 cursor-pointer w-full" />
        </div>
        <button onClick={() => shiftWeek(7)} aria-label="Semana seguinte"
          className="w-7 h-7 flex items-center justify-center rounded-lg border border-gray-200 hover:bg-gray-50 text-sm">
          →
        </button>
      </div>

      {hasCustom && (
        <p className="text-xs text-[#0E6B5C] bg-[#0E6B5C]/5 rounded-lg px-3 py-1.5">
          Esta semana tem objetivos personalizados definidos.
        </p>
      )}

      {isLoading ? (
        <p className="text-sm text-gray-400 animate-pulse">A carregar…</p>
      ) : (
        <ul className="space-y-2">
          {(workspaces ?? []).map((ws) => (
            <li key={ws.id} className="flex items-center gap-3 bg-gray-50 rounded-xl px-3 py-2">
              <span
                className="w-3 h-3 rounded-full shrink-0"
                style={{ backgroundColor: ws.color }}
                aria-hidden="true"
              />
              <span className="flex-1 text-sm text-[#1E2B26] truncate">{ws.short_name}</span>
              <span className="text-xs text-gray-400 tabular-nums">padrão {ws.team_objective_pct}%</span>
              <label htmlFor={`pct-${ws.id}`} className="sr-only">
                Objetivo para {ws.name}
              </label>
              <input
                id={`pct-${ws.id}`}
                type="number"
                min="0"
                max="100"
                step="0.5"
                value={pcts[ws.id] ?? ''}
                onChange={(e) => { setPcts(p => ({ ...p, [ws.id]: e.target.value })); setSaved(false) }}
                className="w-20 rounded-lg border border-gray-200 px-2 py-1 text-sm text-right tabular-nums focus:outline-none focus:ring-2 focus:ring-[#0E6B5C]"
              />
              <span className="text-sm text-gray-400">%</span>
            </li>
          ))}
        </ul>
      )}

      <div className="flex items-center justify-between pt-1">
        <p className={`text-sm font-semibold tabular-nums ${Math.abs(total - 100) > 0.1 ? 'text-amber-600' : 'text-[#0E6B5C]'}`}>
          Total: {Math.round(total * 10) / 10}%
          {Math.abs(total - 100) > 0.1 && ' ⚠'}
        </p>
        <div className="flex items-center gap-3">
          {saved && <span className="text-xs text-[#0E6B5C]">✓ Guardado</span>}
          {error && <span className="text-xs text-red-600">{error}</span>}
          <button
            onClick={handleSave}
            disabled={upsert.isPending}
            className="px-4 py-2 text-xs font-medium text-white bg-[#0E6B5C] rounded-lg hover:bg-[#0a5549] disabled:opacity-50 focus-visible:outline-2 focus-visible:outline-[#0E6B5C]"
          >
            {upsert.isPending ? 'A guardar…' : 'Guardar objetivos'}
          </button>
        </div>
      </div>
    </div>
  )
}
