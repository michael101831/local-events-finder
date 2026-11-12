const MODEL = '@cf/meta/llama-3.2-3b-instruct'
const MAX_EVENTS = 15
const MAX_TURNS = 8

export type AskEvent = {
  name: string
  when: string
  where: string
  price: string | null
  category: string
}

export type AskTurn = {
  role: 'user' | 'assistant'
  content: string
}

export type AskRequest = {
  place: string
  scope: 'nearby' | 'saved'
  filters: string
  events: AskEvent[]
  turns: AskTurn[]
}

function clip(value: unknown, max: number): string {
  if (typeof value !== 'string') return ''
  const text = value.replace(/[\u0000-\u001F]+/g, ' ').replace(/\s+/g, ' ').trim()
  return text.length > max ? text.slice(0, max) : text
}

function asEvent(value: unknown): AskEvent | null {
  if (!value || typeof value !== 'object') return null
  const event = value as Record<string, unknown>
  const name = clip(event.name, 140)
  if (!name) return null
  const price = clip(event.price, 40)
  return {
    name,
    when: clip(event.when, 60) || 'Date to be announced',
    where: clip(event.where, 120) || 'Venue to be announced',
    price: price || null,
    category: clip(event.category, 40) || 'Event',
  }
}

export function parseAskRequest(
  body: unknown,
): { ok: true; request: AskRequest; totalEvents: number } | { ok: false; message: string } {
  if (!body || typeof body !== 'object') return { ok: false, message: 'Ask a question about the events.' }
  const input = body as Record<string, unknown>
  const scope = input.scope === 'saved' ? 'saved' : 'nearby'
  const rawTurns = Array.isArray(input.turns) ? input.turns.slice(-MAX_TURNS) : []
  const turns: AskTurn[] = []
  for (const turn of rawTurns) {
    if (!turn || typeof turn !== 'object') continue
    const item = turn as Record<string, unknown>
    const role = item.role === 'assistant' ? 'assistant' : item.role === 'user' ? 'user' : null
    const content = clip(item.content, 500)
    if (!role || !content) continue
    turns.push({ role, content })
  }
  const last = turns.at(-1)
  if (!last || last.role !== 'user') return { ok: false, message: 'Ask a question about the events.' }

  const rawEvents = Array.isArray(input.events) ? input.events : []
  const events = rawEvents.flatMap((event) => {
    const next = asEvent(event)
    return next ? [next] : []
  })

  return {
    ok: true,
    request: {
      place: clip(input.place, 80) || 'a place the visitor chooses',
      scope,
      filters: clip(input.filters, 160),
      events: events.slice(0, MAX_EVENTS),
      turns,
    },
    totalEvents: events.length,
  }
}

function eventLines(events: AskEvent[], total: number): string {
  if (events.length === 0) return 'Events currently on screen: none.'
  const lines = events.map((event, index) => {
    const price = event.price ?? 'price not listed'
    return `${index + 1}. ${event.name} | ${event.when} | ${event.where} | ${event.category} | ${price}`
  })
  const extra = total > events.length ? ` The screen has ${total} events. These are the first ${events.length}.` : ''
  return `Events currently on screen:\n${lines.join('\n')}${extra}`
}

export function promptFor(
  request: AskRequest,
  totalEvents: number,
): Array<{ role: 'system' | AskTurn['role']; content: string }> {
  const view = request.scope === 'saved' ? 'saved events' : 'nearby results'
  const system = [
    'You help visitors use Waymark to find concerts, games, and shows.',
    'Answer only from the events listed here and from how the site works.',
    'Do not invent event names, times, venues, or prices.',
    'If nothing fits, say so and suggest a next step: search a city like Austin, TX, use location, change the date (Tonight, This weekend, Next 7 days, Next 30 days), or change the category (Music, Sports, Arts & Theatre, Film, Miscellaneous).',
    'A heart saves an event. Saved events stay on the device, or on an account after sign-in.',
    'Keep the answer under 120 words.',
    `Place: ${request.place}.`,
    `View: ${view}.`,
    request.filters ? `Filters: ${request.filters}.` : '',
    eventLines(request.events, totalEvents),
  ]
    .filter(Boolean)
    .join(' ')

  return [{ role: 'system' as const, content: system }, ...request.turns]
}

function replyText(payload: unknown): string {
  if (!payload || typeof payload !== 'object') return ''
  const body = payload as Record<string, unknown>
  const result = body.result
  if (typeof result === 'string') return result.trim()
  if (result && typeof result === 'object' && typeof (result as { response?: unknown }).response === 'string') {
    return (result as { response: string }).response.trim()
  }
  return ''
}

export async function completeAsk(
  accountId: string,
  token: string,
  request: AskRequest,
  totalEvents: number,
): Promise<{ ok: true; reply: string } | { ok: false; status: number; error: string; message: string }> {
  const messages = promptFor(request, totalEvents).map((turn) => ({
    role: turn.role,
    content: turn.content,
  }))

  let response: Response
  try {
    response = await fetch(
      `https://api.cloudflare.com/client/v4/accounts/${accountId}/ai/run/${MODEL}`,
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ messages, max_tokens: 220 }),
      },
    )
  } catch {
    return { ok: false, status: 502, error: 'upstream', message: 'Could not reach the event helper. Try again.' }
  }

  const payload: unknown = await response.json().catch(() => null)
  if (response.status === 429) {
    return {
      ok: false,
      status: 429,
      error: 'quota',
      message: 'The free question allowance is used up for now. Try again later.',
    }
  }
  const reply = replyText(payload)
  if (!response.ok || !reply) {
    return { ok: false, status: 502, error: 'upstream', message: 'Could not answer that. Try again.' }
  }
  return { ok: true, reply: reply.length > 1200 ? reply.slice(0, 1200) : reply }
}
