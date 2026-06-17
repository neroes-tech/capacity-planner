import { useState, useEffect } from 'react'
import { useSettings, useUpdateSettings } from '../../hooks/useCapacityData'

export default function SettingsAdmin() {
  const { data: settings, isLoading } = useSettings()
  const update = useUpdateSettings()

  const [value, setValue] = useState('')
  const [saved, setSaved]   = useState(false)
  const [error, setError]   = useState<string | null>(null)

  useEffect(() => {
    if (settings) setValue(String(settings.efficiency_factor))
  }, [settings])

  async function handleSave() {
    setError(null)
    setSaved(false)
    const f = parseFloat(value)
    if (isNaN(f) || f <= 0 || f > 1) {
      setError('Deve ser um número entre 0.01 e 1.00.')
      return
    }
    try {
      await update.mutateAsync(f)
      setSaved(true)
    } catch {
      setError('Erro ao guardar.')
    }
  }

  if (isLoading) return <p className="text-sm text-gray-400 animate-pulse">A carregar…</p>

  const preview = parseFloat(value)

  return (
    <div className="space-y-6">
      <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wide">
        Definições Globais
      </h3>

      <div className="bg-gray-50 rounded-xl p-5 space-y-3">
        <div>
          <label htmlFor="efficiency-factor" className="block text-sm font-medium text-[#1E2B26] mb-1">
            Fator de eficiência
          </label>
          <p className="text-xs text-gray-500 mb-3">
            Percentagem das horas contratuais que é efetivamente produtiva (ex: 0.85 = 85%).
            Afeta o cálculo da Capacidade Efetiva da equipa.
          </p>
          <div className="flex items-center gap-3">
            <input
              id="efficiency-factor"
              type="number"
              min="0.01"
              max="1"
              step="0.01"
              value={value}
              onChange={(e) => { setValue(e.target.value); setSaved(false) }}
              onKeyDown={(e) => e.key === 'Enter' && handleSave()}
              className="w-28 rounded-lg border border-gray-200 px-3 py-2 text-sm tabular-nums focus:outline-none focus:ring-2 focus:ring-[#0E6B5C]"
            />
            <span className="text-sm text-gray-400">
              = <span className="tabular-nums font-semibold">
                {!isNaN(preview) ? `${Math.round(preview * 100)}%` : '—'}
              </span>
            </span>
          </div>
        </div>

        <div className="flex items-center gap-3 pt-1">
          <button
            onClick={handleSave}
            disabled={update.isPending}
            className="px-4 py-2 text-xs font-medium text-white bg-[#0E6B5C] rounded-lg hover:bg-[#0a5549] disabled:opacity-50 focus-visible:outline-2 focus-visible:outline-[#0E6B5C]"
          >
            {update.isPending ? 'A guardar…' : 'Guardar'}
          </button>
          {saved && <span className="text-xs text-[#0E6B5C]">✓ Guardado</span>}
          {error && <span role="alert" className="text-xs text-red-600">{error}</span>}
        </div>
      </div>
    </div>
  )
}
