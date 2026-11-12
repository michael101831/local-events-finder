import { useCallback, useEffect, useMemo, useState } from 'react'
import { EventDetail } from './components/EventDetail.tsx'
import { EventHelper } from './components/EventHelper.tsx'
import { EventList } from './components/EventList.tsx'
import { EventMap } from './components/EventMap.tsx'
import { FilterBar } from './components/FilterBar.tsx'
import { Header } from './components/Header.tsx'
import { useDebounced } from './hooks/useDebounced.ts'
import { useEvents } from './hooks/useEvents.ts'
import { useAuth } from './hooks/useAuth.ts'
import { useBookmarks } from './hooks/useBookmarks.ts'
import { useGeolocation, type GeoStatus } from './hooks/useGeolocation.ts'
import { useIsDesktop } from './hooks/useIsDesktop.ts'
import { useTheme } from './hooks/useTheme.ts'
import { dateRange, favoriteInRange, toTicketmasterDate } from './lib/dates.ts'
import { matchesKeyword } from './lib/filters.ts'
import { parsePlace } from './lib/place.ts'
import { DATE_PRESETS, type Category, type DatePreset, type EventQuery, type ListKind, type Radius } from './types.ts'

function locationMessage(status: GeoStatus): string {
  if (status === 'denied' || status === 'unsupported') {
    return 'Location is blocked. Search a city like Austin, TX.'
  }
  if (status === 'error') return 'Location timed out. Search a city like Austin, TX.'
  return 'Allow location, or search a city like Austin, TX.'
}

