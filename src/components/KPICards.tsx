import { useWeekEntries, usePeople, useSettings } from '../hooks/useCapacityData'
import { round1 } from '../lib/utils'

interface Props {
  week: string
}

interface KPICardProps {
  label: string
  value: string
  sub?: string
  alert?: boolean
}

function KPICard({ label, value, sub, alert }: KPICardProps) {
  return (
    <div
      className={`bg-white rounded-xl p-5 shadow-sm border-l-4 ${
        alert ? 'border-red-500' : 'border-[#0E6B5C]'
      }`}
    >
      <p className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-1">{label}</p>
      <p
        className={`text-2xl font-bold tabular-nums ${alert ? 'text-red-600' : 'text-[#1E2B26]'}`}
        aria-live="polite"
      >
        {value}
      </p>
      {sub && <p className="text-xs text-gray-400 mt-1">{sub}</p>}
    </div>
  )
}

export default function KPICards({ week }: Props) {
  const { data: entries, isLoading: loadingEntries } = useWeekEntries(week)
  const { data: people, isLoading: loadingPeople } = usePeople()
  const { data: settings, isLoading: loadingSettings } = useSettings()

  if (loadingEntries || loadingPeople || loadingSettings) {
    return (
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[...Array(4)].map((_, i) => (
          <div key={i} className="bg-white rounded-xl p-5 shadow-sm animate-pulse h-24" />
        ))}
      </div>
    )
  }

  const realHours = (entries ?? [])
    .filter((e) => e.tipo === 'Real')
    .reduce((s, e) => s + e.hours, 0)

  const plannedHours = (entries ?? [])
    .filter((e) => e.tipo === 'Planeado')
    .reduce((s, e) => s + e.hours, 0)

  const totalWeeklyHours = (people ?? []).reduce((s, p) => s + p.weekly_hours, 0)
  const factor = settings?.efficiency_factor ?? 0.85
  const effectiveCapacity = totalWeeklyHours * factor

  const utilization = effectiveCapacity > 0 ? (realHours / effectiveCapacity) * 100 : 0
  const overloaded = utilization > 100

  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
      <KPICard
        label="Horas Reais"
        value={`${round1(realHours)} h`}
        sub="registadas esta semana"
      />
      <KPICard
        label="Horas Planeadas"
        value={`${round1(plannedHours)} h`}
        sub="plano da semana"
      />
      <KPICard
        label="Capacidade Efetiva"
        value={`${round1(effectiveCapacity)} h`}
        sub={`${totalWeeklyHours} h × ${factor}`}
      />
      <KPICard
        label="Utilização"
        value={`${round1(utilization)} %`}
        sub={overloaded ? 'acima da capacidade!' : 'dentro da capacidade'}
        alert={overloaded}
      />
    </div>
  )
}
