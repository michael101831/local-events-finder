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
  return (
    <div className="flex flex-col gap-2 border-b border-ink/10 px-4 py-3 md:flex-row md:items-center md:overflow-x-auto">
      <div role="group" aria-label="Date" className="flex flex-wrap gap-2 md:shrink-0 md:flex-nowrap">
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
      <span className="mx-1 hidden h-6 w-px shrink-0 bg-ink/15 md:block" aria-hidden="true" />
      <div role="group" aria-label="Category" className="flex flex-wrap gap-2 md:shrink-0 md:flex-nowrap">
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
      <span className="mx-1 hidden h-6 w-px shrink-0 bg-ink/15 md:block" aria-hidden="true" />
      <div role="group" aria-label="Radius" className="flex flex-wrap gap-2 md:shrink-0 md:flex-nowrap" title={radiusEnabled ? undefined : 'Radius is used with your location.'}>
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
        {radiusEnabled ? null : <span className="sr-only">Radius is used with your location.</span>}
      </div>
    </div>
  )
}
