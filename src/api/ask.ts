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

type AskBody = {
  place: string
  scope: 'nearby' | 'saved'
  filters: string
  events: AskEvent[]
  turns: AskTurn[]
}

export async function askHelper(body: AskBody): Promise<string> {
  let response: Response
  try {
    response = await fetch('/api/ask', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })
  } catch {
    throw new Error('Could not reach the event helper. Check your connection and try again.')
  }

  const contentType = response.headers.get('content-type') ?? ''
  if (contentType.includes('text/html')) {
    throw new Error('Event questions are unavailable on this site.')
  }

  const payload: unknown = await response.json().catch(() => null)
  const message =
    payload && typeof payload === 'object' && typeof (payload as { message?: unknown }).message === 'string'
      ? (payload as { message: string }).message
      : ''

  if (!response.ok) {
    throw new Error(message || 'Could not answer that. Try again.')
  }

  const reply =
    payload && typeof payload === 'object' && typeof (payload as { reply?: unknown }).reply === 'string'
      ? (payload as { reply: string }).reply.trim()
      : ''
  if (!reply) throw new Error('The event helper returned an empty answer.')
  return reply
}
