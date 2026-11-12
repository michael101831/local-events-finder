export type ListedEvent = {
  id: string
  name: string
  url: string
  image: string | null
  localDate: string | null
  localTime: string | null
  venue: string
  city: string
  lat: number | null
  lng: number | null
  price: string | null
  category: string
  distance: number | null
}

export type ListedPage = {
  events: ListedEvent[]
  page: number
  totalPages: number
  totalElements: number
}

export type ListedFailure = {
  error: 'missing_key' | 'unauthorized' | 'upstream' | 'api'
  message: string
}

type SourcePage = {
  events: ListedEvent[]
  page: number
  totalPages: number
  totalElements: number
}

const PAGE_SIZE = 20
const EVENTING_CACHE_MS = 60_000
const EVENTING_CACHE_MAX = 40

const eventingCache = new Map<string, { expires: number; page: SourcePage }>()

function clip(value: string, max: number): string {
  return value.length > max ? value.slice(0, max) : value
}

function finiteNumber(value: unknown): number | null {
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

function pageCount(total: number): number {
  if (total <= 0) return 0
  return Math.ceil(total / PAGE_SIZE)
}

function requestedPage(params: URLSearchParams): number {
  const page = Number(params.get('page') ?? '0')
  return Number.isInteger(page) && page >= 0 ? page : 0
}

function originOf(latlong: string | null): { lat: number; lng: number } | null {
  if (!latlong) return null
  const [latText, lngText] = latlong.split(',')
  const lat = Number(latText)
  const lng = Number(lngText)
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null
  return { lat, lng }
}

function milesBetween(from: { lat: number; lng: number }, lat: number, lng: number): number {
  const toRad = (degrees: number) => (degrees * Math.PI) / 180
  const dLat = toRad(lat - from.lat)
  const dLng = toRad(lng - from.lng)
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(from.lat)) * Math.cos(toRad(lat)) * Math.sin(dLng / 2) ** 2
  return 3958.8 * 2 * Math.asin(Math.sqrt(a))
}

function zonedWhen(iso: string, timeZone: string): { localDate: string; localTime: string } | null {
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) return null
  try {
    const parts = new Intl.DateTimeFormat('en-US', {
      timeZone: timeZone || 'UTC',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hourCycle: 'h23',
    }).formatToParts(date)
    const read = (type: Intl.DateTimeFormatPartTypes) => parts.find((part) => part.type === type)?.value ?? ''
    const hour = read('hour') === '24' ? '00' : read('hour')
    return {
      localDate: `${read('year')}-${read('month')}-${read('day')}`,
      localTime: `${hour}:${read('minute')}:${read('second')}`,
    }
  } catch {
    return null
  }
}

function categoryFromTags(tags: string[]): string {
  const text = tags.join(' ')
  if (/music|concert|\bdj\b/.test(text)) return 'Music'
  if (/sport/.test(text)) return 'Sports'
  if (/film|movie|cinema/.test(text)) return 'Film'
  if (/art|theatre|theater|comedy|dance|culture/.test(text)) return 'Arts & Theatre'
  if (/food/.test(text)) return 'Food & drink'
  return 'Community'
}

function loose(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, '')
}

function byWhen(a: ListedEvent, b: ListedEvent): number {
  const date = (a.localDate ?? '9999').localeCompare(b.localDate ?? '9999')
  if (date !== 0) return date
  return (a.localTime ?? '99').localeCompare(b.localTime ?? '99')
}

function dedupe(events: ListedEvent[]): ListedEvent[] {
  const seen = new Set<string>()
  const unique: ListedEvent[] = []
  for (const event of events) {
    const name = loose(event.name)
    const key = name ? `${name}|${event.localDate ?? ''}|${loose(event.city)}` : event.id
    if (seen.has(key)) continue
    seen.add(key)
    unique.push(event)
  }
  return unique
}

type TmImage = { url?: string; width?: number; height?: number; ratio?: string }
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

function pickImage(images: TmImage[] | undefined): string | null {
  if (!images?.length) return null
  const wide = images.filter((image) => {
    if (image.ratio === '16_9') return true
    if (!image.width || !image.height) return false
    return image.width / image.height > 1.4
  })
  const pool = wide.length > 0 ? wide : images
  const sorted = [...pool].sort((a, b) => (b.width ?? 0) - (a.width ?? 0))
  const url = (sorted.find((image) => (image.width ?? 0) >= 640) ?? sorted[0])?.url ?? null
  return url && url.length < 2000 ? url : null
}

function formatTicketmasterPrice(ranges: TmEvent['priceRanges']): string | null {
  const range = ranges?.[0]
  if (!range || (range.min == null && range.max == null)) return null
  const currency = range.currency || 'USD'
  if (range.min != null && range.max != null && range.min !== range.max) {
    return clip(`${formatMoney(range.min, currency)}–${formatMoney(range.max, currency)}`, 80)
  }
  const amount = range.min ?? range.max
  return amount == null ? null : clip(formatMoney(amount, currency), 80)
}

