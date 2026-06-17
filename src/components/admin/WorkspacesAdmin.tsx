import { useState } from 'react'
import { useWorkspaces, useAddWorkspace, useUpdateWorkspace, useDeleteWorkspace } from '../../hooks/useCapacityData'
import type { Workspace } from '../../types'

const inputCls = 'w-full rounded-lg border border-gray-200 px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#0E6B5C]'

type WsForm = { name: string; short_name: string; color: string; team_objective_pct: string }

function emptyForm(ws?: Workspace): WsForm {
  return {
    name:               ws?.name ?? '',
    short_name:         ws?.short_name ?? '',
    color:              ws?.color ?? '#0E6B5C',
    team_objective_pct: String(ws?.team_objective_pct ?? 0),
  }
}

function ColorInput({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  return (
    <div className="flex gap-2 items-center">
      <input
        type="color"
        value={value}
        onChange={e => onChange(e.target.value)}
        className="w-8 h-8 rounded cursor-pointer border border-gray-200 p-0.5"
        aria-label="Cor do workspace"
      />
      <input
        type="text"
        value={value}
        onChange={e => onChange(e.target.value)}
        maxLength={7}
        pattern="#[0-9A-Fa-f]{6}"
        placeholder="#000000"
        className={`${inputCls} font-mono uppercase w-28`}
      />
    </div>
  )
}

export default function WorkspacesAdmin() {
  const { data: workspaces, isLoading } = useWorkspaces()
  const addWs    = useAddWorkspace()
  const updateWs = useUpdateWorkspace()
  const deleteWs = useDeleteWorkspace()

  const [editingId, setEditingId]         = useState<string | null>(null)
  const [editForm, setEditForm]           = useState<WsForm>(emptyForm())
  const [showNew, setShowNew]             = useState(false)
  const [newForm, setNewForm]             = useState<WsForm>(emptyForm())
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null)
  const [error, setError]                 = useState<string | null>(null)

  function validate(f: WsForm): string | null {
    if (!f.name.trim()) return 'Nome é obrigatório.'
    if (!f.short_name.trim()) return 'Nome curto é obrigatório.'
    if (!/^#[0-9A-Fa-f]{6}$/.test(f.color)) return 'Cor inválida (ex: #C94A57).'
    const pct = parseFloat(f.team_objective_pct)
    if (isNaN(pct) || pct < 0 || pct > 100) return 'Objetivo deve ser entre 0 e 100.'
    return null
  }

  function startEdit(ws: Workspace) {
    setEditingId(ws.id)
    setEditForm(emptyForm(ws))
    setError(null)
  }

  async function saveEdit() {
    const err = validate(editForm)
    if (err) { setError(err); return }
    try {
      await updateWs.mutateAsync({
        id: editingId!,
        name: editForm.name.trim(),
        short_name: editForm.short_name.trim(),
        color: editForm.color,
        team_objective_pct: parseFloat(editForm.team_objective_pct),
      })
      setEditingId(null)
      setError(null)
    } catch { setError('Erro ao guardar.') }
  }

  async function saveNew() {
    const err = validate(newForm)
    if (err) { setError(err); return }
    try {
      await addWs.mutateAsync({
        name: newForm.name.trim(),
        short_name: newForm.short_name.trim(),
        color: newForm.color,
        team_objective_pct: parseFloat(newForm.team_objective_pct),
      })
      setNewForm(emptyForm())
      setShowNew(false)
      setError(null)
    } catch { setError('Erro ao adicionar.') }
  }

  if (isLoading) return <p className="text-sm text-gray-400 animate-pulse">A carregar…</p>

  const totalPct = (workspaces ?? []).reduce((s, w) => s + w.team_objective_pct, 0)

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wide">
            Workspaces ({workspaces?.length ?? 0})
          </h3>
          <p className={`text-xs mt-0.5 tabular-nums ${Math.abs(totalPct - 100) > 0.1 ? 'text-amber-600' : 'text-gray-400'}`}>
            Total padrão: {totalPct}%{Math.abs(totalPct - 100) > 0.1 ? ' ⚠ deve somar 100%' : ''}
          </p>
        </div>
        <button
          onClick={() => { setShowNew(true); setError(null) }}
          className="text-xs font-medium text-[#0E6B5C] hover:underline focus-visible:outline-2 focus-visible:outline-[#0E6B5C]"
        >
          + Adicionar
        </button>
      </div>

      {error && <p role="alert" className="text-xs text-red-600">{error}</p>}

      {/* Novo workspace */}
      {showNew && (
        <WsForm
          form={newForm}
          onChange={setNewForm}
          onSave={saveNew}
          onCancel={() => { setShowNew(false); setError(null) }}
          isPending={addWs.isPending}
          title="Novo workspace"
        />
      )}

      {/* Lista */}
      <ul className="space-y-2">
        {(workspaces ?? []).map((ws) =>
          editingId === ws.id ? (
            <li key={ws.id}>
              <WsForm
                form={editForm}
                onChange={setEditForm}
                onSave={saveEdit}
                onCancel={() => setEditingId(null)}
                isPending={updateWs.isPending}
                title={`Editar: ${ws.name}`}
              />
            </li>
          ) : (
            <li key={ws.id}
              className="flex items-center gap-3 bg-gray-50 rounded-xl px-4 py-3">
              <span
                className="w-3 h-3 rounded-full shrink-0"
                style={{ backgroundColor: ws.color }}
                aria-hidden="true"
              />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-[#1E2B26] truncate">{ws.name}</p>
                <p className="text-xs text-gray-400">
                  {ws.short_name}
                  {' · '}
                  <span className="tabular-nums font-semibold">{ws.team_objective_pct}%</span>
                  {' · '}
                  <span className="font-mono text-xs">{ws.color}</span>
                </p>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <button onClick={() => startEdit(ws)}
                  className="text-xs text-[#0E6B5C] hover:underline focus-visible:outline-2 focus-visible:outline-[#0E6B5C]">
                  Editar
                </button>
                {confirmDelete === ws.id ? (
                  <>
                    <button onClick={() => deleteWs.mutate(ws.id)}
                      className="text-xs font-medium text-red-600 hover:underline">
                      Confirmar
                    </button>
                    <button onClick={() => setConfirmDelete(null)}
                      className="text-xs text-gray-400 hover:underline">
                      Cancelar
                    </button>
                  </>
                ) : (
                  <button onClick={() => setConfirmDelete(ws.id)}
                    className="text-xs text-gray-300 hover:text-red-500">
                    Eliminar
                  </button>
                )}
              </div>
            </li>
          ),
        )}
      </ul>
    </div>
  )
}

function WsForm({
  form, onChange, onSave, onCancel, isPending, title,
}: {
  form: WsForm
  onChange: (f: WsForm) => void
  onSave: () => void
  onCancel: () => void
  isPending: boolean
  title: string
}) {
  return (
    <div className="bg-gray-50 rounded-xl p-4 border border-[#0E6B5C]/30 space-y-3">
      <p className="text-xs font-semibold text-[#1E2B26]">{title}</p>
      <div>
        <label className="block text-xs text-gray-500 mb-0.5">Nome completo</label>
        <input className={inputCls} value={form.name}
          onChange={e => onChange({ ...form, name: e.target.value })} />
      </div>
      <div className="grid grid-cols-2 gap-2">
        <div>
          <label className="block text-xs text-gray-500 mb-0.5">Nome curto</label>
          <input className={inputCls} value={form.short_name}
            onChange={e => onChange({ ...form, short_name: e.target.value })} />
        </div>
        <div>
          <label className="block text-xs text-gray-500 mb-0.5">Objetivo padrão (%)</label>
          <input className={`${inputCls} tabular-nums`} type="number" min="0" max="100" step="0.5"
            value={form.team_objective_pct}
            onChange={e => onChange({ ...form, team_objective_pct: e.target.value })} />
        </div>
      </div>
      <div>
        <label className="block text-xs text-gray-500 mb-0.5">Cor</label>
        <ColorInput value={form.color} onChange={c => onChange({ ...form, color: c })} />
      </div>
      <div className="flex gap-2 pt-1">
        <button onClick={onCancel}
          className="px-3 py-1.5 text-xs text-gray-500 border border-gray-200 rounded-lg hover:bg-gray-100">
          Cancelar
        </button>
        <button onClick={onSave} disabled={isPending}
          className="px-3 py-1.5 text-xs font-medium text-white bg-[#0E6B5C] rounded-lg hover:bg-[#0a5549] disabled:opacity-50">
          {isPending ? 'A guardar…' : 'Guardar'}
        </button>
      </div>
    </div>
  )
}
