import { useRef, useState } from 'react'
import { usePeople, useWorkspaces, useAddEntry } from '../hooks/useCapacityData'

interface Props {
  week: string
}

export default function EntryForm({ week }: Props) {
  const { data: people } = usePeople()
  const { data: workspaces } = useWorkspaces()
  const addEntry = useAddEntry()

  const [personId, setPersonId] = useState('')
  const [workspaceId, setWorkspaceId] = useState('')
  const [tipo, setTipo] = useState<'Real' | 'Planeado'>('Real')
  const [hours, setHours] = useState('')
  const [error, setError] = useState<string | null>(null)

  const hoursRef = useRef<HTMLInputElement>(null)

  async function submit() {
    setError(null)
    if (!personId) { setError('Seleciona uma pessoa.'); return }
    if (!workspaceId) { setError('Seleciona um workspace.'); return }
    const h = parseFloat(hours)
    if (!hours || isNaN(h) || h <= 0) { setError('Insere um número de horas válido.'); return }

    try {
      await addEntry.mutateAsync({ week, person_id: personId, workspace_id: workspaceId, tipo, hours: h })
      setHours('')
      hoursRef.current?.focus()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Erro ao guardar registo.')
    }
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'Enter') submit()
  }

  const labelCls = 'block text-xs font-medium text-gray-600 mb-1'
  const selectCls =
    'w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm text-[#1E2B26] focus:outline-none focus:ring-2 focus:ring-[#0E6B5C] focus:border-transparent'

  return (
    <div>
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-3">
        <div>
          <label htmlFor="form-person" className={labelCls}>Pessoa</label>
          <select
            id="form-person"
            value={personId}
            onChange={(e) => setPersonId(e.target.value)}
            onKeyDown={handleKeyDown}
            className={selectCls}
          >
            <option value="">— pessoa —</option>
            {(people ?? []).map((p) => (
              <option key={p.id} value={p.id}>{p.name}</option>
            ))}
          </select>
        </div>

        <div>
          <label htmlFor="form-workspace" className={labelCls}>Workspace</label>
          <select
            id="form-workspace"
            value={workspaceId}
            onChange={(e) => setWorkspaceId(e.target.value)}
            onKeyDown={handleKeyDown}
            className={selectCls}
          >
            <option value="">— workspace —</option>
            {(workspaces ?? []).map((w) => (
              <option key={w.id} value={w.id}>{w.short_name}</option>
            ))}
          </select>
        </div>

        <div>
          <label htmlFor="form-tipo" className={labelCls}>Tipo</label>
          <select
            id="form-tipo"
            value={tipo}
            onChange={(e) => setTipo(e.target.value as 'Real' | 'Planeado')}
            onKeyDown={handleKeyDown}
            className={selectCls}
          >
            <option value="Real">Real</option>
            <option value="Planeado">Planeado</option>
          </select>
        </div>

        <div>
          <label htmlFor="form-hours" className={labelCls}>Horas</label>
          <div className="flex gap-2">
            <input
              id="form-hours"
              ref={hoursRef}
              type="number"
              min="0.5"
              max="60"
              step="0.5"
              value={hours}
              onChange={(e) => setHours(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="0"
              className={`${selectCls} tabular-nums`}
            />
            <button
              onClick={submit}
              disabled={addEntry.isPending}
              aria-label="Adicionar registo"
              className="shrink-0 px-3 py-2 bg-[#0E6B5C] text-white rounded-lg text-sm font-medium hover:bg-[#0a5549] focus-visible:outline-2 focus-visible:outline-[#0E6B5C] disabled:opacity-50 transition-colors"
            >
              {addEntry.isPending ? '…' : '+'}
            </button>
          </div>
        </div>
      </div>

      {error && (
        <p role="alert" className="text-xs text-red-600 mb-3">
          {error}
        </p>
      )}
    </div>
  )
}
