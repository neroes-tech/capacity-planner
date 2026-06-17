import { useState } from 'react'
import { usePeople, useAddPerson, useUpdatePerson, useDeletePerson } from '../../hooks/useCapacityData'
import type { Person } from '../../types'

const inputCls = 'w-full rounded-lg border border-gray-200 px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#0E6B5C]'

type EditState = { name: string; weekly_hours: string; email: string }

function emptyEdit(p?: Person): EditState {
  return { name: p?.name ?? '', weekly_hours: String(p?.weekly_hours ?? 40), email: p?.email ?? '' }
}

export default function PeopleAdmin() {
  const { data: people, isLoading } = usePeople()
  const addPerson    = useAddPerson()
  const updatePerson = useUpdatePerson()
  const deletePerson = useDeletePerson()

  const [editingId, setEditingId]       = useState<string | null>(null)
  const [editForm, setEditForm]         = useState<EditState>(emptyEdit())
  const [showNew, setShowNew]           = useState(false)
  const [newForm, setNewForm]           = useState<EditState>(emptyEdit())
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null)
  const [saveError, setSaveError]       = useState<string | null>(null)

  function startEdit(p: Person) {
    setEditingId(p.id)
    setEditForm(emptyEdit(p))
    setSaveError(null)
  }

  async function saveEdit() {
    if (!editingId) return
    const h = parseFloat(editForm.weekly_hours)
    if (!editForm.name.trim() || isNaN(h) || h <= 0) {
      setSaveError('Nome e horas semanais são obrigatórios.')
      return
    }
    try {
      await updatePerson.mutateAsync({
        id: editingId,
        name: editForm.name.trim(),
        weekly_hours: h,
        email: editForm.email.trim() || null,
      })
      setEditingId(null)
      setSaveError(null)
    } catch {
      setSaveError('Erro ao guardar.')
    }
  }

  async function saveNew() {
    const h = parseFloat(newForm.weekly_hours)
    if (!newForm.name.trim() || isNaN(h) || h <= 0) {
      setSaveError('Nome e horas são obrigatórios.')
      return
    }
    try {
      await addPerson.mutateAsync({
        name: newForm.name.trim(),
        weekly_hours: h,
        email: newForm.email.trim() || null,
      })
      setNewForm(emptyEdit())
      setShowNew(false)
      setSaveError(null)
    } catch {
      setSaveError('Erro ao adicionar.')
    }
  }

  if (isLoading) return <p className="text-sm text-gray-400 animate-pulse">A carregar…</p>

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between mb-2">
        <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wide">
          Pessoas ({people?.length ?? 0})
        </h3>
        <button
          onClick={() => { setShowNew(true); setSaveError(null) }}
          className="text-xs font-medium text-[#0E6B5C] hover:underline focus-visible:outline-2 focus-visible:outline-[#0E6B5C]"
        >
          + Adicionar
        </button>
      </div>

      {saveError && (
        <p role="alert" className="text-xs text-red-600">{saveError}</p>
      )}

      {/* Nova pessoa */}
      {showNew && (
        <div className="bg-gray-50 rounded-xl p-4 border border-gray-200 space-y-2">
          <p className="text-xs font-semibold text-[#1E2B26]">Nova pessoa</p>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="block text-xs text-gray-500 mb-0.5">Nome</label>
              <input className={inputCls} value={newForm.name}
                onChange={e => setNewForm(f => ({ ...f, name: e.target.value }))} />
            </div>
            <div>
              <label className="block text-xs text-gray-500 mb-0.5">Horas/semana</label>
              <input className={`${inputCls} tabular-nums`} type="number" min="1" step="0.5"
                value={newForm.weekly_hours}
                onChange={e => setNewForm(f => ({ ...f, weekly_hours: e.target.value }))} />
            </div>
          </div>
          <div>
            <label className="block text-xs text-gray-500 mb-0.5">Email (para integração Motion)</label>
            <input className={inputCls} type="email" value={newForm.email}
              onChange={e => setNewForm(f => ({ ...f, email: e.target.value }))} />
          </div>
          <div className="flex gap-2 pt-1">
            <button onClick={() => { setShowNew(false); setSaveError(null) }}
              className="px-3 py-1.5 text-xs text-gray-500 border border-gray-200 rounded-lg hover:bg-gray-100">
              Cancelar
            </button>
            <button onClick={saveNew} disabled={addPerson.isPending}
              className="px-3 py-1.5 text-xs font-medium text-white bg-[#0E6B5C] rounded-lg hover:bg-[#0a5549] disabled:opacity-50">
              {addPerson.isPending ? 'A guardar…' : 'Guardar'}
            </button>
          </div>
        </div>
      )}

      {/* Lista */}
      <ul className="space-y-2">
        {(people ?? []).map((p) =>
          editingId === p.id ? (
            <li key={p.id} className="bg-gray-50 rounded-xl p-4 border border-[#0E6B5C]/30 space-y-2">
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-xs text-gray-500 mb-0.5">Nome</label>
                  <input className={inputCls} value={editForm.name}
                    onChange={e => setEditForm(f => ({ ...f, name: e.target.value }))} />
                </div>
                <div>
                  <label className="block text-xs text-gray-500 mb-0.5">Horas/semana</label>
                  <input className={`${inputCls} tabular-nums`} type="number" min="1" step="0.5"
                    value={editForm.weekly_hours}
                    onChange={e => setEditForm(f => ({ ...f, weekly_hours: e.target.value }))} />
                </div>
              </div>
              <div>
                <label className="block text-xs text-gray-500 mb-0.5">Email</label>
                <input className={inputCls} type="email" value={editForm.email}
                  onChange={e => setEditForm(f => ({ ...f, email: e.target.value }))} />
              </div>
              <div className="flex gap-2 pt-1">
                <button onClick={() => setEditingId(null)}
                  className="px-3 py-1.5 text-xs text-gray-500 border border-gray-200 rounded-lg hover:bg-gray-100">
                  Cancelar
                </button>
                <button onClick={saveEdit} disabled={updatePerson.isPending}
                  className="px-3 py-1.5 text-xs font-medium text-white bg-[#0E6B5C] rounded-lg hover:bg-[#0a5549] disabled:opacity-50">
                  {updatePerson.isPending ? 'A guardar…' : 'Guardar'}
                </button>
              </div>
            </li>
          ) : (
            <li key={p.id}
              className="flex items-center justify-between gap-3 bg-gray-50 rounded-xl px-4 py-3">
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-[#1E2B26]">{p.name}</p>
                <p className="text-xs text-gray-400">
                  <span className="tabular-nums font-semibold">{p.weekly_hours} h</span>/semana
                  {p.email && <span className="ml-2">· {p.email}</span>}
                </p>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <button onClick={() => startEdit(p)}
                  aria-label={`Editar ${p.name}`}
                  className="text-xs text-[#0E6B5C] hover:underline focus-visible:outline-2 focus-visible:outline-[#0E6B5C]">
                  Editar
                </button>
                {confirmDelete === p.id ? (
                  <>
                    <button onClick={() => deletePerson.mutate(p.id)}
                      className="text-xs font-medium text-red-600 hover:underline">
                      Confirmar
                    </button>
                    <button onClick={() => setConfirmDelete(null)}
                      className="text-xs text-gray-400 hover:underline">
                      Cancelar
                    </button>
                  </>
                ) : (
                  <button onClick={() => setConfirmDelete(p.id)}
                    aria-label={`Eliminar ${p.name}`}
                    className="text-xs text-gray-300 hover:text-red-500 focus-visible:outline-2 focus-visible:outline-red-500">
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
