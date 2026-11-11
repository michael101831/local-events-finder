import { createHash, randomBytes } from 'node:crypto'

export type DaybookEvent = {
  id: string
  title: string
  startDate: string
  endDate: string
  startTime: string
  endTime: string
  notes: string
  checklist: []
  attachments: []
  color: '#e2a339'
}

const DATE = /^\d{4}-\d{2}-\d{2}$/
const TIME = /^\d{2}:\d{2}/
const EVENT_ID = /^[A-Za-z0-9._-]{1,120}$/

function text(value: unknown, max: number): string {
  if (typeof value !== 'string') return ''
  const cleaned = value.replace(/[\u0000-\u001F]+/g, ' ').replace(/\s+/g, ' ').trim()
  return cleaned.length > max ? cleaned.slice(0, max) : cleaned
}

export function newFeedToken(): string {
  return randomBytes(32).toString('base64url')
}

export function feedHash(token: string): string {
  return createHash('sha256').update(token).digest('hex')
}

export function bearerToken(header: string | undefined): string | null {
  if (!header) return null
  const match = /^Bearer\s+(\S+)$/i.exec(header.trim())
  if (!match) return null
  const token = match[1]
  if (token.length < 20 || token.length > 4096) return null
  return token
}

export function isJwt(token: string): boolean {
  return token.split('.').length === 3
}

export function toDaybookEvent(value: unknown): DaybookEvent | null {
  if (!value || typeof value !== 'object') return null
  const event = value as Record<string, unknown>
  const id = text(event.id, 120)
  const title = text(event.name, 180)
  const startDate = text(event.localDate, 10)
  if (!EVENT_ID.test(id) || !title || !DATE.test(startDate)) return null
  const time = text(event.localTime, 8)
  const startTime = TIME.test(time) ? time.slice(0, 5) : ''
  const where = [text(event.venue, 160), text(event.city, 80)].filter(Boolean).join(', ')
  const price = text(event.price, 40)
  const category = text(event.category, 40)
  const url = text(event.url, 500)
  const notes = [
    where,
    category,
    price,
    url.startsWith('https://') ? url : '',
  ]
    .filter(Boolean)
    .join('\n')
    .slice(0, 600)

  return {
    id: `localfind-${id}`,
    title,
    startDate,
    endDate: startDate,
    startTime,
    endTime: '',
    notes,
    checklist: [],
    attachments: [],
    color: '#e2a339',
  }
}