function mapTicketmaster(raw: TmEvent): ListedEvent | null {
  if (!raw.id || !raw.name || raw.id.length >= 128) return null
  const venue = raw._embedded?.venues?.[0]
  return {
    id: raw.id,
    name: clip(raw.name, 299),
    url: clip(raw.url ?? '', 1999),
    image: pickImage(raw.images),
    localDate: raw.dates?.start?.localDate ?? null,
    localTime: raw.dates?.start?.localTime ?? null,
    venue: clip(venue?.name || 'Venue to be announced', 299),
    city: clip(venue?.city?.name ?? '', 119),
    lat: finiteNumber(venue?.location?.latitude),
    lng: finiteNumber(venue?.location?.longitude),
    price: formatTicketmasterPrice(raw.priceRanges),
    category: clip(raw.classifications?.[0]?.segment?.name || 'Event', 79),
    distance: finiteNumber(raw.distance),
  }
}

function eventingSearchUrl(params: URLSearchParams): string | null {
  const classification = params.get('classificationName')
  if (classification === 'Miscellaneous') return null

  const preset = params.get('datePreset')
  const date =
    preset === 'tonight' ? 'today' : preset === 'weekend' ? 'weekend' : preset === '30days' ? 'next-30' : 'next-7'
  const query = new URLSearchParams()
  query.set('date', date)
  query.set('format', 'in-person')
  query.set('size', String(PAGE_SIZE))
  query.set('page', String(requestedPage(params)))

  const timeZone = params.get('timeZone')
  if (timeZone) query.set('tz', timeZone)

  const latlong = params.get('latlong')
  if (latlong) {
    query.set('near', latlong)
    query.set('radius', params.get('radius') ?? '25')
  } else if (params.get('city')) {
    query.set('near', params.get('city') ?? '')
  } else {
    return null
  }

  let text = params.get('keyword') ?? ''
  if (classification === 'Music') text = `${text} music`.trim()
  if (classification === 'Film') text = `${text} film`.trim()
  if (classification === 'Sports') query.set('category', 'sports-outdoors')
  if (classification === 'Arts & Theatre') query.set('category', 'arts-culture')
  if (text) query.set('q', text.slice(0, 80))

  return `https://api.eventing.ing/events/search?${query.toString()}`
}

function formatEventingPrice(price: { kind?: string; minCents?: number | null; currency?: string | null } | undefined): string | null {
  if (!price) return null
  if (price.kind === 'free') return 'Free'
  if (price.kind !== 'paid' || price.minCents == null) return null
  return clip(formatMoney(price.minCents / 100, (price.currency || 'usd').toUpperCase()), 80)
}

function mapEventing(
  raw: Record<string, unknown>,
  origin: { lat: number; lng: number } | null,
  radius: number | null,
): ListedEvent | null {
  const id = typeof raw.id === 'string' ? raw.id : ''
  const name = typeof raw.title === 'string' ? raw.title : ''
  const eventingUrl = typeof raw.eventingUrl === 'string' ? raw.eventingUrl : ''
  if (!id || !name || id.length >= 128 || !eventingUrl) return null
  if (raw.format === 'online') return null

  const lat = finiteNumber(raw.latitude)
  const lng = finiteNumber(raw.longitude)
  let distance: number | null = null
  if (origin && lat != null && lng != null) {
    distance = Math.round(milesBetween(origin, lat, lng) * 10) / 10
    if (radius != null && distance > radius) return null
  } else if (origin) {
    return null
  }

  const when = typeof raw.startAt === 'string' ? zonedWhen(raw.startAt, typeof raw.timezone === 'string' ? raw.timezone : 'UTC') : null
  const organizers = Array.isArray(raw.organizers) ? raw.organizers : []
  const organizer = organizers.find((item) => item && typeof item === 'object') as { name?: string } | undefined
  const address = typeof raw.address === 'string' ? raw.address : ''
  const venue = organizer?.name || address.split(',')[0] || 'Venue to be announced'
  const tags = Array.isArray(raw.tags) ? raw.tags.filter((tag): tag is string => typeof tag === 'string') : []
  const cover = typeof raw.coverUrl === 'string' && raw.coverUrl.length < 2000 ? raw.coverUrl : null
  const price = raw.price && typeof raw.price === 'object' ? (raw.price as { kind?: string; minCents?: number | null; currency?: string | null }) : undefined

  return {
    id,
    name: clip(name, 299),
    url: clip(eventingUrl, 1999),
    image: cover,
    localDate: when?.localDate ?? null,
    localTime: when?.localTime ?? null,
    venue: clip(venue, 299),
    city: clip(typeof raw.city === 'string' ? raw.city : '', 119),
    lat,
    lng,
    price: formatEventingPrice(price),
    category: categoryFromTags(tags),
    distance,
  }
}

function readEventingCache(url: string): SourcePage | undefined {
  const hit = eventingCache.get(url)
  if (!hit) return undefined
  if (hit.expires <= Date.now()) {
    eventingCache.delete(url)
    return undefined
  }
  return hit.page
}

