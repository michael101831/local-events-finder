import type { ReactNode } from 'react'
import { chipOn } from '../lib/styles.ts'
import type { EventItem, ListKind } from '../types.ts'
import { EventCard } from './EventCard.tsx'

type Props = {
  kind: ListKind
  message: string
  title: string
  countLabel: string
  events: EventItem[]
  selectedId: string | null
  savedIds: ReadonlySet<string>
  onSelect: (id: string) => void
  onToggleSave: (event: EventItem) => void
  hasMore: boolean
  loadingMore: boolean
  moreError: string | null
  onLoadMore: () => void
  onRetry: () => void
}

function StatusBlock({ title, body, action }: { title: string; body: string; action?: ReactNode }) {
  return (
    <div className="mt-6 rounded-3xl border border-dashed border-ink/20 bg-card px-5 py-8" aria-live="polite">
      <h3 className="font-display text-[1.75rem] leading-tight">{title}</h3>
      <p className="mt-2 max-w-sm text-sm leading-6 text-ink/70">{body}</p>
      {action ? <div className="mt-4">{action}</div> : null}
    </div>
  )
}

function Skeleton() {
  return (
    <div className="animate-pulse overflow-hidden rounded-2xl bg-card motion-reduce:animate-none" aria-hidden="true">
      <div className="aspect-video bg-ink/10" />
      <div className="space-y-2 px-4 py-4">
        <div className="h-3 w-16 rounded bg-ink/10" />
        <div className="h-5 w-3/4 rounded bg-ink/10" />
        <div className="h-3 w-1/2 rounded bg-ink/10" />
      </div>
    </div>
  )
}

const copy: Record<Exclude<ListKind, 'loading' | 'ready'>, { title: string; body: string }> = {
  locating: {
    title: 'Finding you',
    body: 'Checking this browser for a location.',
  },
  'need-location': {
    title: 'Where should we look?',
    body: 'Allow location, or search a city like Austin, TX.',
  },
  'missing-key': {
    title: 'Add your Ticketmaster key',
    body: '',
  },
  error: {
    title: "Events didn't load",
    body: '',
  },
  empty: {
    title: 'Nothing in this range',
    body: 'Try the next 30 days, another category, or a wider radius.',
  },
  'empty-saved': {
    title: 'Nothing saved yet',
    body: 'Hearts on events stay on this device.',
  },
  'empty-filtered': {
    title: 'No saved matches',
    body: 'Nothing saved matches this search, date, or category.',
  },
}

export function EventList({
  kind,
  message,
  title,
  countLabel,
  events,
  selectedId,
  savedIds,
  onSelect,
  onToggleSave,
  hasMore,
  loadingMore,
  moreError,
  onLoadMore,
  onRetry,
}: Props) {
  const status = kind === 'loading' || kind === 'ready' ? null : copy[kind]
  const body =
    kind === 'missing-key' || kind === 'error' || kind === 'need-location' || kind === 'empty-saved'
      ? message || status?.body
      : status?.body

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="flex items-baseline justify-between gap-3 px-4 pt-4">
        <h2 className="font-display text-2xl">{title}</h2>
        <p className="text-sm text-ink/60">{countLabel}</p>
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto px-4 pb-6">
        {kind === 'loading' ? (
          <div className="mt-4 flex flex-col gap-3" aria-busy="true">
            <p className="sr-only">Loading events</p>
            <Skeleton />
            <Skeleton />
            <Skeleton />
            <Skeleton />
          </div>
        ) : null}
        {status ? (
          <StatusBlock
            title={status.title}
            body={body ?? ''}
            action={
              kind === 'error' ? (
                <button type="button" className={chipOn} onClick={onRetry}>
                  Try again
                </button>
              ) : null
            }
          />
        ) : null}
        {kind === 'ready' ? (
          <ul className="mt-4 flex flex-col gap-3">
            {events.map((event) => (
              <li key={event.id}>
                <EventCard
                  event={event}
                  selected={event.id === selectedId}
                  saved={savedIds.has(event.id)}
                  onSelect={onSelect}
                  onToggleSave={onToggleSave}
                />
              </li>
            ))}
          </ul>
        ) : null}
        {kind === 'ready' && hasMore ? (
          <button
            type="button"
            className={`${chipOn} mt-4 w-full`}
            onClick={onLoadMore}
            disabled={loadingMore}
          >
            {loadingMore ? 'Loading…' : 'Load more'}
          </button>
        ) : null}
        {kind === 'ready' && moreError ? <p className="mt-3 text-sm text-ink/70">{moreError}</p> : null}
      </div>
    </div>
  )
}
