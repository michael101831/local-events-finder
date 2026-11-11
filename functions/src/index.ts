import { defineString } from 'firebase-functions/params'
import { onRequest } from 'firebase-functions/v2/https'
import { completeAsk, parseAskRequest } from './ask.js'
import { listDaybookEvents, removeFeed, replaceFeed, uidForAccount, uidForRead } from './bookmarkFeed.js'
import { sanitizeParams } from './query.js'
import { askLimitMessage, bookmarkLimitMessage, reserveAsk, reserveBookmarks, reserveSearch, searchLimitMessage } from './usageGate.js'

const ticketmasterApiKey = defineString('TICKETMASTER_API_KEY')
const cloudflareAccountId = defineString('CLOUDFLARE_ACCOUNT_ID')
const cloudflareApiToken = defineString('CLOUDFLARE_API_TOKEN')

function incomingParams(url: string | undefined): URLSearchParams {
  const raw = url ?? ''
  const query = raw.includes('?') ? raw.slice(raw.indexOf('?') + 1) : ''
  return new URLSearchParams(query)
}

export const events = onRequest(
  {
    region: 'us-central1',
    invoker: 'public',
    cors: false,
    timeoutSeconds: 15,
    maxInstances: 1,
    concurrency: 4,
    memory: '256MiB',
  },
  async (req, res) => {
    if (req.method !== 'GET') {
      res.status(405).json({ error: 'method', message: 'Use GET.' })
      return
    }

    const decision = await reserveSearch()
    if (decision !== 'ok') {
      res.setHeader('Cache-Control', 'no-store')
      res.status(decision === 'unavailable' ? 503 : 429).json({
        error: decision,
        message: searchLimitMessage(decision),
      })
      return
    }

    const apiKey = ticketmasterApiKey.value()
    if (!apiKey) {
      res.status(500).json({
        error: 'missing_key',
        message: 'Add TICKETMASTER_API_KEY to .env, then search again.',
      })
      return
    }

    const params = sanitizeParams(incomingParams(req.originalUrl || req.url))
    params.set('apikey', apiKey)

    try {
      const response = await fetch(
        `https://app.ticketmaster.com/discovery/v2/events.json?${params.toString()}`,
      )
      const body = await response.text()
      res.setHeader('Cache-Control', 'no-store')
      res.setHeader('Content-Type', response.headers.get('content-type') ?? 'application/json')
      res.status(response.status).send(body)
    } catch {
      res.status(502).json({
        error: 'upstream',
        message: 'Could not reach Ticketmaster.',
      })
    }
  },
)

export const ask = onRequest(
  {
    region: 'us-central1',
    invoker: 'public',
    cors: false,
    timeoutSeconds: 30,
    maxInstances: 1,
    concurrency: 4,
    memory: '256MiB',
  },
  async (req, res) => {
    if (req.method !== 'POST') {
      res.status(405).json({ error: 'method', message: 'Use POST.' })
      return
    }

    const accountId = cloudflareAccountId.value()
    const token = cloudflareApiToken.value()
    if (!accountId || !token) {
      res.status(503).json({
        error: 'missing_key',
        message: 'Event questions are not set up on this site yet.',
      })
      return
    }

    const parsed = parseAskRequest(req.body)
    if (!parsed.ok) {
      res.status(400).json({ error: 'invalid', message: parsed.message })
      return
    }

    const decision = await reserveAsk()
    if (decision !== 'ok') {
      res.setHeader('Cache-Control', 'no-store')
      res.status(decision === 'unavailable' ? 503 : 429).json({
        error: decision,
        message: askLimitMessage(decision),
      })
      return
    }

    const outcome = await completeAsk(accountId, token, parsed.request, parsed.totalEvents)
    res.setHeader('Cache-Control', 'no-store')
    if (!outcome.ok) {
      res.status(outcome.status).json({ error: outcome.error, message: outcome.message })
      return
    }
    res.status(200).json({ reply: outcome.reply })
  },
)

const bookmarkOrigins = new Set([
  'https://localfind-fb.web.app',
  'https://localfind-fb.firebaseapp.com',
  'https://calendar-project-fb.web.app',
  'https://calendar-project-fb.firebaseapp.com',
])

function allowBookmarkOrigin(origin: string | undefined): boolean {
  if (!origin) return false
  if (bookmarkOrigins.has(origin)) return true
  return /^http:\/\/(localhost|127\.0\.0\.1):\d+$/.test(origin)
}

function bookmarkCors(req: { get(name: string): string | undefined }, res: { setHeader(name: string, value: string): void }) {
  const origin = req.get('origin')
  if (!origin || !allowBookmarkOrigin(origin)) return
  res.setHeader('Access-Control-Allow-Origin', origin)
  res.setHeader('Vary', 'Origin')
  res.setHeader('Access-Control-Allow-Headers', 'Authorization, Content-Type')
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, DELETE, OPTIONS')
  res.setHeader('Access-Control-Max-Age', '600')
}

let failedFeedReads = { start: 0, count: 0 }

export const bookmarks = onRequest(
  {
    region: 'us-central1',
    invoker: 'public',
    cors: false,
    timeoutSeconds: 15,
    maxInstances: 1,
    concurrency: 4,
    memory: '256MiB',
  },
  async (req, res) => {
    bookmarkCors(req, res)
    res.setHeader('Cache-Control', 'no-store')
    if (req.method === 'OPTIONS') {
      res.status(204).send('')
      return
    }

    const path = req.path || ''
    const feedRoute = path.endsWith('/feed')

    if (feedRoute && (req.method === 'POST' || req.method === 'DELETE')) {
      const uid = await uidForAccount(req.get('authorization'))
      if (!uid) {
        res.status(401).json({ error: 'unauthorized', message: 'Sign in to LocalFind to connect Daybook.' })
        return
      }
      if (req.method === 'DELETE') {
        await removeFeed(uid)
        res.status(200).json({ ok: true })
        return
      }
      const created = await replaceFeed(uid)
      if ('retry' in created) {
        res.status(429).json({ error: 'minute', message: 'Wait a moment before creating another Daybook connection.' })
        return
      }
      res.status(200).json({ token: created.token })
      return
    }

    if (req.method !== 'GET' || feedRoute) {
      res.status(405).json({ error: 'method', message: 'Use GET to read bookmarks.' })
      return
    }

    const uid = await uidForRead(req.get('authorization'))
    if (!uid) {
      const now = Date.now()
      const fresh = failedFeedReads.start === 0 || now - failedFeedReads.start >= 60_000
      failedFeedReads = { start: fresh ? now : failedFeedReads.start, count: (fresh ? 0 : failedFeedReads.count) + 1 }
      res.status(failedFeedReads.count > 30 ? 429 : 401).json({
        error: 'unauthorized',
        message: 'That Daybook connection was not accepted.',
      })
      return
    }

    const decision = await reserveBookmarks()
    if (decision !== 'ok') {
      res.status(decision === 'unavailable' ? 503 : 429).json({
        error: decision,
        message: bookmarkLimitMessage(decision),
      })
      return
    }

    try {
      const events = await listDaybookEvents(uid)
      res.status(200).json({ events })
    } catch {
      res.status(502).json({ error: 'upstream', message: 'Could not read bookmarks. Try again.' })
    }
  },
)