export default function App() {
  const geo = useGeolocation()
  const account = useAuth()
  const favorites = useBookmarks(account.user)
  const isDesktop = useIsDesktop()
  const theme = useTheme()
  const [keyword, setKeyword] = useState('')
  const debouncedKeyword = useDebounced(keyword, 300)
  const [cityQuery, setCityQuery] = useState<string | null>(null)
  const [preset, setPreset] = useState<DatePreset>('7days')
  const [category, setCategory] = useState<Category | 'all'>('all')
  const [radius, setRadius] = useState<Radius>(25)
  const [showSaved, setShowSaved] = useState(false)
  const [selection, setSelection] = useState<{ id: string; key: string } | null>(null)
  const [mobileView, setMobileView] = useState<'list' | 'map'>('list')

  const query = useMemo<EventQuery | null>(() => {
    if (showSaved) return null
    const range = dateRange(preset)
    const shared = {
      keyword: debouncedKeyword.trim() || undefined,
      classificationName: category === 'all' ? undefined : category,
      startDateTime: toTicketmasterDate(range.start),
      endDateTime: toTicketmasterDate(range.end),
      datePreset: preset,
      timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone,
      size: 20,
      sort: 'date,asc',
    }
    if (cityQuery) {
      const place = parsePlace(cityQuery)
      if (!place.city) return null
      return { ...shared, city: place.city, stateCode: place.stateCode }
    }
    if (!geo.coords) return null
    return {
      ...shared,
      latlong: `${geo.coords.lat},${geo.coords.lng}`,
      radius,
      unit: 'miles',
    }
  }, [showSaved, cityQuery, geo.coords, preset, debouncedKeyword, category, radius])

  const selectionResetKey = showSaved
    ? `saved:${debouncedKeyword}:${preset}:${category}`
    : query
      ? JSON.stringify(query)
      : 'idle'

  const selectedId = selection?.key === selectionResetKey ? selection.id : null
  const { events, totalElements, hasMore, status, loadingMore, error, loadMore, retry } = useEvents(query)

  const savedEvents = useMemo(
    () =>
      favorites.items.filter((event) => {
        if (category !== 'all' && event.category !== category) return false
        if (!favoriteInRange(event.localDate, preset)) return false
        return matchesKeyword(event, debouncedKeyword)
      }),
    [favorites.items, category, preset, debouncedKeyword],
  )

  const visible = showSaved ? savedEvents : events
  const selected = visible.find((event) => event.id === selectedId) ?? null
  const savedIds = useMemo(() => new Set(favorites.items.map((item) => item.id)), [favorites.items])

  const kind: ListKind = (() => {
    if (showSaved) {
      if (favorites.items.length === 0) return 'empty-saved'
      if (savedEvents.length === 0) return 'empty-filtered'
      return 'ready'
    }
    if (!cityQuery && geo.status === 'locating' && !geo.coords) return 'locating'
    if (!cityQuery && !geo.coords) return 'need-location'
    if (query && (status === 'loading' || status === 'idle')) return 'loading'
    if (status === 'error' && error?.code === 'missing_key') return 'missing-key'
    if (status === 'error' && events.length === 0) return 'error'
    if (status === 'ready' && events.length === 0) return 'empty'
    if (events.length === 0) return 'loading'
    return 'ready'
  })()

  const countLabel = showSaved
    ? favorites.items.length === savedEvents.length
      ? `${savedEvents.length} saved`
      : `${savedEvents.length} of ${favorites.items.length}`
    : status === 'ready' && kind === 'ready'
      ? `${totalElements} ${totalElements === 1 ? 'event' : 'events'}`
      : ''

  const closeDetail = useCallback(() => {
    const id = selectedId
    setSelection(null)
    if (!id) return
    window.setTimeout(() => {
      const button = document.getElementById(`event-${id}`)?.querySelector('button')
      if (button instanceof HTMLElement) button.focus()
    }, 0)
  }, [selectedId])

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') closeDetail()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [closeDetail])

  const selectEvent = useCallback(
    (id: string) => {
      setSelection({ id, key: selectionResetKey })
    },
    [selectionResetKey],
  )

  const selectFromMap = useCallback(
    (id: string) => {
      setSelection({ id, key: selectionResetKey })
      setMobileView('map')
    },
    [selectionResetKey],
  )

  if (selection && selection.key !== selectionResetKey) {
    setSelection(null)
  }

  const filterLine = [
    DATE_PRESETS.find((item) => item.id === preset)?.label ?? 'Next 7 days',
    category === 'all' ? 'All categories' : category,
    debouncedKeyword.trim() ? `keyword ${debouncedKeyword.trim()}` : '',
  ]
    .filter(Boolean)
    .join(', ')

  const locationLabel = cityQuery
    ? cityQuery
    : geo.coords
      ? 'Near you'
      : geo.status === 'locating'
        ? 'Locating…'
        : 'Choose a place'

  const listClass =
    mobileView === 'map'
      ? 'relative z-10 hidden min-h-0 md:flex md:w-[420px] md:shrink-0 md:flex-col md:border-r md:border-ink/10'
      : 'relative z-10 flex min-h-0 w-full flex-col md:w-[420px] md:shrink-0 md:border-r md:border-ink/10'

  const mapClass =
    mobileView === 'list'
      ? 'relative isolate z-0 hidden h-full min-h-0 w-full min-w-0 flex-1 md:block'
      : 'relative isolate z-0 h-full min-h-0 w-full min-w-0 flex-1'

  return (
    <div className="flex h-dvh w-full min-w-0 flex-col overflow-hidden bg-paper font-sans text-ink antialiased">
      <Header
        keyword={keyword}
        onKeyword={setKeyword}
        locationLabel={locationLabel}
        locating={geo.status === 'locating'}
        onUseLocation={() => {
          setCityQuery(null)
          geo.request()
        }}
        onCitySearch={setCityQuery}
        savedCount={favorites.items.length}
        showSaved={showSaved}
        onToggleSaved={() => setShowSaved((value) => !value)}
        mobileView={mobileView}
        onMobileView={setMobileView}
        accountEmail={account.user?.email ?? null}
        accountBusy={account.busy}
        accountError={account.error}
        bookmarkError={favorites.error}
        onCreateAccount={account.createAccount}
        onSignIn={account.signIn}
        onSignOut={account.signOut}
        dark={theme.dark}
        onToggleDark={theme.toggle}
      />
      <FilterBar
        preset={preset}
        category={category}
        radius={radius}
        radiusEnabled={!cityQuery}
        onPreset={setPreset}
        onCategory={setCategory}
        onRadius={setRadius}
      />
      <div className="flex min-h-0 w-full min-w-0 flex-1">
        <section className={listClass} aria-label="Events">
          <EventList
            kind={kind}
            message={
              kind === 'need-location'
                ? locationMessage(geo.status)
                : kind === 'empty-saved'
                  ? account.user
                    ? 'Heart an event and it stays on your account.'
                    : 'Heart an event on this device, or create an account to keep bookmarks with you.'
                  : (error?.message ?? '')
            }
            title={showSaved ? 'Saved' : 'Nearby'}
            countLabel={countLabel}
            events={visible}
            selectedId={selected?.id ?? null}
            savedIds={savedIds}
            onSelect={selectEvent}
            onToggleSave={favorites.toggle}
            hasMore={!showSaved && hasMore}
            loadingMore={loadingMore}
            moreError={kind === 'ready' && error ? error.message : null}
            onLoadMore={loadMore}
            onRetry={retry}
          />
          {selected && isDesktop ? (
            <div className="detail-in absolute inset-0 z-10">
              <EventDetail
                event={selected}
                saved={savedIds.has(selected.id)}
                onToggleSave={favorites.toggle}
                onClose={closeDetail}
              />
            </div>
          ) : null}
        </section>
        <section className={mapClass} role="region" aria-label="Map">
          <EventMap
            events={visible}
            selectedId={selected?.id ?? null}
            onSelect={selectFromMap}
            userCoords={cityQuery ? null : geo.coords}
            active={isDesktop || mobileView === 'map'}
          />
        </section>
      </div>
      <EventHelper
        place={locationLabel}
        scope={showSaved ? 'saved' : 'nearby'}
        filters={filterLine}
        events={visible}
      />
      {selected && !isDesktop ? (
        <>
          <button
            type="button"
            className="fixed inset-0 z-30 bg-scrim/50"
            aria-label="Close event details"
            onClick={closeDetail}
          />
          <div className="detail-in fixed inset-x-0 bottom-0 z-40 overflow-hidden rounded-t-3xl shadow-[0_-12px_40px_rgb(0_0_0_/_35%)]">
            <EventDetail
              event={selected}
              saved={savedIds.has(selected.id)}
              onToggleSave={favorites.toggle}
              onClose={closeDetail}
            />
          </div>
        </>
      ) : null}
    </div>
  )
}
