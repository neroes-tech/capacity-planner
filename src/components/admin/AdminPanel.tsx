import { useState } from 'react'
import { useAdminCtx } from '../../contexts/AdminContext'
import PeopleAdmin from './PeopleAdmin'
import WorkspacesAdmin from './WorkspacesAdmin'
import WeeklyObjectivesAdmin from './WeeklyObjectivesAdmin'
import SettingsAdmin from './SettingsAdmin'

type Tab = 'pessoas' | 'workspaces' | 'objetivos' | 'definicoes'

const TABS: { id: Tab; label: string }[] = [
  { id: 'pessoas',    label: 'Pessoas' },
  { id: 'workspaces', label: 'Workspaces' },
  { id: 'objetivos',  label: 'Objetivos' },
  { id: 'definicoes', label: 'Definições' },
]

interface Props {
  week: string
  onClose: () => void
}

export default function AdminPanel({ week, onClose }: Props) {
  const [activeTab, setActiveTab] = useState<Tab>('pessoas')
  const { logout } = useAdminCtx()

  function handleClose() {
    logout()
    onClose()
  }

  return (
    <div className="fixed inset-0 z-50 flex" role="dialog" aria-modal="true" aria-label="Painel de administração">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/40" onClick={handleClose} aria-hidden="true" />

      {/* Drawer */}
      <div className="relative ml-auto w-full max-w-xl bg-white shadow-2xl flex flex-col h-full">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 shrink-0">
          <div>
            <h2 className="text-sm font-bold text-[#1E2B26]">Administração</h2>
            <p className="text-xs text-gray-400">Neroes · Capacity Planner</p>
          </div>
          <button
            onClick={handleClose}
            aria-label="Fechar painel de administração"
            className="text-gray-300 hover:text-gray-600 focus-visible:outline-2 focus-visible:outline-[#0E6B5C] p-1 rounded-lg transition-colors"
          >
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
              <path d="M12 4L4 12M4 4l8 8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
            </svg>
          </button>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-gray-100 px-4 shrink-0 overflow-x-auto">
          {TABS.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`px-4 py-3 text-sm font-medium border-b-2 whitespace-nowrap transition-colors focus-visible:outline-2 focus-visible:outline-[#0E6B5C] ${
                activeTab === tab.id
                  ? 'border-[#0E6B5C] text-[#0E6B5C]'
                  : 'border-transparent text-gray-400 hover:text-gray-700'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Conteúdo */}
        <div className="flex-1 overflow-y-auto p-6">
          {activeTab === 'pessoas'    && <PeopleAdmin />}
          {activeTab === 'workspaces' && <WorkspacesAdmin />}
          {activeTab === 'objetivos'  && <WeeklyObjectivesAdmin currentWeek={week} />}
          {activeTab === 'definicoes' && <SettingsAdmin />}
        </div>
      </div>
    </div>
  )
}
