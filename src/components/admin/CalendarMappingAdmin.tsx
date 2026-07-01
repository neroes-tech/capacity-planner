import { useState } from 'react'
import {
  useWorkspaces,
  useRecurringMappings, useWorkspaceColors, useEventOverrides,
  useUpsertRecurringMapping, useUpsertWorkspaceColor, useUpsertEventOverride,
  useSyncGcal,
} from '../../hooks/useCapacityData'
import type { SyncGcalResult } from '../../types'

// Mapa estável das 11 cores de evento do Google Calendar
const GCAL_COLORS: Record<string, { name: string; hex: string }> = {
  '1':  { name: 'Lavender',  hex: '#7986CB' },
  '2':  { name: 'Sage',      hex: '#33B679' },
  '3':  { name: 'Grape',     hex: '#8E24AA' },
  '4':  { name: 'Flamingo',  hex: '#E67C73' },
  '5':  { name: 'Banana',    hex: '#F6BF26' },
  '6':  { name: 'Tangerine', hex: '#F4511E' },
  '7':  { name: 'Peacock',   hex: '#039BE5' },
  '8':  { name: 'Graphite',  hex: '#616161' },
  '9':  { name: 'Blueberry', hex: '#3F51B5' },
  '10': { name: 'Basil',     hex: '#0B8043' },
  '11': { name: 'Tomato',    hex: '#D50000' },
}

type Section = 'recorrentes' | 'cores' | 'oneoffs'

