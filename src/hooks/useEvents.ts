import { useCallback, useEffect, useState } from 'react'
import { EventsError, fetchEvents } from '../api/events.ts'
import type { EventItem, EventQuery } from '../types.ts'

type LoadStatus = 'idle' | 'loading' | 'ready' | 'error'

type EventPage = {
  key: string
  events: EventItem[]
  page: number
  totalPages: number
  totalElements: number
}

function toEventsError(error: unknown): EventsError {
  if (error instanceof EventsError) return error
  return new EventsError('api', 'Something went wrong loading events.')
}

function isAbort(error: unknown): boolean {
  return error instanceof Error && error.name === 'AbortError'
}

export function useEvents(query: EventQuery | null) {
  const [attempt, setAttempt] = useState(0)
  const requestKey = query ? `${attempt}:${JSON.stringify(query)}` : ''
  const [data, setData] = useState<EventPage | null>(null)
  const [error, setError] = useState<{ key: string; error: EventsError } | null>(null)
  const [pendingMoreKey, setPendingMoreKey] = useState<string | null>(null)

  useEffect(() => {
    if (!query) return
    const controller = new AbortController()
    const key = requestKey
    fetchEvents({ ...query, page: 0 }, controller.signal)
      .then((result) => {
        if (controller.signal.aborted) return
        setData({
          key,
          events: result.events,
          page: result.page,
          totalPages: result.totalPages,
          totalElements: result.totalElements,
        })
        setError((current) => (current?.key === key ? null : current))
      })
      .catch((err: unknown) => {
        if (isAbort(err) || controller.signal.aborted) return
        setError({ key, error: toEventsError(err) })
      })
    return () => controller.abort()
  }, [query, requestKey])

  const current = data?.key === requestKey ? data : null
  const activeError = error?.key === requestKey ? error.error : null
  const status: LoadStatus = !query ? 'idle' : current ? 'ready' : activeError ? 'error' : 'loading'

  const loadMore = useCallback(() => {
    if (!query || !current || pendingMoreKey === requestKey || current.page + 1 >= current.totalPages) return
    const key = requestKey
    const nextPage = current.page + 1
    setPendingMoreKey(key)
    fetchEvents({ ...query, page: nextPage })
      .then((result) => {
        setData((existing) => {
          if (!existing || existing.key !== key) return existing
          const seen = new Set(existing.events.map((event) => event.id))
          return {
            key,
            events: [...existing.events, ...result.events.filter((event) => !seen.has(event.id))],
            page: result.page,
            totalPages: result.totalPages,
            totalElements: result.totalElements,
          }
        })
      })
      .catch((err: unknown) => {
        if (isAbort(err)) return
        setError({ key, error: toEventsError(err) })
      })
      .finally(() => {
        setPendingMoreKey((pending) => (pending === key ? null : pending))
      })
  }, [query, current, pendingMoreKey, requestKey])

  const retry = useCallback(() => setAttempt((value) => value + 1), [])

  return {
    events: current?.events ?? [],
    totalElements: current?.totalElements ?? 0,
    hasMore: current ? current.page + 1 < current.totalPages : false,
    status,
    loadingMore: pendingMoreKey === requestKey,
    error: activeError,
    loadMore,
    retry,
  }
}
