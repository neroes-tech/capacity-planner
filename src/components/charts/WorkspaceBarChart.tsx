import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  Legend, ResponsiveContainer, LabelList, Cell,
} from 'recharts'
import { useWeekEntries, useWorkspaces, useWeeklyObjectives } from '../../hooks/useCapacityData'
import { round1 } from '../../lib/utils'

interface Props {
  week: string
}

export default function WorkspaceBarChart({ week }: Props) {
  const { data: entries,    isLoading: loadingE } = useWeekEntries(week)
  const { data: workspaces, isLoading: loadingW } = useWorkspaces()
  const { data: weeklyObjs, isLoading: loadingO } = useWeeklyObjectives(week)

  if (loadingE || loadingW || loadingO) {
    return <ChartSkeleton />
  }

  const realEntries = (entries ?? []).filter((e) => e.tipo === 'Real')
  const totalReal   = realEntries.reduce((s, e) => s + e.hours, 0)
  const hasCustom   = weeklyObjs && weeklyObjs.length > 0

  const chartData = (workspaces ?? []).map((ws) => {
    const wsHours  = realEntries
      .filter((e) => e.workspace_id === ws.id)
      .reduce((s, e) => s + e.hours, 0)
    const realPct  = totalReal > 0 ? round1((wsHours / totalReal) * 100) : 0
    const weeklyObj = weeklyObjs?.find((o) => o.workspace_id === ws.id)
    const objetivo  = weeklyObj ? weeklyObj.target_pct : ws.team_objective_pct
    return {
      name:     ws.short_name,
      fullName: ws.name,
      Real:     realPct,
      Objetivo: objetivo,
      color:    ws.color,
    }
  })

  if (totalReal === 0) {
    return (
      <EmptyState message="Ainda não há registos Reais nesta semana." />
    )
  }

  return (
    <div>
      <div className="flex items-baseline justify-between mb-4">
        <h2 className="text-sm font-semibold text-[#1E2B26]">
          Real vs Objetivo por Workspace
        </h2>
        {hasCustom && (
          <span className="text-xs text-[#0E6B5C] bg-[#0E6B5C]/10 px-2 py-0.5 rounded-full">
            objetivos personalizados
          </span>
        )}
      </div>

      <ResponsiveContainer width="100%" height={260}>
        <BarChart data={chartData} margin={{ top: 16, right: 8, left: -16, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
          <XAxis dataKey="name" tick={{ fontSize: 11, fill: '#6b7280' }} interval={0} />
          <YAxis unit="%" domain={[0, 'auto']} tick={{ fontSize: 11, fill: '#6b7280' }} />
          <Tooltip
            formatter={(value: number, name: string) => [`${value}%`, name]}
            labelFormatter={(label, payload) => payload?.[0]?.payload?.fullName ?? label}
            contentStyle={{ fontSize: 12, borderRadius: 8, border: '1px solid #e5e7eb' }}
          />
          <Legend iconSize={10} wrapperStyle={{ fontSize: 12 }} />
          <Bar dataKey="Real" name="% Real">
            {chartData.map((d, i) => <Cell key={i} fill={d.color} />)}
            <LabelList dataKey="Real" position="top"
              formatter={(v: number) => `${v}%`}
              style={{ fontSize: 10, fill: '#6b7280' }} />
          </Bar>
          <Bar dataKey="Objetivo" name="% Objetivo" fill="#d1d5db">
            <LabelList dataKey="Objetivo" position="top"
              formatter={(v: number) => `${v}%`}
              style={{ fontSize: 10, fill: '#9ca3af' }} />
          </Bar>
        </BarChart>
      </ResponsiveContainer>

      <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1">
        {(workspaces ?? []).map((ws) => {
          const weeklyObj = weeklyObjs?.find((o) => o.workspace_id === ws.id)
          const objetivo  = weeklyObj ? weeklyObj.target_pct : ws.team_objective_pct
          return (
            <div key={ws.id} className="flex items-center gap-1.5 text-xs text-gray-500">
              <span className="inline-block w-2 h-2 rounded-sm shrink-0"
                style={{ backgroundColor: ws.color }} aria-hidden="true" />
              {ws.short_name} — <span className="tabular-nums">{objetivo}%</span>
              {weeklyObj && <span className="text-[#0E6B5C]">*</span>}
            </div>
          )
        })}
      </div>
      {hasCustom && (
        <p className="mt-1 text-xs text-gray-400">* objetivo personalizado desta semana</p>
      )}
    </div>
  )
}

function ChartSkeleton() {
  return (
    <div>
      <h2 className="text-sm font-semibold text-[#1E2B26] mb-4">Real vs Objetivo por Workspace</h2>
      <div className="h-64 bg-gray-100 rounded-lg animate-pulse" />
    </div>
  )
}

function EmptyState({ message }: { message: string }) {
  return (
    <div>
      <h2 className="text-sm font-semibold text-[#1E2B26] mb-4">Real vs Objetivo por Workspace</h2>
      <div className="h-64 flex items-center justify-center text-sm text-gray-400">{message}</div>
    </div>
  )
}