export default function CalendarMappingAdmin() {
  const { data: workspaces }        = useWorkspaces()
  const { data: recurringMappings, isLoading: loadingR } = useRecurringMappings()
  const { data: workspaceColors }   = useWorkspaceColors()
  const { data: eventOverrides }    = useEventOverrides()

  const upsertRecurring   = useUpsertRecurringMapping()
  const upsertColor       = useUpsertWorkspaceColor()
  const upsertOverride    = useUpsertEventOverride()
  const syncGcal          = useSyncGcal()

  const [lastResult, setLastResult]   = useState<SyncGcalResult | null>(null)
  const [syncError,  setSyncError]    = useState<string | null>(null)
  const [activeSection, setActiveSection] = useState<Section>('recorrentes')

  async function handleSync(dryRun: boolean) {
    setSyncError(null)
    setLastResult(null)
    try {
      const result = await syncGcal.mutateAsync({ dryRun })
      setLastResult(result)
    } catch (e) {
      setSyncError(e instanceof Error ? e.message : 'Erro na sincronização.')
    }
  }

  const ws = workspaces ?? []

  // Lookup colorId → planner_workspace_id
  const colorToWs = new Map((workspaceColors ?? []).map(c => [c.color_id, c.planner_workspace_id ?? '']))
  // Lookup event_id → planner_workspace_id
  const overrideToWs = new Map((eventOverrides ?? []).map(o => [o.event_id, o.planner_workspace_id ?? '']))

  const sectionTabCls = (s: Section) =>
    `px-3 py-2.5 text-xs font-medium border-b-2 whitespace-nowrap transition-colors ${
      activeSection === s
        ? 'border-[#0E6B5C] text-[#0E6B5C]'
        : 'border-transparent text-gray-400 hover:text-gray-700'
    }`

  return (
    <div className="space-y-5">

      {/* Header + sync buttons */}
      <div>
        <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-1">
          Integração Google Calendar
        </h3>
        <p className="text-xs text-gray-500">
          Importa reuniões e eventos do Google Calendar de todos os membros da equipa.
          Cada evento é atribuído a um workspace pelo seu evento recorrente, cor, ou override manual.
        </p>
      </div>

      {/* Sync panel */}
      <div className="bg-gray-50 rounded-xl p-4 space-y-3">
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <div>
            <p className="text-sm font-medium text-[#1E2B26]">Sincronizar eventos</p>
            <p className="text-xs text-gray-400 mt-0.5">
              Corre primeiro o Dry-run para ver o que seria importado sem escrever na BD.
            </p>
          </div>
          <div className="flex gap-2 shrink-0">
            <button
              onClick={() => handleSync(true)}
              disabled={syncGcal.isPending}
              className="px-3 py-2 text-xs font-medium text-[#0E6B5C] border border-[#0E6B5C] rounded-lg hover:bg-[#0E6B5C]/5 disabled:opacity-50 transition-colors"
            >
              {syncGcal.isPending ? '…' : 'Simular (dry-run)'}
            </button>
            <button
              onClick={() => handleSync(false)}
              disabled={syncGcal.isPending}
              className="px-3 py-2 text-xs font-medium text-white bg-[#0E6B5C] rounded-lg hover:bg-[#0a5549] disabled:opacity-50 transition-colors"
            >
              {syncGcal.isPending ? '⟳ A sincronizar…' : '⟳ Sincronizar agora'}
            </button>
          </div>
        </div>

        {/* Resultado */}
        {lastResult && (
          <div className={`rounded-lg p-3 text-xs space-y-1.5 ${lastResult.success ? 'bg-green-50 text-green-800' : 'bg-red-50 text-red-800'}`}>
            <p className="font-semibold">
              {lastResult.dryRun ? '📋 Simulação concluída' : lastResult.success ? '✓ Sincronização concluída' : '✕ Sincronização com erros'}
              {lastResult.dryRun && <span className="ml-1 font-normal text-green-700"> — nada foi escrito</span>}
            </p>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-x-4 gap-y-0.5 tabular-nums">
              <span><strong>{lastResult.imported}</strong> importados</span>
              <span><strong>{lastResult.updated}</strong> atualizados</span>
              <span><strong>{lastResult.skippedMotionBlocks}</strong> blocos Motion ignorados</span>
              <span><strong>{lastResult.skippedPersonal}</strong> pessoais ignorados</span>
              <span><strong>{lastResult.skippedCancelled}</strong> cancelados</span>
              <span><strong>{lastResult.skippedAllDay}</strong> all-day</span>
              <span><strong>{lastResult.skippedTransparent}</strong> "Free"</span>
              <span><strong>{lastResult.externalAttendeesIgnored}</strong> externos ignorados</span>
            </div>
            {lastResult.unmappedRecurring.length > 0 && (
              <p className="text-amber-700">
                {lastResult.unmappedRecurring.length} recorrentes sem mapeamento — ver tab abaixo.
              </p>
            )}
            {lastResult.unclassifiedOneOffs.length > 0 && (
              <p className="text-amber-700">
                {lastResult.unclassifiedOneOffs.length} eventos únicos por classificar — ver tab abaixo.
              </p>
            )}
            {lastResult.unknownAttendees.length > 0 && (
              <p className="text-amber-700">
                Participantes sem match: {lastResult.unknownAttendees.join(', ')}
              </p>
            )}
            {lastResult.errors.length > 0 && (
              <details>
                <summary className="cursor-pointer text-red-700">{lastResult.errors.length} erro(s)</summary>
                <ul className="mt-1 pl-3 space-y-0.5">
                  {lastResult.errors.map((e, i) => <li key={i}>• {e}</li>)}
                </ul>
              </details>
            )}
          </div>
        )}
        {syncError && <p role="alert" className="text-xs text-red-600">{syncError}</p>}
      </div>

      {/* Secções internas */}
      <div className="flex border-b border-gray-100 overflow-x-auto -mx-1 px-1">
        <button className={sectionTabCls('recorrentes')} onClick={() => setActiveSection('recorrentes')}>
          Recorrentes {(recurringMappings ?? []).length > 0 && `(${recurringMappings!.length})`}
        </button>
        <button className={sectionTabCls('cores')} onClick={() => setActiveSection('cores')}>
          Cores (one-offs)
        </button>
        <button className={sectionTabCls('oneoffs')} onClick={() => setActiveSection('oneoffs')}>
          Por classificar {lastResult?.unclassifiedOneOffs.length ? `(${lastResult.unclassifiedOneOffs.length})` : ''}
        </button>
      </div>

      {/* ── Tab: Recorrentes ── */}
      {activeSection === 'recorrentes' && (
        <div className="space-y-3">
          <p className="text-xs text-gray-500">
            Associa cada série de eventos recorrentes a um workspace. "Pessoal" ignora a série completamente.
            Sincroniza para descobrir novas séries.
          </p>

          {loadingR && <p className="text-sm text-gray-400 animate-pulse">A carregar…</p>}
          {!loadingR && (recurringMappings ?? []).length === 0 && (
            <p className="text-sm text-gray-400 text-center py-6">
              Nenhuma série recorrente descoberta ainda.<br/>
              <span className="text-xs">Clica "Sincronizar agora" para descobrir.</span>
            </p>
          )}

          <ul className="space-y-2">
            {(recurringMappings ?? []).map((m) => (
              <li key={m.id} className="bg-gray-50 rounded-xl px-4 py-3">
                <div className="flex items-start gap-3">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-[#1E2B26] truncate">
                      {m.summary ?? '(sem título)'}
                    </p>
                    <p className="text-xs text-gray-400 font-mono truncate">{m.recurring_event_id}</p>
                  </div>
                  <div className="shrink-0 w-44">
                    <label className="sr-only">Workspace para {m.summary}</label>
                    <select
                      value={m.is_personal ? 'PERSONAL' : (m.planner_workspace_id ?? '')}
                      onChange={(e) => {
                        const val = e.target.value
                        upsertRecurring.mutate({
                          recurring_event_id:   m.recurring_event_id,
                          planner_workspace_id: val === 'PERSONAL' || val === '' ? null : val,
                          is_personal:          val === 'PERSONAL',
                        })
                      }}
                      className="w-full rounded-lg border border-gray-200 px-2 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-[#0E6B5C]"
                    >
                      <option value="">— não importar —</option>
                      <option value="PERSONAL">🙈 Pessoal / Ignorar</option>
                      {ws.map((w) => (
                        <option key={w.id} value={w.id}>{w.short_name}</option>
                      ))}
                    </select>
                  </div>
                </div>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* ── Tab: Cores ── */}
      {activeSection === 'cores' && (
        <div className="space-y-3">
          <p className="text-xs text-gray-500">
            Para eventos únicos (não recorrentes) sem override manual, a cor do organizador determina o workspace.
            O sinal de cor <strong>só funciona na cópia do organizador</strong>; participantes veem a cor padrão do calendário.
          </p>
          <ul className="space-y-2">
            {Object.entries(GCAL_COLORS).map(([colorId, { name, hex }]) => (
              <li key={colorId} className="bg-gray-50 rounded-xl px-4 py-3">
                <div className="flex items-center gap-3">
                  <span
                    className="shrink-0 w-4 h-4 rounded-full border border-black/10"
                    style={{ backgroundColor: hex }}
                    aria-hidden="true"
                  />
                  <div className="flex-1">
                    <p className="text-sm font-medium text-[#1E2B26]">{name}</p>
                    <p className="text-xs text-gray-400">colorId {colorId} · {hex}</p>
                  </div>
                  <div className="shrink-0 w-44">
                    <label className="sr-only">Workspace para cor {name}</label>
                    <select
                      value={colorToWs.get(colorId) ?? ''}
                      onChange={(e) =>
                        upsertColor.mutate({
                          color_id:             colorId,
                          planner_workspace_id: e.target.value || null,
                        })
                      }
                      className="w-full rounded-lg border border-gray-200 px-2 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-[#0E6B5C]"
                    >
                      <option value="">— sem mapeamento —</option>
                      {ws.map((w) => (
                        <option key={w.id} value={w.id}>{w.short_name}</option>
                      ))}
                    </select>
                  </div>
                </div>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* ── Tab: Por classificar (one-offs da última sync) ── */}
      {activeSection === 'oneoffs' && (
        <div className="space-y-3">
          <p className="text-xs text-gray-500">
            Eventos únicos (não recorrentes) da última sincronização sem cor mapeada.
            Associa manualmente cada um a um workspace — fica guardado e na próxima sync é importado.
            {!lastResult && ' Sincroniza para ver a lista.'}
          </p>

          {(!lastResult || lastResult.unclassifiedOneOffs.length === 0) && (
            <p className="text-sm text-gray-400 text-center py-6">
              {lastResult ? 'Nenhum evento por classificar.' : 'Corre uma sincronização (ou simulação) para ver a lista.'}
            </p>
          )}

          {lastResult && lastResult.unclassifiedOneOffs.length > 0 && (
            <ul className="space-y-2">
              {lastResult.unclassifiedOneOffs.map((ev) => {
                const colorInfo = ev.colorId ? GCAL_COLORS[ev.colorId] : null
                return (
                  <li key={ev.event_id} className="bg-gray-50 rounded-xl px-4 py-3">
                    <div className="flex items-start gap-3">
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-[#1E2B26] truncate">
                          {ev.summary ?? '(sem título)'}
                        </p>
                        <p className="text-xs text-gray-400">
                          {new Date(ev.start).toLocaleString('pt-PT', { dateStyle: 'short', timeStyle: 'short' })}
                          {colorInfo && (
                            <span className="ml-2 inline-flex items-center gap-1">
                              <span className="inline-block w-2.5 h-2.5 rounded-full border border-black/10"
                                style={{ backgroundColor: colorInfo.hex }} />
                              {colorInfo.name}
                            </span>
                          )}
                        </p>
                      </div>
                      <div className="shrink-0 w-44">
                        <label className="sr-only">Workspace para {ev.summary}</label>
                        <select
                          value={overrideToWs.get(ev.event_id) ?? ''}
                          onChange={(e) =>
                            upsertOverride.mutate({
                              event_id:             ev.event_id,
                              planner_workspace_id: e.target.value || null,
                            })
                          }
                          className="w-full rounded-lg border border-gray-200 px-2 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-[#0E6B5C]"
                        >
                          <option value="">— sem mapeamento —</option>
                          {ws.map((w) => (
                            <option key={w.id} value={w.id}>{w.short_name}</option>
                          ))}
                        </select>
                      </div>
                    </div>
                  </li>
                )
              })}
            </ul>
          )}
        </div>
      )}

      {/* Box de pré-requisitos */}
      <div className="bg-amber-50 rounded-xl px-4 py-3 text-xs text-amber-800 space-y-1">
        <p className="font-semibold">Para que a sincronização funcione:</p>
        <ul className="list-disc list-inside space-y-0.5 pl-1">
          <li>Secret <code className="bg-amber-100 px-0.5 rounded">GOOGLE_SERVICE_ACCOUNT_JSON</code> configurado no Supabase</li>
          <li>Service Account com Domain-Wide Delegation (scope <code className="bg-amber-100 px-0.5 rounded">calendar.readonly</code>)</li>
          <li>Cada pessoa com email preenchido em Pessoas (deve coincidir com o email Google)</li>
          <li>Migração <code className="bg-amber-100 px-0.5 rounded">migration_gcal.sql</code> executada no Supabase SQL Editor</li>
        </ul>
      </div>
    </div>
  )
}
