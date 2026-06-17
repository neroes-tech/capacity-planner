import { useState } from 'react'
import { useWeekEntries, useDeleteEntry, useGenerateNextWeekPlan } from '../hooks/useCapacityData'
import { addDays, parseDateString, toDateString, formatWeekLabel } from '../lib/utils'
import type { EntryWithRelations } from '../types'

interface Props {
  week: string
}

export default function EntryList({ week }: Props) {
  const { data: entries, isLoading, isError } = useWeekEntries(week)
  const deleteEntry  = useDeleteEntry()
  const generatePlan = useGenerateNextWeekPlan()
  const [genError, setGenError]     = useState<string | null>(null)
  const [genSuccess, setGenSuccess] = useState<string | null>(null)

  const nextWeekLabel = formatWeekLabel(toDateString(addDays(parseDateString(week), 7)))

  async function handleGenerate() {
    setGenError(null)
    setGenSuccess(null)
    try {
      await generatePlan.mutateAsync(week)
      setGenSuccess(`Plano gerado para a semana de ${nextWeekLabel}.`)
    } catch (e) {
      setGenError(e instanceof Error ? e.message : 'Erro ao gerar plano.')
    }
  }

  if (isLoading) return <p className="text-sm text-gray-400 mt-4 animate-pulse">A carregar registos…</p>
  if (isError)   return <p role="alert" className="text-sm text-red-600 mt-4">Erro ao carregar registos.</p>

  const real    = (entries ?? []).filter((e) => e.tipo === 'Real')
  const planned = (entries ?? []).filter((e) => e.tipo === 'Planeado')

  return (
    <div className="mt-4 space-y-4">
      {/* Gerar plano */}
      <div className="flex flex-col gap-1">
        <button
          onClick={handleGenerate}
          disabled={generatePlan.isPending}
          className="w-full py-2 border-2 border-dashed border-[#0E6B5C] text-[#0E6B5C] rounded-lg text-sm font-medium hover:bg-[#0E6B5C]/5 focus-visible:outline-2 focus-visible:outline-[#0E6B5C] disabled:opacity-50 transition-colors"
        >
          {generatePlan.isPending
            ? 'A gerar…'
            : `Gerar plano da próxima semana (${nextWeekLabel})`}
        </button>
        {genSuccess && <p role="status" className="text-xs text-green-700">{genSuccess}</p>}
        {genError   && <p role="alert"  className="text-xs text-red-600">{genError}</p>}
      </div>

      <EntryGroup title="Reais"    entries={real}    week={week} onDelete={deleteEntry.mutateAsync} />
      <EntryGroup title="Planeados" entries={planned} week={week} onDelete={deleteEntry.mutateAsync} />
    </div>
  )
}

function MotionBadge() {
  return (
    <span
      title="Importado do Motion"
      className="inline-flex items-center text-[10px] font-semibold px-1.5 py-0.5 rounded bg-[#6A4FB3]/10 text-[#6A4FB3] shrink-0"
    >
      Motion
    </span>
  )
}

function EntryGroup({
  title, entries, week, onDelete,
}: {
  title: string
  entries: EntryWithRelations[]
  week: string
  onDelete: (args: { id: string; week: string }) => Promise<unknown>
}) {
  const [confirmId, setConfirmId] = useState<string | null>(null)

  if (entries.length === 0) return null

  return (
    <div>
      <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2">{title}</h3>
      <ul className="space-y-1" aria-label={`Registos ${title}`}>
        {entries.map((entry) => {
          const isMotion = entry.source === 'motion'
          return (
            <li key={entry.id}
              className="flex items-center justify-between gap-2 bg-gray-50 rounded-lg px-3 py-2 text-sm">
              <span className="w-2 h-2 rounded-full shrink-0"
                style={{ backgroundColor: entry.workspace.color }} aria-hidden="true" />
              <span className="font-medium text-[#1E2B26] shrink-0">{entry.person.name}</span>
              <span className="text-gray-500 truncate flex-1">{entry.workspace.short_name}</span>
              {isMotion && <MotionBadge />}
              <span className="tabular-nums font-semibold text-[#1E2B26] shrink-0">
                {entry.hours} h
              </span>

              {/* Botão apagar — registos Motion não se apagam manualmente */}
              {isMotion ? (
                <span className="ml-1 w-4 h-4 shrink-0" aria-hidden="true" />
              ) : confirmId === entry.id ? (
                <div className="flex gap-1 shrink-0">
                  <button
                    onClick={() => { onDelete({ id: entry.id, week }); setConfirmId(null) }}
                    className="text-[10px] font-medium text-red-600 hover:underline focus-visible:outline-2 focus-visible:outline-red-500"
                  >
                    Confirmar
                  </button>
                  <button
                    onClick={() => setConfirmId(null)}
                    className="text-[10px] text-gray-400 hover:underline"
                  >
                    Cancelar
                  </button>
                </div>
              ) : (
                <button
                  onClick={() => setConfirmId(entry.id)}
                  aria-label={`Apagar registo de ${entry.hours}h de ${entry.person.name}`}
                  className="ml-1 text-gray-300 hover:text-red-500 focus-visible:outline-2 focus-visible:outline-red-500 transition-colors leading-none"
                >
                  ✕
                </button>
              )}
            </li>
          )
        })}
      </ul>
    </div>
  )
}
