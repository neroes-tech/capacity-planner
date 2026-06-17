import { useRef } from 'react'
import { toWednesday, toDateString, addDays, parseDateString, formatWeekLabel } from '../lib/utils'

interface Props {
  week: string
  onChange: (week: string) => void
}

export default function WeekSelector({ week, onChange }: Props) {
  const inputRef = useRef<HTMLInputElement>(null)

  function shift(days: number) {
    const next = toDateString(addDays(parseDateString(week), days))
    onChange(next)
  }

  function handleDateChange(e: React.ChangeEvent<HTMLInputElement>) {
    if (!e.target.value) return
    const snapped = toDateString(toWednesday(new Date(e.target.value + 'T12:00:00')))
    onChange(snapped)
    // sync native input to the snapped value
    if (inputRef.current) inputRef.current.value = snapped
  }

  return (
    <div className="flex items-center gap-2">
      <button
        onClick={() => shift(-7)}
        aria-label="Semana anterior"
        className="w-8 h-8 flex items-center justify-center rounded-lg border border-gray-200 hover:bg-gray-50 focus-visible:outline-2 focus-visible:outline-[#0E6B5C] transition-colors"
      >
        ←
      </button>

      <div className="flex flex-col items-center">
        <span className="text-xs text-gray-500 leading-none mb-1">semana de</span>
        <label htmlFor="week-input" className="sr-only">Selecionar semana</label>
        <div className="relative">
          <span className="font-medium text-[#1E2B26] tabular-nums text-sm">
            {formatWeekLabel(week)}
          </span>
          <input
            id="week-input"
            ref={inputRef}
            type="date"
            defaultValue={week}
            onChange={handleDateChange}
            className="absolute inset-0 opacity-0 cursor-pointer w-full"
            aria-label="Data da semana"
          />
        </div>
      </div>

      <button
        onClick={() => shift(7)}
        aria-label="Semana seguinte"
        className="w-8 h-8 flex items-center justify-center rounded-lg border border-gray-200 hover:bg-gray-50 focus-visible:outline-2 focus-visible:outline-[#0E6B5C] transition-colors"
      >
        →
      </button>
    </div>
  )
}