function storeEventingCache(url: string, page: SourcePage) {
  if (eventingCache.size >= EVENTING_CACHE_MAX) {
    const oldest = eventingCache.keys().next().value
    if (oldest) eventingCache.delete(oldest)
  }
  eventingCache.set(url, { expires: Date.now() + EVENTING_CACHE_MS, page })
}

async function loadEventing(params: URLSearchParams): Promise<SourcePage | null> {
  const url = eventingSearchUrl(params)
  if (!url) return { events: [], page: requestedPage(params), totalPages: 0, totalElements: 0 }

  const cached = readEventingCache(url)
  if (cached) return cached

  let response: Response
  try {
    response = await fetch(url, { signal: AbortSignal.timeout(8_000) })
  } catch {
    return null
  }
  if (!response.ok) return null

  const payload: unknown = await response.json().catch(() => null)
  if (!payload || typeof payload !== 'object') return null
  const body = payload as { events?: unknown; total?: unknown; page?: unknown }
  const rows = Array.isArray(body.events) ? body.events : []
  const origin = originOf(params.get('latlong'))
  const radius = finiteNumber(params.get('radius'))
  const events = rows.flatMap((row) => {
    if (!row || typeof row !== 'object') return []
    const mapped = mapEventing(row as Record<string, unknown>, origin, radius)
    return mapped ? [mapped] : []
  })
  const total = finiteNumber(body.total) ?? events.length
  const page: SourcePage = {
    events,
    page: finiteNumber(body.page) ?? requestedPage(params),
    totalPages: pageCount(total),
    totalElements: total,
  }
  storeEventingCache(url, page)
  return page
}

async function loadTicketmaster(params: URLSearchParams, apiKey: string): Promise<{ ok: true; page: SourcePage } | { ok: false; status: number; body: ListedFailure }> {
  const query = new URLSearchParams(params)
  query.delete('datePreset')
  query.delete('timeZone')
  query.set('apikey', apiKey)

  let response: Response
  try {
    response = await fetch(`https://app.ticketmaster.com/discovery/v2/events.json?${query.toString()}`, {
      signal: AbortSignal.timeout(8_000),
    })
  } catch {
    return { ok: false, status: 502, body: { error: 'upstream', message: 'Could not reach Ticketmaster.' } }
  }

  const payload: unknown = await response.json().catch(() => null)
  if (!response.ok || !payload || typeof payload !== 'object') {
    if (response.status === 401) {
      return { ok: false, status: 401, body: { error: 'unauthorized', message: 'Ticketmaster rejected the API key.' } }
    }
    const detail =
      payload && typeof payload === 'object'
        ? ((payload as { fault?: { faultstring?: string }; errors?: Array<{ detail?: string }> }).fault?.faultstring ??
          (payload as { errors?: Array<{ detail?: string }> }).errors?.[0]?.detail)
        : null
    return {
      ok: false,
      status: response.status >= 400 ? response.status : 502,
      body: { error: 'api', message: detail || 'Ticketmaster could not return events.' },
    }
  }

  const body = payload as {
    _embedded?: { events?: TmEvent[] }
    page?: { number?: number; totalPages?: number; totalElements?: number }
  }
  const events = (body._embedded?.events ?? []).flatMap((event) => {
    const mapped = mapTicketmaster(event)
    return mapped ? [mapped] : []
  })
  return {
    ok: true,
    page: {
      events,
      page: body.page?.number ?? requestedPage(params),
      totalPages: body.page?.totalPages ?? 0,
      totalElements: body.page?.totalElements ?? events.length,
    },
  }
}

function merged(ticketmaster: SourcePage | null, eventing: SourcePage | null, page: number): ListedPage {
  return {
    events: dedupe([...(ticketmaster?.events ?? []), ...(eventing?.events ?? [])]).sort(byWhen),
    page,
    totalPages: Math.max(ticketmaster?.totalPages ?? 0, eventing?.totalPages ?? 0),
    totalElements: (ticketmaster?.totalElements ?? 0) + (eventing?.totalElements ?? 0),
  }
}

export async function searchPublicEvents(params: URLSearchParams, apiKey: string): Promise<{ status: number; body: ListedPage | ListedFailure }> {
  const page = requestedPage(params)
  if (!apiKey) {
    const eventing = await loadEventing(params)
    if (eventing && eventing.events.length > 0) return { status: 200, body: merged(null, eventing, page) }
    return {
      status: 500,
      body: { error: 'missing_key', message: 'Add TICKETMASTER_API_KEY to .env, then search again.' },
    }
  }

  const [ticketmaster, eventing] = await Promise.all([loadTicketmaster(params, apiKey), loadEventing(params)])
  if (!ticketmaster.ok) {
    if (eventing && eventing.events.length > 0) return { status: 200, body: merged(null, eventing, page) }
    return { status: ticketmaster.status, body: ticketmaster.body }
  }
  return { status: 200, body: merged(ticketmaster.page, eventing, page) }
}
