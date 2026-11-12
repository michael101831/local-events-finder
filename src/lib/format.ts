export function formatWhen(localDate: string | null, localTime: string | null): string {
  if (!localDate) return 'Date to be announced'
  const [year, month, day] = localDate.split('-').map(Number)
  if (!year || !month || !day) return localDate
  const date = new Date(year, month - 1, day)
  const dayLabel = new Intl.DateTimeFormat('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
  }).format(date)
  if (!localTime) return dayLabel
  const [hours, minutes] = localTime.split(':').map(Number)
  if (hours == null || minutes == null || Number.isNaN(hours) || Number.isNaN(minutes)) return dayLabel
  date.setHours(hours, minutes, 0, 0)
  const timeLabel = new Intl.DateTimeFormat('en-US', {
    hour: 'numeric',
    minute: '2-digit',
  }).format(date)
  return `${dayLabel} · ${timeLabel}`
}

export function formatMiles(miles: number | null): string | null {
  if (miles == null || Number.isNaN(miles)) return null
  if (miles < 0.1) return 'Nearby'
  if (miles < 10) return `${miles.toFixed(1)} mi`
  return `${Math.round(miles)} mi`
}

export function eventLinkLabel(url: string): 'Event page' | 'Tickets' | null {
  if (!url) return null
  try {
    if (new URL(url).hostname === 'eventing.ing') return 'Event page'
  } catch {
    return 'Tickets'
  }
  return 'Tickets'
}

export function venueLine(venue: string, city: string): string {
  const place = [venue, city].filter(Boolean).join(' · ')
  return place || 'Venue to be announced'
}
