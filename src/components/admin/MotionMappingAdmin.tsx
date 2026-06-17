import { useMotionMappings, useWorkspaces, useUpdateMotionMapping, useSyncMotion } from '../../hooks/useCapacityData'
import type { SyncResult } from '../../types'
import { useState } from 'react'

export default function MotionMappingAdmin() {
  const { data: mappings, isLoading: loadingM } = useMotionMappings()
  const { data: workspaces } = useWorkspaces()
  const updateMapping = useUpdateMotionMapping()
  const sync = useSyncMotion()

  const [lastResult, setLastResult] = useState<SyncResult | null>(null)
  const [syncError, setSyncError]   = useState<string | null>(null)

  async function handleSync() {
    setSyncError(null)
    setLastResult(null)
    try {
      const result = await sync.mutateAsync()
      setLastResult(result)
    } catch (e) {
      setSyncError(e instanceof Error ? e.message : 'Erro na sincronização.')
    }
  }

  if (loadingM) return <p className="text-sm text-gray-400 animate-pulse">A carregar…</p>

  const hasMappings = mappings && mappings.length > 0

  return (
    <div className="space-y-5">
      <div>
        <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-1">
          Mapeamento Motion → Planner
        </h3>
        <p className="text-xs text-gray-500">
          Associa cada workspace do Motion ao workspace correto do Capacity Planner.
          Os workspaces do Motion aparecem automaticamente após a primeira sincronização.
        </p>
      </div>

      {/* Botão de sincronização */}
      <div className="bg-gray-50 rounded-xl p-4 space-y-3">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-medium text-[#1E2B26]">Sincronizar com Motion</p>
            <p className="text-xs text-gray-400 mt-0.5">
              Importa tarefas concluídas e atualiza a lista de workspaces.
            </p>
          </div>
          <button
            onClick={handleSync}
            disabled={sync.isPending}
            className="px-4 py-2 text-xs font-medium text-white bg-[#0E6B5C] rounded-lg hover:bg-[#0a5549] disabled:opacity-50 focus-visible:outline-2 focus-visible:outline-[#0E6B5C] shrink-0"
          >
            {sync.isPending ? '⟳ A sincronizar…' : '⟳ Sincronizar agora'}
          </button>
        </div>

        {/* Resultado da sincronização */}
        {lastResult && (
          <div className={`rounded-lg p-3 text-xs space-y-1 ${lastResult.success ? 'bg-green-50 text-green-800' : 'bg-red-50 text-red-800'}`}>
            <p className="font-semibold">
              {lastResult.success ? '✓ Sincronização concluída' : '✕ Sincronização com erros'}
            </p>
            <p>
              <span className="tabular-nums font-medium">{lastResult.imported}</span> registos importados,{' '}
              <span className="tabular-nums font-medium">{lastResult.updated}</span> atualizados
            </p>
            {lastResult.unmappedWorkspaces.length > 0 && (
              <p className="text-amber-700">
                Workspaces sem mapeamento: {lastResult.unmappedWorkspaces.join(', ')}
              </p>
            )}
            {lastResult.unknownAssignees.length > 0 && (
              <p className="text-amber-700">
                Assignees desconhecidos (sem email na tabela Pessoas):{' '}
                {lastResult.unknownAssignees.join(', ')}
              </p>
            )}
            {lastResult.errors.length > 0 && (
              <details>
                <summary className="cursor-pointer text-red-700">
                  {lastResult.errors.length} erro(s)
                </summary>
                <ul className="mt-1 space-y-0.5 pl-3">
                  {lastResult.errors.map((e, i) => <li key={i}>• {e}</li>)}
                </ul>
              </details>
            )}
          </div>
        )}
        {syncError && (
          <p role="alert" className="text-xs text-red-600">{syncError}</p>
        )}
      </div>

      {/* Mapeamentos */}
      {!hasMappings ? (
        <div className="text-center py-8 text-sm text-gray-400">
          <p>Nenhum workspace Motion encontrado.</p>
          <p className="text-xs mt-1">Clica em "Sincronizar agora" para descobrir os workspaces do Motion.</p>
        </div>
      ) : (
        <ul className="space-y-2">
          {mappings.map((m) => (
            <li key={m.id} className="bg-gray-50 rounded-xl px-4 py-3">
              <div className="flex items-center gap-3">
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-[#1E2B26] truncate">
                    {m.motion_workspace_name}
                  </p>
                  <p className="text-xs text-gray-400 font-mono">{m.motion_workspace_id}</p>
                </div>
                <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true"
                  className="text-gray-300 shrink-0">
                  <path d="M3 8h10M9 4l4 4-4 4" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round"/>
                </svg>
                <div className="shrink-0 w-40">
                  <label htmlFor={`map-${m.id}`} className="sr-only">
                    Mapear {m.motion_workspace_name} para workspace do planner
                  </label>
                  <select
                    id={`map-${m.id}`}
                    value={m.planner_workspace_id ?? ''}
                    onChange={(e) =>
                      updateMapping.mutate({
                        id: m.id,
                        planner_workspace_id: e.target.value || null,
                      })
                    }
                    className="w-full rounded-lg border border-gray-200 px-2 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-[#0E6B5C]"
                  >
                    <option value="">— sem mapeamento —</option>
                    {(workspaces ?? []).map((ws) => (
                      <option key={ws.id} value={ws.id}>
                        {ws.short_name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}

      <div className="bg-amber-50 rounded-xl px-4 py-3 text-xs text-amber-800 space-y-1">
        <p className="font-semibold">Para que a sincronização funcione:</p>
        <ul className="list-disc list-inside space-y-0.5 pl-1">
          <li>Cada pessoa precisa de ter o seu email preenchido (tab Pessoas)</li>
          <li>O email deve coincidir com o email usado no Motion</li>
          <li>Cada workspace Motion deve estar mapeado acima</li>
        </ul>
      </div>
    </div>
  )
}
