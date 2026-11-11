import type { EventItem } from '../types.ts'

export function matchesKeyword(event: EventItem, keyword: string): boolean {
  const needle = keyword.trim().toLowerCase()
  if (!needle) return true
  return [event.name, event.venue, event.city, event.category].join(' ').toLowerCase().includes(needle)
}
