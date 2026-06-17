import { useState } from 'react'
import { AdminProvider, useAdminCtx } from './contexts/AdminContext'
import WeekSelector from './components/WeekSelector'
import KPICards from './components/KPICards'
import EntryForm from './components/EntryForm'
import EntryList from './components/EntryList'
import WorkspaceBarChart from './components/charts/WorkspaceBarChart'
import PersonStackedChart from './components/charts/PersonStackedChart'
import EvolutionLineChart from './components/charts/EvolutionLineChart'
import AdminLoginModal from './components/admin/AdminLoginModal'
import AdminPanel from './components/admin/AdminPanel'
import { toWednesday, toDateString } from './lib/utils'

function AppContent() {
  const [week, setWeek] = useState<string>(() =>
    toDateString(toWednesday(new Date())),
  )
  const [showLogin, setShowLogin] = useState(false)
  const [adminOpen, setAdminOpen] = useState(false)
  const { isAdmin } = useAdminCtx()

  function handleAdminClick() {
    if (isAdmin) {
      setAdminOpen(true)
    } else {
      setShowLogin(true)
    }
  }

  return (
    <div className="min-h-screen bg-[#EDF0EB]">
      {/* Header */}
      <header className="bg-white border-b border-gray-100 sticky top-0 z-20 shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-3 flex items-center justify-between gap-4 flex-wrap">
          <div>
            <h1 className="text-base font-bold text-[#1E2B26] leading-tight">Neroes</h1>
            <p className="text-xs text-gray-400">Capacity Planner</p>
          </div>
          <div className="flex items-center gap-3">
            <WeekSelector week={week} onChange={setWeek} />
            <button
              onClick={handleAdminClick}
              aria-label="Administração"
              title="Administração"
              className={`w-8 h-8 flex items-center justify-center rounded-lg border transition-colors focus-visible:outline-2 focus-visible:outline-[#0E6B5C] ${
                isAdmin
                  ? 'border-[#0E6B5C] text-[#0E6B5C] bg-[#0E6B5C]/5'
                  : 'border-gray-200 text-gray-400 hover:text-[#1E2B26] hover:border-gray-300'
              }`}
            >
              <svg width="14" height="14" viewBox="0 0 16 16" fill="none" aria-hidden="true">
                <path d="M8 10a2 2 0 1 0 0-4 2 2 0 0 0 0 4Z" stroke="currentColor" strokeWidth="1.4"/>
                <path d="M13.3 6.7A5.8 5.8 0 0 0 13 5.7l1.2-1-.9-1.6-1.5.5a5.7 5.7 0 0 0-1.7-1L9.8 1h-1.6l-.3 1.6a5.7 5.7 0 0 0-1.7 1L4.7 3.1 3.8 4.7 5 5.7c-.1.3-.2.7-.2 1s.1.7.2 1L3.8 8.7l.9 1.6 1.5-.5a5.7 5.7 0 0 0 1.7 1l.3 1.6h1.6l.3-1.6a5.7 5.7 0 0 0 1.7-1l1.5.5.9-1.6-1.2-1c.1-.3.2-.7.2-1 0-.4-.1-.7-.2-1Z" stroke="currentColor" strokeWidth="1.4"/>
              </svg>
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 py-6 space-y-6">
        <section aria-label="Indicadores da semana">
          <KPICards week={week} />
        </section>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <section aria-label="Registar horas" className="bg-white rounded-xl p-6 shadow-sm">
            <h2 className="text-sm font-semibold text-[#1E2B26] mb-4">Registar horas</h2>
            <EntryForm week={week} />
            <EntryList week={week} />
          </section>

          <section aria-label="Real vs Objetivo por workspace" className="bg-white rounded-xl p-6 shadow-sm">
            <WorkspaceBarChart week={week} />
          </section>
        </div>

        <section aria-label="Horas por pessoa e workspace" className="bg-white rounded-xl p-6 shadow-sm">
          <PersonStackedChart week={week} />
        </section>

        <section aria-label="Evolução de horas reais" className="bg-white rounded-xl p-6 shadow-sm">
          <EvolutionLineChart />
        </section>
      </main>

      <footer className="max-w-7xl mx-auto px-4 sm:px-6 py-4 text-xs text-gray-400 text-center">
        Neroes · Capacity Planner
      </footer>

      {/* Modais */}
      {showLogin && (
        <AdminLoginModal
          onSuccess={() => { setShowLogin(false); setAdminOpen(true) }}
          onCancel={() => setShowLogin(false)}
        />
      )}
      {adminOpen && isAdmin && (
        <AdminPanel week={week} onClose={() => setAdminOpen(false)} />
      )}
    </div>
  )
}

export default function App() {
  return (
    <AdminProvider>
      <AppContent />
    </AdminProvider>
  )
}
