export const DAILY_SEARCH_CAP = 250
export const MINUTE_SEARCH_CAP = 30
export const DAILY_ASK_CAP = 80
export const MINUTE_ASK_CAP = 6
export const DAILY_BOOKMARK_CAP = 200
export const MINUTE_BOOKMARK_CAP = 20

export function utcDay(now = new Date()): string {
  return now.toISOString().slice(0, 10)
}

export function nextDailyCount(
  storedDay: string | undefined,
  storedCount: number | undefined,
  today: string,
  cap = DAILY_SEARCH_CAP,
): { count: number; allowed: boolean } {
  const count = storedDay === today && Number.isFinite(storedCount) ? Math.max(0, storedCount ?? 0) : 0
  if (count >= cap) return { count, allowed: false }
  return { count: count + 1, allowed: true }
}

export function takeMinuteSlot(
  state: { start: number; count: number },
  now: number,
  cap = MINUTE_SEARCH_CAP,
): { state: { start: number; count: number }; allowed: boolean } {
  const fresh = state.start === 0 || now - state.start >= 60_000
  const start = fresh ? now : state.start
  const count = (fresh ? 0 : state.count) + 1
  return { state: { start, count }, allowed: count <= cap }
}
