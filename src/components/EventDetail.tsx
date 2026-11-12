import { useEffect, useRef } from 'react'
import { eventLinkLabel, formatMiles, formatWhen, venueLine } from '../lib/format.ts'
import { chip, chipOn } from '../lib/styles.ts'
import type { EventItem } from '../types.ts'
import { Heart } from './Heart.tsx'

type Props = {
  event: EventItem
  saved: boolean
  onToggleSave: (event: EventItem) => void
  onClose: () => void
}

export function EventDetail({ event, saved, onToggleSave, onClose }: Props) {
  const closeRef = useRef<HTMLButtonElement>(null)
  const distance = formatMiles(event.distance)

  useEffect(() => {
    closeRef.current?.focus()
  }, [event.id])

  return (
    <section aria-label="Event details" className="flex max-h-[75dvh] flex-col overflow-y-auto bg-card md:h-full md:max-h-none">
      <div className="mx-auto mt-3 h-1.5 w-12 shrink-0 rounded-full bg-ink/15 md:hidden" aria-hidden="true" />
      <div className="sticky top-0 z-10 flex items-center justify-between gap-3 bg-card/95 px-4 py-3 backdrop-blur">
        <button ref={closeRef} type="button" className={chip} onClick={onClose}>
          Back
        </button>
        <button
          type="button"
          className={saved ? chipOn : chip}
          aria-pressed={saved}
          aria-label={saved ? `Remove ${event.name} from saved` : `Save ${event.name}`}
          onClick={() => onToggleSave(event)}
        >
          <span className="inline-flex items-center gap-2">
            <Heart filled={saved} />
            {saved ? 'Saved' : 'Save'}
          </span>
        </button>
      </div>
      {event.image ? (
        <img src={event.image} alt="" className="aspect-video w-full object-cover" />
      ) : (
        <div className="flex aspect-video items-end bg-ink px-5 py-5" aria-hidden="true">
          <span className="font-display text-3xl text-paper">{event.category}</span>
        </div>
      )}
      <div className="flex flex-col gap-3 px-5 py-5">
        <p className="text-xs font-semibold tracking-[0.14em] text-ink/60 uppercase">{event.category}</p>
        <h3 className="font-display text-3xl leading-tight text-balance">{event.name}</h3>
        <p className="text-base text-ink/80">{formatWhen(event.localDate, event.localTime)}</p>
        <p className="text-base text-ink/70">{venueLine(event.venue, event.city)}</p>
        {distance ? <p className="text-sm text-ink/70">{distance} away</p> : null}
        <p className="text-sm text-ink/70">{event.price ?? 'Price varies'}</p>
        {eventLinkLabel(event.url) ? (
          <a
            href={event.url}
            target="_blank"
            rel="noreferrer"
            className="mt-2 inline-flex w-fit items-center justify-center rounded-full bg-amber px-4 py-2.5 text-sm font-semibold text-on-amber hover:opacity-90"
          >
            {eventLinkLabel(event.url)}
            <span className="sr-only"> (opens in a new tab)</span>
          </a>
        ) : null}
      </div>
    </section>
  )
}
