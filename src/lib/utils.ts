/** Retorna a quarta-feira que inicia a semana em que cai `date`. */
export function toWednesday(date: Date): Date {
  const d = new Date(date)
  d.setHours(0, 0, 0, 0)
  const day = d.getDay() // 0=Dom … 6=Sáb
  const diff = (day - 3 + 7) % 7   // dias a recuar até quarta (3)
  d.setDate(d.getDate() - diff)
  return d
}

/** Formata uma Date para YYYY-MM-DD em hora local (sem desvio UTC). */
export function toDateString(date: Date): string {
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, '0')
  const d = String(date.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

/** Analisa um string YYYY-MM-DD para Date em hora local. */
export function parseDateString(s: string): Date {
  const [y, m, d] = s.split('-').map(Number)
  return new Date(y, m - 1, d)
}

/** Adiciona `days` dias a uma Date. */
export function addDays(date: Date, days: number): Date {
  const d = new Date(date)
  d.setDate(d.getDate() + days)
  return d
}

/** "4 jun – 10 jun" a partir de uma string YYYY-MM-DD de quarta-feira. */
export function formatWeekLabel(weekStr: string): string {
  const start = parseDateString(weekStr)
  const end = addDays(start, 6)
  const opts: Intl.DateTimeFormatOptions = { day: 'numeric', month: 'short' }
  const locale = 'pt-PT'
  return `${start.toLocaleDateString(locale, opts)} – ${end.toLocaleDateString(locale, opts)}`
}

/** Arredonda para 1 casa decimal. */
export function round1(n: number): number {
  return Math.round(n * 10) / 10
}
