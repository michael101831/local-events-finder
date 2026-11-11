import type { DatePreset } from '../types.ts'

function endOfLocalDay(date: Date): Date {
  const next = new Date(date)
  next.setHours(23, 59, 59, 0)
  return next
}

export function dateRange(preset: DatePreset, now = new Date()): { start: Date; end: Date } {
  if (preset === 'tonight') {
    const end = endOfLocalDay(now)
    return { start: now, end: end < now ? now : end }
  }

  if (preset === 'weekend') {
    const day = now.getDay()
    if (day === 0) {
      const end = endOfLocalDay(now)
      return { start: now, end: end < now ? now : end }
    }
    if (day === 6) {
      const end = endOfLocalDay(now)
      end.setDate(end.getDate() + 1)
      return { start: now, end }
    }
    const start = new Date(now)
    start.setDate(start.getDate() + (6 - day))
    start.setHours(0, 0, 0, 0)
    const end = endOfLocalDay(start)
    end.setDate(end.getDate() + 1)
    return { start, end }
  }

  const days = preset === '7days' ? 7 : 30
  const end = new Date(now)
  end.setDate(end.getDate() + days)
  return { start: now, end }
}

export function toTicketmasterDate(date: Date): string {
  return date.toISOString().replace(/\.\d{3}Z$/, 'Z')
}

export function localDateKey(date: Date): string {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

export function favoriteInRange(localDate: string | null, preset: DatePreset, now = new Date()): boolean {
  if (!localDate) return true
  const range = dateRange(preset, now)
  return localDate >= localDateKey(range.start) && localDate <= localDateKey(range.end)
}
