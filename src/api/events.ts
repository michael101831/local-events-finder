import type { EventItem, EventQuery, EventsResult } from '../types.ts'

export class EventsError extends Error {
  code: 'missing_key' | 'unauthorized' | 'api' | 'network'

  constructor(code: EventsError['code'], message: string) {
    super(message)
    this.name = 'EventsError'
    this.code = code
  }
}

type TmImage = {
  url?: string
  width?: number
  height?: number
  ratio?: string
}

type TmEvent = {
  id?: string
  name?: string
  url?: string
  distance?: number | string
  images?: TmImage[]
  dates?: { start?: { localDate?: string; localTime?: string } }
  classifications?: Array<{ segment?: { name?: string } }>
  priceRanges?: Array<{ min?: number; max?: number; currency?: string }>
  _embedded?: {
    venues?: Array<{
      name?: string
      city?: { name?: string }
      location?: { latitude?: string; longitude?: string }
    }>
  }
}

type TmPayload = {
  _embedded?: { events?: TmEvent[] }
  page?: { number?: number; totalPages?: number; totalElements?: number }
  fault?: { faultstring?: string }
  errors?: Array<{ detail?: string }>
  error?: string
  message?: string
}

function pickImage(images: TmImage[] | undefined): string | null {
  if (!images?.length) return null
  const wide = images.filter((image) => {
    if (image.ratio === '16_9') return true
    if (!image.width || !image.height) return false
    return image.width / image.height > 1.4
  })
  const pool = wide.length > 0 ? wide : images
  const sorted = [...pool].sort((a, b) => (b.width ?? 0) - (a.width ?? 0))
  return (sorted.find((image) => (image.width ?? 0) >= 640) ?? sorted[0])?.url ?? null
}

function coordinate(value: string | undefined): number | null {
  if (!value) return null
  const number = Number(value)
  return Number.isFinite(number) ? number : null
}

function distanceOf(value: number | string | undefined): number | null {
  if (typeof value === 'number' && Number.isFinite(value)) return value
  if (typeof value === 'string' && value.trim()) {
    const number = Number(value)
    return Number.isFinite(number) ? number : null
  }
  return null
}

function formatMoney(amount: number, currency: string): string {
  try {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency,
      maximumFractionDigits: 0,
    }).format(amount)
  } catch {
    return `$${Math.round(amount)}`
  }
}

function formatPrice(ranges: TmEvent['priceRanges']): string | null {
  const range = ranges?.[0]
  if (!range || (range.min == null && range.max == null)) return null
  const currency = range.currency || 'USD'
  if (range.min != null && range.max != null && range.min !== range.max) {
    return `${formatMoney(range.min, currency)}–${formatMoney(range.max, currency)}`
  }
  const amount = range.min ?? range.max
  return amount == null ? null : formatMoney(amount, currency)
}

function mapEvent(raw: TmEvent): EventItem | null {
  if (!raw.id || !raw.name) return null
  const venue = raw._embedded?.venues?.[0]
  return {
    id: raw.id,
    name: raw.name,
    url: raw.url ?? '',
    image: pickImage(raw.images),
    localDate: raw.dates?.start?.localDate ?? null,
    localTime: raw.dates?.start?.localTime ?? null,
    venue: venue?.name || 'Venue to be announced',
    city: venue?.city?.name ?? '',
    lat: coordinate(venue?.location?.latitude),
    lng: coordinate(venue?.location?.longitude),
    price: formatPrice(raw.priceRanges),
    category: raw.classifications?.[0]?.segment?.name || 'Event',
    distance: distanceOf(raw.distance),
  }
}

function isPayload(value: unknown): value is TmPayload {
  return typeof value === 'object' && value != null
}

export async function fetchEvents(query: EventQuery, signal?: AbortSignal): Promise<EventsResult> {
  const params = new URLSearchParams()
  for (const [key, value] of Object.entries(query)) {
    if (value == null || value === '') continue
    params.set(key, String(value))
  }
  params.set('size', '20')
  params.set('sort', 'date,asc')

  let response: Response
  try {
    response = await fetch(`/api/events?${params.toString()}`, { signal })
  } catch (error) {
    if (error instanceof Error && error.name === 'AbortError') throw error
    throw new EventsError('network', 'Could not reach events. Check your connection and try again.')
  }

  const contentType = response.headers.get('content-type') ?? ''
  const payload: unknown = await response.json().catch(() => null)
  if (response.ok && contentType.includes('text/html')) {
    throw new EventsError(
      'api',
      'Event search is unavailable on this site. The request never reached Ticketmaster.',
    )
  }
  if (!response.ok) {
    if (isPayload(payload) && payload.error === 'missing_key') {
      throw new EventsError(
        'missing_key',
        payload.message || 'Add TICKETMASTER_API_KEY to .env, then search again.',
      )
    }
    if (isPayload(payload) && payload.error === 'upstream') {
      throw new EventsError('network', payload.message || 'Could not reach Ticketmaster.')
    }
    if (
      isPayload(payload) &&
      (payload.error === 'day' || payload.error === 'minute' || payload.error === 'unavailable')
    ) {
      throw new EventsError('api', payload.message || 'Event search is paused.')
    }
    if (response.status === 401) {
      throw new EventsError('unauthorized', 'Ticketmaster rejected the API key.')
    }
    const detail = isPayload(payload) ? payload.fault?.faultstring || payload.errors?.[0]?.detail : null
    throw new EventsError('api', detail || 'Ticketmaster could not return events.')
  }

  if (!isPayload(payload)) {
    throw new EventsError('api', 'Ticketmaster returned an unexpected response.')
  }

  return {
    events: (payload._embedded?.events ?? []).flatMap((event) => {
      const mapped = mapEvent(event)
      return mapped ? [mapped] : []
    }),
    page: payload.page?.number ?? 0,
    totalPages: payload.page?.totalPages ?? 0,
    totalElements: payload.page?.totalElements ?? 0,
  }
}
