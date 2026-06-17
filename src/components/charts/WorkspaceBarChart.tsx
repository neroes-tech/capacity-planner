import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  Legend, ResponsiveContainer, LabelList, Cell,
} from 'recharts'
import { useWeekEntries, useWorkspaces } from '../../hooks/useCapacityData'
import { round1 } from '../../lib/utils'

interface Props {
  week: string
}

export default function WorkspaceBarChart({ week }: Props) {
  const { data: entries, isLoading: loadingE } = useWeekEntries(week)
  const { data: workspaces, isLoading: loadingW } = useWorkspaces()

  if (loadingE || loadingW) {
    return <ChartSkeleton title="Real vs Objetivo por Workspace" />
  }

  const realEntries = (entries ?? []).filter((e) => e.tipo === 'Real')
  const totalReal = realEntries.reduce((s, e) => s + e.hours, 0)

  const chartData = (workspaces ?? []).map((ws) => {
    const wsHours = realEntries
      .filter((e) => e.workspace_id === ws.id)
      .reduce((s, e) => s + e.hours, 0)
    const realPct = totalReal > 0 ? round1((wsHours / totalReal) * 100) : 0
    return {
      name: ws.short_name,
      fullName: ws.name,
      Real: realPct,
      Objetivo: ws.team_objective_pct,
      color: ws.color,
    }
  })

  if (totalReal === 0) {
    return (
      <EmptyState
        title="Real vs Objetivo por Workspace"
        message="Ainda não há registos Reais nesta semana."
      />
    )
  }

  return (
    <div>
      <h2 className="text-sm font-semibold text-[#1E2B26] mb-4">
        Real vs Objetivo por Workspace
      </h2>
      <ResponsiveContainer width="100%" height={260}>
        <BarChart data={chartData} margin={{ top: 16, right: 8, left: -16, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
          <XAxis
            dataKey="name"
            tick={{ fontSize: 11, fill: '#6b7280' }}
            interval={0}
          />
          <YAxis
            unit="%"
            domain={[0, 'auto']}
            tick={{ fontSize: 11, fill: '#6b7280' }}
          />
          <Tooltip
            formatter={(value: number, name: string) => [`${value}%`, name]}
            labelFormatter={(label, payload) => payload?.[0]?.payload?.fullName ?? label}
            contentStyle={{ fontSize: 12, borderRadius: 8, border: '1px solid #e5e7eb' }}
          />
          <Legend
            iconSize={10}
            wrapperStyle={{ fontSize: 12 }}
          />
          {/* Real: cor do workspace via Cell */}
          <Bar dataKey="Real" name="% Real">
            {chartData.map((d, i) => (
              <Cell key={i} fill={d.color} />
            ))}
            <LabelList dataKey="Real" position="top" formatter={(v: number) => `${v}%`} style={{ fontSize: 10, fill: '#6b7280' }} />
          </Bar>
          {/* Objetivo: cor suavizada (semi-transparente do mesmo) */}
          <Bar dataKey="Objetivo" name="% Objetivo" fill="#d1d5db">
            <LabelList dataKey="Objetivo" position="top" formatter={(v: number) => `${v}%`} style={{ fontSize: 10, fill: '#9ca3af' }} />
          </Bar>
        </BarChart>
      </ResponsiveContainer>

      {/* Legenda de cores dos workspaces */}
      <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1">
        {(workspaces ?? []).map((ws) => (
          <div key={ws.id} className="flex items-center gap-1.5 text-xs text-gray-500">
            <span
              className="inline-block w-2 h-2 rounded-sm shrink-0"
              style={{ backgroundColor: ws.color }}
              aria-hidden="true"
            />
            {ws.short_name} — {ws.team_objective_pct}%
          </div>
        ))}
      </div>
    </div>
  )
}

function ChartSkeleton({ title }: { title: string }) {
  return (
    <div>
      <h2 className="text-sm font-semibold text-[#1E2B26] mb-4">{title}</h2>
      <div className="h-64 bg-gray-100 rounded-lg animate-pulse" />
    </div>
  )
}

function EmptyState({ title, message }: { title: string; message: string }) {
  return (
    <div>
      <h2 className="text-sm font-semibold text-[#1E2B26] mb-4">{title}</h2>
      <div className="h-64 flex items-center justify-center text-sm text-gray-400">
        {message}
      </div>
    </div>
  )
}
