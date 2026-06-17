import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, ReferenceLine,
} from 'recharts'
import { useAllRealEntries, usePeople, useSettings } from '../../hooks/useCapacityData'
import { formatWeekLabel, round1 } from '../../lib/utils'

export default function EvolutionLineChart() {
  const { data: rawEntries, isLoading: loadingE } = useAllRealEntries()
  const { data: people, isLoading: loadingP } = usePeople()
  const { data: settings, isLoading: loadingS } = useSettings()

  if (loadingE || loadingP || loadingS) {
    return (
      <div>
        <h2 className="text-sm font-semibold text-[#1E2B26] mb-4">Evolução de Horas Reais</h2>
        <div className="h-56 bg-gray-100 rounded-lg animate-pulse" />
      </div>
    )
  }

  const entries = rawEntries ?? []

  if (entries.length === 0) {
    return (
      <div>
        <h2 className="text-sm font-semibold text-[#1E2B26] mb-4">Evolução de Horas Reais</h2>
        <div className="h-56 flex items-center justify-center text-sm text-gray-400">
          Ainda não há histórico de horas reais.
        </div>
      </div>
    )
  }

  // Agrupar por semana
  const byWeek: Record<string, number> = {}
  entries.forEach((e) => {
    byWeek[e.week] = (byWeek[e.week] ?? 0) + e.hours
  })

  const chartData = Object.keys(byWeek)
    .sort()
    .map((week) => ({
      week,
      label: formatWeekLabel(week),
      horas: round1(byWeek[week]),
    }))

  const factor = settings?.efficiency_factor ?? 0.85
  const totalWeeklyHours = (people ?? []).reduce((s, p) => s + p.weekly_hours, 0)
  const effectiveCapacity = round1(totalWeeklyHours * factor)

  return (
    <div>
      <h2 className="text-sm font-semibold text-[#1E2B26] mb-4">Evolução de Horas Reais</h2>
      <ResponsiveContainer width="100%" height={240}>
        <LineChart data={chartData} margin={{ top: 16, right: 24, left: -16, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
          <XAxis
            dataKey="label"
            tick={{ fontSize: 10, fill: '#6b7280' }}
            interval={chartData.length > 8 ? Math.floor(chartData.length / 6) : 0}
          />
          <YAxis
            unit=" h"
            tick={{ fontSize: 11, fill: '#6b7280' }}
            domain={[0, 'auto']}
          />
          <Tooltip
            formatter={(value: number) => [`${value} h`, 'Horas Reais']}
            labelFormatter={(label) => `Semana: ${label}`}
            contentStyle={{ fontSize: 12, borderRadius: 8, border: '1px solid #e5e7eb' }}
          />
          <ReferenceLine
            y={effectiveCapacity}
            stroke="#0E6B5C"
            strokeDasharray="6 3"
            strokeWidth={1.5}
            label={{
              value: `Cap. efetiva ${effectiveCapacity} h`,
              position: 'insideTopRight',
              fontSize: 10,
              fill: '#0E6B5C',
            }}
          />
          <Line
            dataKey="horas"
            name="Horas Reais"
            type="monotone"
            stroke="#C94A57"
            strokeWidth={2}
            dot={{ fill: '#C94A57', r: 3 }}
            activeDot={{ r: 5 }}
          />
        </LineChart>
      </ResponsiveContainer>
      <p className="mt-2 text-xs text-gray-400 text-right">
        Capacidade efetiva da equipa: <span className="tabular-nums font-medium">{effectiveCapacity} h</span>
      </p>
    </div>
  )
}
