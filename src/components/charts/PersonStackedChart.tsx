import {
  ComposedChart, Bar, Line, XAxis, YAxis, CartesianGrid, Tooltip,
  Legend, ResponsiveContainer,
} from 'recharts'
import { useWeekEntries, usePeople, useWorkspaces, useSettings } from '../../hooks/useCapacityData'
import { round1 } from '../../lib/utils'

interface Props {
  week: string
}

export default function PersonStackedChart({ week }: Props) {
  const { data: entries, isLoading: loadingE } = useWeekEntries(week)
  const { data: people, isLoading: loadingP } = usePeople()
  const { data: workspaces, isLoading: loadingW } = useWorkspaces()
  const { data: settings, isLoading: loadingS } = useSettings()

  if (loadingE || loadingP || loadingW || loadingS) {
    return <Skeleton />
  }

  const factor = settings?.efficiency_factor ?? 0.85
  const realEntries = (entries ?? []).filter((e) => e.tipo === 'Real')

  if (realEntries.length === 0) {
    return (
      <div>
        <h2 className="text-sm font-semibold text-[#1E2B26] mb-4">Horas por Pessoa e Workspace</h2>
        <div className="h-64 flex items-center justify-center text-sm text-gray-400">
          Ainda não há registos Reais nesta semana.
        </div>
      </div>
    )
  }

  const ws = workspaces ?? []
  const ppl = people ?? []

  const chartData = ppl.map((person) => {
    const row: Record<string, number | string> = {
      name: person.name,
      capacity: round1(person.weekly_hours * factor),
    }
    let total = 0
    ws.forEach((w) => {
      const h = realEntries
        .filter((e) => e.person_id === person.id && e.workspace_id === w.id)
        .reduce((s, e) => s + e.hours, 0)
      row[w.id] = h
      total += h
    })
    row._total = total
    return row
  }).filter((r) => (r._total as number) > 0 || (r.capacity as number) > 0)

  return (
    <div>
      <h2 className="text-sm font-semibold text-[#1E2B26] mb-4">
        Horas por Pessoa e Workspace (Reais)
      </h2>
      <ResponsiveContainer width="100%" height={300}>
        <ComposedChart data={chartData} margin={{ top: 16, right: 24, left: -16, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
          <XAxis dataKey="name" tick={{ fontSize: 12, fill: '#6b7280' }} />
          <YAxis
            unit=" h"
            tick={{ fontSize: 11, fill: '#6b7280' }}
            domain={[0, 'auto']}
          />
          <Tooltip
            formatter={(value: number, name: string) => {
              if (name === 'Capacidade efetiva') return [`${value} h`, name]
              const w = ws.find((x) => x.id === name)
              return [`${value} h`, w?.short_name ?? name]
            }}
            contentStyle={{ fontSize: 12, borderRadius: 8, border: '1px solid #e5e7eb' }}
          />
          <Legend
            formatter={(value) => {
              if (value === 'Capacidade efetiva') return value
              const w = ws.find((x) => x.id === value)
              return w?.short_name ?? value
            }}
            iconSize={10}
            wrapperStyle={{ fontSize: 12 }}
          />

          {ws.map((w) => (
            <Bar
              key={w.id}
              dataKey={w.id}
              stackId="hours"
              fill={w.color}
              name={w.id}
            />
          ))}

          <Line
            dataKey="capacity"
            name="Capacidade efetiva"
            type="monotone"
            stroke="#0E6B5C"
            strokeWidth={2}
            dot={{ fill: '#0E6B5C', r: 4 }}
            strokeDasharray="6 3"
          />
        </ComposedChart>
      </ResponsiveContainer>

      {/* Legenda de workspaces */}
      <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1">
        {ws.map((w) => (
          <div key={w.id} className="flex items-center gap-1.5 text-xs text-gray-500">
            <span
              className="inline-block w-2 h-2 rounded-sm shrink-0"
              style={{ backgroundColor: w.color }}
              aria-hidden="true"
            />
            {w.short_name}
          </div>
        ))}
        <div className="flex items-center gap-1.5 text-xs text-gray-500">
          <span className="inline-block w-4 border-t-2 border-dashed border-[#0E6B5C]" aria-hidden="true" />
          Capacidade efetiva ({Math.round(factor * 100)}%)
        </div>
      </div>
    </div>
  )
}

function Skeleton() {
  return (
    <div>
      <h2 className="text-sm font-semibold text-[#1E2B26] mb-4">Horas por Pessoa e Workspace</h2>
      <div className="h-72 bg-gray-100 rounded-lg animate-pulse" />
    </div>
  )
}
