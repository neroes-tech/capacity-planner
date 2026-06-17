import { useState } from 'react'
import WeekSelector from './components/WeekSelector'
import KPICards from './components/KPICards'
import EntryForm from './components/EntryForm'
import EntryList from './components/EntryList'
import WorkspaceBarChart from './components/charts/WorkspaceBarChart'
import PersonStackedChart from './components/charts/PersonStackedChart'
import EvolutionLineChart from './components/charts/EvolutionLineChart'
import { toWednesday, toDateString } from './lib/utils'

export default function App() {
  const [week, setWeek] = useState<string>(() =>
    toDateString(toWednesday(new Date())),
  )

  return (
    <div className="min-h-screen bg-[#EDF0EB]">
      {/* Header */}
      <header className="bg-white border-b border-gray-100 sticky top-0 z-20 shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-3 flex items-center justify-between gap-4 flex-wrap">
          <div>
            <h1 className="text-base font-bold text-[#1E2B26] leading-tight">
              Neroes
            </h1>
            <p className="text-xs text-gray-400">Capacity Planner</p>
          </div>
          <WeekSelector week={week} onChange={setWeek} />
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 py-6 space-y-6">
        {/* KPIs */}
        <section aria-label="Indicadores da semana">
          <KPICards week={week} />
        </section>

        {/* Formulário + Gráfico de workspaces */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <section
            aria-label="Registar horas"
            className="bg-white rounded-xl p-6 shadow-sm"
          >
            <h2 className="text-sm font-semibold text-[#1E2B26] mb-4">
              Registar horas
            </h2>
            <EntryForm week={week} />
            <EntryList week={week} />
          </section>

          <section
            aria-label="Real vs Objetivo por workspace"
            className="bg-white rounded-xl p-6 shadow-sm"
          >
            <WorkspaceBarChart week={week} />
          </section>
        </div>

        {/* Barras empilhadas por pessoa */}
        <section
          aria-label="Horas por pessoa e workspace"
          className="bg-white rounded-xl p-6 shadow-sm"
        >
          <PersonStackedChart week={week} />
        </section>

        {/* Evolução temporal */}
        <section
          aria-label="Evolução de horas reais"
          className="bg-white rounded-xl p-6 shadow-sm"
        >
          <EvolutionLineChart />
        </section>
      </main>

      <footer className="max-w-7xl mx-auto px-4 sm:px-6 py-4 text-xs text-gray-400 text-center">
        Neroes · Capacity Planner
      </footer>
    </div>
  )
}
