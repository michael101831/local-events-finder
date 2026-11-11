import { useState } from 'react'
import { formatMiles, formatWhen, venueLine } from '../lib/format.ts'
import type { EventItem } from '../types.ts'
import { Heart } from './Heart.tsx'

type Props = {
  event: EventItem
  selected: boolean
  saved: boolean
  onSelect: (id: string) => void
  onToggleSave: (event: EventItem) => void
}

function CardMedia({ image, category }: { image: string | null; category: string }) {
  const [failed, setFailed] = useState(false)
  if (!image || failed) {
    return (
      <div className="flex aspect-video items-end bg-ink px-4 py-4" aria-hidden="true">
        <span className="font-display text-2xl text-paper">{category}</span>
      </div>
    )
  }
  return (
    <img
      src={image}
      alt=""
      className="aspect-video w-full object-cover"
      onError={() => setFailed(true)}
    />
  )
}

export function EventCard({ event, selected, saved, onSelect, onToggleSave }: Props) {
  const distance = formatMiles(event.distance)
  return (
    <article
      id={`event-${event.id}`}
      className={`relative overflow-hidden rounded-2xl border bg-card ${
        selected ? 'border-ink shadow-[inset_4px_0_0_#e8a317]' : 'border-ink/10'
      }`}
    >
      <button type="button" onClick={() => onSelect(event.id)} className="block w-full cursor-pointer text-left">
        <CardMedia key={`${event.id}:${event.image ?? ''}`} image={event.image} category={event.category} />
        <div className="px-4 py-3">
          <p className="text-xs font-semibold tracking-[0.14em] text-ink/60 uppercase">{event.category}</p>
          <h3 className="mt-1 font-display text-xl leading-tight text-balance">{event.name}</h3>
          <p className="mt-2 text-sm text-ink/80">{formatWhen(event.localDate, event.localTime)}</p>
          <p className="mt-1 text-sm text-ink/70">{venueLine(event.venue, event.city)}</p>
          {distance || event.price ? (
            <p className="mt-3 flex justify-between gap-3 text-sm text-ink/70">
              <span>{distance ?? ''}</span>
              <span>{event.price ?? ''}</span>
            </p>
          ) : null}
        </div>
      </button>
      <button
        type="button"
        className={`absolute top-3 right-3 z-10 grid h-11 w-11 cursor-pointer place-items-center rounded-full shadow ${
          saved ? 'bg-ink text-amber' : 'bg-paper/90 text-ink'
        }`}
        aria-pressed={saved}
        aria-label={saved ? `Remove ${event.name} from saved` : `Save ${event.name}`}
        onClick={() => onToggleSave(event)}
      >
        <Heart filled={saved} />
      </button>
    </article>
  )
}
