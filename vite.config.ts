import { readFileSync } from 'node:fs'
import type { IncomingMessage, ServerResponse } from 'node:http'
import { resolve } from 'node:path'
import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import type { Connect, Plugin } from 'vite'
import { defineConfig } from 'vite'
import { completeAsk, parseAskRequest } from './functions/src/ask.ts'
import { DAILY_ASK_CAP, MINUTE_ASK_CAP, takeMinuteSlot, utcDay } from './functions/src/limits.ts'
import { searchPublicEvents } from './functions/src/catalog.ts'
import { sanitizeParams } from './functions/src/query.ts'

function valueFromEnvFile(text: string, wanted: string): string | undefined {
  for (const line of text.split('\n')) {
    const trimmed = line.trim()
    if (!trimmed || trimmed.startsWith('#')) continue
    const separator = trimmed.indexOf('=')
    if (separator === -1) continue
    const name = trimmed.slice(0, separator).trim()
    if (name !== wanted) continue
    let value = trimmed.slice(separator + 1).trim()
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1)
    }
    return value || undefined
  }
  return undefined
}

function readEnv(wanted: string): string | undefined {
  for (const name of ['.env.local', '.env']) {
    try {
      const text = readFileSync(resolve(process.cwd(), name), 'utf8')
      const value = valueFromEnvFile(text, wanted)
      if (value) return value
    } catch {
      // The env file is optional until a key is added.
    }
  }
  return undefined
}

function sendJson(res: ServerResponse, status: number, body: unknown) {
  res.statusCode = status
  res.setHeader('Content-Type', 'application/json')
  res.end(JSON.stringify(body))
}

function ticketmasterProxy(): Plugin {
  const events: Connect.NextHandleFunction = (req, res, next) => {
    void handleEvents(req, res, next)
  }
  const ask: Connect.NextHandleFunction = (req, res, next) => {
    void handleAsk(req, res, next)
  }

  return {
    name: 'ticketmaster-proxy',
    configureServer(server) {
      server.middlewares.use('/api/events', events)
      server.middlewares.use('/api/ask', ask)
      server.middlewares.use('/api/bookmarks', bookmarkForward)
    },
    configurePreviewServer(server) {
      server.middlewares.use('/api/events', events)
      server.middlewares.use('/api/ask', ask)
      server.middlewares.use('/api/bookmarks', bookmarkForward)
    },
  }
}

async function handleEvents(
  req: IncomingMessage,
  res: ServerResponse,
  next: Connect.NextFunction,
) {
  if (req.method !== 'GET') {
    next()
    return
  }

  const raw = req.url ?? ''
  const query = raw.includes('?') ? raw.slice(raw.indexOf('?') + 1) : ''
  const params = sanitizeParams(new URLSearchParams(query))
  const result = await searchPublicEvents(params, readEnv('TICKETMASTER_API_KEY') ?? '')
  sendJson(res, result.status, result.body)
}

let askMinute = { start: 0, count: 0 }
let askDay = ''
let askCount = 0

async function readJsonBody(req: IncomingMessage): Promise<unknown> {
  const chunks: Buffer[] = []
  let size = 0
  for await (const chunk of req) {
    const piece = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk)
    size += piece.length
    if (size > 24_000) return undefined
    chunks.push(piece)
  }
  const text = Buffer.concat(chunks).toString('utf8')
  if (!text) return {}
  return JSON.parse(text) as unknown
}

async function handleAsk(req: IncomingMessage, res: ServerResponse, next: Connect.NextFunction) {
  if (req.method !== 'POST') {
    next()
    return
  }

  const accountId = readEnv('CLOUDFLARE_ACCOUNT_ID')
  const token = readEnv('CLOUDFLARE_API_TOKEN')
  if (!accountId || !token) {
    sendJson(res, 503, {
      error: 'missing_key',
      message: 'Event questions are not set up on this site yet.',
    })
    return
  }

  let body: unknown
  try {
    body = await readJsonBody(req)
  } catch {
    sendJson(res, 400, { error: 'invalid', message: 'Ask a question about the events.' })
    return
  }
  if (body === undefined) {
    sendJson(res, 413, { error: 'invalid', message: 'That question is too long.' })
    return
  }

  const parsed = parseAskRequest(body)
  if (!parsed.ok) {
    sendJson(res, 400, { error: 'invalid', message: parsed.message })
    return
  }

  const now = Date.now()
  const today = utcDay(new Date(now))
  if (askDay !== today) {
    askDay = today
    askCount = 0
  }
  if (askCount >= DAILY_ASK_CAP) {
    sendJson(res, 429, {
      error: 'day',
      message: 'Questions are paused until tomorrow so this site stays inside the free allowance.',
    })
    return
  }
  const slot = takeMinuteSlot(askMinute, now, MINUTE_ASK_CAP)
  askMinute = slot.state
  if (!slot.allowed) {
    sendJson(res, 429, {
      error: 'minute',
      message: 'Too many questions at once. Wait a minute and try again.',
    })
    return
  }

  askCount += 1
  const outcome = await completeAsk(accountId, token, parsed.request, parsed.totalEvents)
  if (!outcome.ok) {
    sendJson(res, outcome.status, { error: outcome.error, message: outcome.message })
    return
  }
  sendJson(res, 200, { reply: outcome.reply })
}

const bookmarkForward: Connect.NextHandleFunction = (req, res) => {
  void (async () => {
    const suffix = !req.url || req.url === '/' ? '' : req.url
    const target = `https://localfind-fb.web.app/api/bookmarks${suffix}`
    const headers: Record<string, string> = {}
    if (typeof req.headers.authorization === 'string') headers.authorization = req.headers.authorization
    if (typeof req.headers['content-type'] === 'string') headers['content-type'] = req.headers['content-type']
    try {
      const response = await fetch(target, { method: req.method, headers })
      const body = await response.text()
      res.statusCode = response.status
      res.setHeader('Content-Type', response.headers.get('content-type') ?? 'application/json')
      res.end(body)
    } catch {
      sendJson(res, 502, { error: 'upstream', message: 'Could not reach the bookmark API.' })
    }
  })()
}

export default defineConfig({
  plugins: [react(), tailwindcss(), ticketmasterProxy()],
})
