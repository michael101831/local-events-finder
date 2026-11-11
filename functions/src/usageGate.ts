import {
  DAILY_ASK_CAP,
  DAILY_BOOKMARK_CAP,
  DAILY_SEARCH_CAP,
  MINUTE_ASK_CAP,
  MINUTE_BOOKMARK_CAP,
  MINUTE_SEARCH_CAP,
  nextDailyCount,
  takeMinuteSlot,
  utcDay,
} from './limits.js'

export type SearchDecision = 'ok' | 'minute' | 'day' | 'unavailable'

const searchMessages: Record<Exclude<SearchDecision, 'ok'>, string> = {
  minute: 'Too many searches at once. Wait a minute and try again.',
  day: 'Search is paused until tomorrow so this site stays inside its free quota.',
  unavailable: 'Search is paused because the usage cap could not be checked.',
}

const askMessages: Record<Exclude<SearchDecision, 'ok'>, string> = {
  minute: 'Too many questions at once. Wait a minute and try again.',
  day: 'Questions are paused until tomorrow so this site stays inside the free allowance.',
  unavailable: 'Questions are paused because the usage cap could not be checked.',
}

const bookmarkMessages: Record<Exclude<SearchDecision, 'ok'>, string> = {
  minute: 'Too many bookmark reads at once. Wait a minute and try again.',
  day: 'Bookmark reads are paused until tomorrow.',
  unavailable: 'Bookmark reads are paused because the usage cap could not be checked.',
}

type GateName = 'searches' | 'asks' | 'bookmarks'

type Gate = {
  doc: string
  dailyCap: number
  minuteCap: number
  minute: { start: number; count: number }
  cappedDay: string
}

const gates: Record<GateName, Gate> = {
  searches: {
    doc: 'usage/searches',
    dailyCap: DAILY_SEARCH_CAP,
    minuteCap: MINUTE_SEARCH_CAP,
    minute: { start: 0, count: 0 },
    cappedDay: '',
  },
  asks: {
    doc: 'usage/asks',
    dailyCap: DAILY_ASK_CAP,
    minuteCap: MINUTE_ASK_CAP,
    minute: { start: 0, count: 0 },
    cappedDay: '',
  },
  bookmarks: {
    doc: 'usage/bookmarks',
    dailyCap: DAILY_BOOKMARK_CAP,
    minuteCap: MINUTE_BOOKMARK_CAP,
    minute: { start: 0, count: 0 },
    cappedDay: '',
  },
}

async function database() {
  const { getApps, initializeApp } = await import('firebase-admin/app')
  const { FieldValue, getFirestore } = await import('firebase-admin/firestore')
  if (getApps().length === 0) initializeApp()
  return { db: getFirestore(), FieldValue }
}

export function searchLimitMessage(decision: Exclude<SearchDecision, 'ok'>): string {
  return searchMessages[decision]
}

export function askLimitMessage(decision: Exclude<SearchDecision, 'ok'>): string {
  return askMessages[decision]
}

export function bookmarkLimitMessage(decision: Exclude<SearchDecision, 'ok'>): string {
  return bookmarkMessages[decision]
}

async function reserve(name: GateName, now: number): Promise<SearchDecision> {
  const gate = gates[name]
  const today = utcDay(new Date(now))
  if (gate.cappedDay === today) return 'day'

  const slot = takeMinuteSlot(gate.minute, now, gate.minuteCap)
  gate.minute = slot.state
  if (!slot.allowed) return 'minute'

  try {
    const { db, FieldValue } = await database()
    const ref = db.doc(gate.doc)
    const decision = await db.runTransaction(async (tx) => {
      const snap = await tx.get(ref)
      const data = snap.data()
      const storedDay = typeof data?.day === 'string' ? data.day : undefined
      const storedCount = typeof data?.count === 'number' ? data.count : undefined
      const next = nextDailyCount(storedDay, storedCount, today, gate.dailyCap)
      if (!next.allowed) return 'day' as const
      tx.set(ref, { day: today, count: next.count, updatedAt: FieldValue.serverTimestamp() })
      return 'ok' as const
    })
    if (decision === 'day') gate.cappedDay = today
    return decision
  } catch (error) {
    console.error('usage cap check failed', error instanceof Error ? error.message : 'unknown')
    return 'unavailable'
  }
}

export function reserveSearch(now = Date.now()): Promise<SearchDecision> {
  return reserve('searches', now)
}

export function reserveAsk(now = Date.now()): Promise<SearchDecision> {
  return reserve('asks', now)
}

export function reserveBookmarks(now = Date.now()): Promise<SearchDecision> {
  return reserve('bookmarks', now)
}
