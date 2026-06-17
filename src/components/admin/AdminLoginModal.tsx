import { useEffect, useRef, useState } from 'react'
import { useAdminCtx } from '../../contexts/AdminContext'

interface Props {
  onSuccess: () => void
  onCancel: () => void
}

export default function AdminLoginModal({ onSuccess, onCancel }: Props) {
  const [pin, setPin] = useState('')
  const [error, setError] = useState(false)
  const { login } = useAdminCtx()
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => { inputRef.current?.focus() }, [])

  function handleSubmit() {
    if (login(pin)) {
      onSuccess()
    } else {
      setError(true)
      setPin('')
      inputRef.current?.focus()
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40"
      role="dialog"
      aria-modal="true"
      aria-label="Acesso administrador"
    >
      <div className="bg-white rounded-xl p-6 shadow-xl w-72">
        <h2 className="text-sm font-bold text-[#1E2B26] mb-1">Administração</h2>
        <p className="text-xs text-gray-400 mb-4">Introduz o PIN para continuar.</p>

        <label htmlFor="admin-pin" className="block text-xs font-medium text-gray-600 mb-1">
          PIN
        </label>
        <input
          id="admin-pin"
          ref={inputRef}
          type="password"
          inputMode="numeric"
          value={pin}
          onChange={(e) => { setPin(e.target.value); setError(false) }}
          onKeyDown={(e) => e.key === 'Enter' && handleSubmit()}
          placeholder="••••"
          className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#0E6B5C] mb-1 tabular-nums"
        />
        {error && (
          <p role="alert" className="text-xs text-red-600 mb-2">PIN incorreto.</p>
        )}

        <div className="flex gap-2 mt-3">
          <button
            onClick={onCancel}
            className="flex-1 py-2 text-sm text-gray-500 border border-gray-200 rounded-lg hover:bg-gray-50 focus-visible:outline-2 focus-visible:outline-[#0E6B5C]"
          >
            Cancelar
          </button>
          <button
            onClick={handleSubmit}
            className="flex-1 py-2 text-sm font-medium text-white bg-[#0E6B5C] rounded-lg hover:bg-[#0a5549] focus-visible:outline-2 focus-visible:outline-[#0E6B5C]"
          >
            Entrar
          </button>
        </div>
      </div>
    </div>
  )
}
