import type { EventItem } from '../types.ts'

export type StoredBookmark = EventItem & { savedAt: number }

export function isEventItem(value: unknown): value is EventItem {
  if (!value || typeof value !== 'object') return false
  const event = value as Record<string, unknown>
  return (
    typeof event.id === 'string' &&
    typeof event.name === 'string' &&
    typeof event.url === 'string' &&
    (event.image === null || typeof event.image === 'string') &&
    (event.localDate === null || typeof event.localDate === 'string') &&
    (event.localTime === null || typeof event.localTime === 'string') &&
    typeof event.venue === 'string' &&
    typeof event.city === 'string' &&
    (event.lat === null || typeof event.lat === 'number') &&
    (event.lng === null || typeof event.lng === 'number') &&
    (event.price === null || typeof event.price === 'string') &&
    typeof event.category === 'string' &&
    (event.distance === null || typeof event.distance === 'number')
  )
}

export function toBookmark(event: EventItem, savedAt = Date.now()): StoredBookmark {
  return { ...event, distance: null, savedAt }
}
