export const CATEGORIES = ['Music', 'Sports', 'Arts & Theatre', 'Film', 'Miscellaneous'] as const

export type Category = (typeof CATEGORIES)[number]

export const DATE_PRESETS = [
  { id: 'tonight', label: 'Tonight' },
  { id: 'weekend', label: 'This weekend' },
  { id: '7days', label: 'Next 7 days' },
  { id: '30days', label: 'Next 30 days' },
] as const

export type DatePreset = (typeof DATE_PRESETS)[number]['id']

export const RADII = [5, 10, 25, 50] as const

export type Radius = (typeof RADII)[number]

export type Coords = {
  lat: number
  lng: number
}

export type EventItem = {
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

export type EventQuery = {
  keyword?: string
  latlong?: string
  city?: string
  stateCode?: string
  radius?: number
  unit?: 'miles'
  startDateTime?: string
  endDateTime?: string
  classificationName?: string
  page?: number
  size?: number
  sort?: string
  datePreset?: DatePreset
  timeZone?: string
}

export type EventsResult = {
  events: EventItem[]
  page: number
  totalPages: number
  totalElements: number
}

export type ListKind =
  | 'locating'
  | 'need-location'
  | 'loading'
  | 'missing-key'
  | 'error'
  | 'empty'
  | 'empty-saved'
  | 'empty-filtered'
  | 'ready'
