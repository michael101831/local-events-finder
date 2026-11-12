import { useEffect, useId, useRef, useState } from 'react'
import { CATEGORIES, DATE_PRESETS, RADII, type Category, type DatePreset, type Radius } from '../types.ts'
import { chip, chipOn } from '../lib/styles.ts'

type Props = {
  preset: DatePreset
  category: Category | 'all'
  radius: Radius
  radiusEnabled: boolean
  onPreset: (value: DatePreset) => void
  onCategory: (value: Category | 'all') => void
  onRadius: (value: Radius) => void
}

export function FilterBar({
  preset,
  category,
  radius,
  radiusEnabled,
  onPreset,
  onCategory,
  onRadius,
}: Props) {
  const panelId = useId()
  const rootRef = useRef<HTMLDivElement>(null)
  const [open, setOpen] = useState(false)
  const dateLabel = DATE_PRESETS.find((item) => item.id === preset)?.label ?? 'Next 7 days'
  const categoryLabel = category === 'all' ? 'All' : category
  const summary = radiusEnabled ? `${dateLabel} · ${categoryLabel} · ${radius} mi` : `${dateLabel} · ${categoryLabel}`

  useEffect(() => {
    if (!open) return
    const onKey = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return
      event.stopPropagation()
      setOpen(false)
    }
    const onPointer = (event: PointerEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false)
    }
    window.addEventListener('keydown', onKey, true)
    window.addEventListener('pointerdown', onPointer)
    return () => {
      window.removeEventListener('keydown', onKey, true)
      window.removeEventListener('pointerdown', onPointer)
    }
  }, [open])

  return (
    <div ref={rootRef} className="relative z-20 border-b border-ink/10 px-4 py-3">
      <div className="flex min-w-0 flex-wrap items-center gap-2">
        <button
          type="button"
          className={open ? chipOn : chip}
          aria-expanded={open}
          aria-controls={panelId}
          onClick={() => setOpen((value) => !value)}
        >
          Filters
        </button>
        <p className="min-w-0 text-sm text-ink/70">{summary}</p>
      </div>
      {open ? (
        <div
          id={panelId}
          role="dialog"
          aria-label="Filters"
          className="absolute top-full right-4 left-4 z-30 mt-2 flex max-h-[min(24rem,calc(100dvh-8rem))] flex-col gap-4 overflow-y-auto rounded-3xl border border-ink/10 bg-card px-4 py-4 shadow-[0_16px_50px_rgb(0_0_0_/_28%)]"
        >
          <div role="group" aria-label="Date" className="flex flex-wrap gap-2">
            {DATE_PRESETS.map((item) => (
              <button
                key={item.id}
                type="button"
                className={preset === item.id ? chipOn : chip}
                aria-pressed={preset === item.id}
                onClick={() => onPreset(item.id)}
              >
                {item.label}
              </button>
            ))}
          </div>
          <div role="group" aria-label="Category" className="flex flex-wrap gap-2">
            <button
              type="button"
              className={category === 'all' ? chipOn : chip}
              aria-pressed={category === 'all'}
              onClick={() => onCategory('all')}
            >
              All
            </button>
            {CATEGORIES.map((item) => (
              <button
                key={item}
                type="button"
                className={category === item ? chipOn : chip}
                aria-pressed={category === item}
                onClick={() => onCategory(item)}
              >
                {item}
              </button>
            ))}
          </div>
          <div role="group" aria-label="Radius" className="flex flex-wrap gap-2">
            {RADII.map((miles) => (
              <button
                key={miles}
                type="button"
                className={radius === miles ? chipOn : chip}
                aria-pressed={radius === miles}
                disabled={!radiusEnabled}
                onClick={() => onRadius(miles)}
              >
                {miles} mi
              </button>
            ))}
            {radiusEnabled ? null : <p className="basis-full text-sm text-ink/65">Radius is used with your location.</p>}
          </div>
        </div>
      ) : null}
    </div>
  )
}
