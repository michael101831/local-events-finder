import { useEffect } from 'react'
import { divIcon, type Map as LeafletMap } from 'leaflet'
import { MapContainer, Marker, TileLayer, useMap } from 'react-leaflet'
import type { Coords, EventItem } from '../types.ts'

type Props = {
  events: EventItem[]
  selectedId: string | null
  onSelect: (id: string) => void
  userCoords: Coords | null
  active: boolean
}

function pointsOf(events: EventItem[]): [number, number][] {
  const points: [number, number][] = []
  for (const event of events) {
    if (event.lat != null && event.lng != null) points.push([event.lat, event.lng])
  }
  return points
}

function pinIcon(selected: boolean) {
  const size = selected ? 22 : 16
  return divIcon({
    className: 'localfind-pin',
    html: `<span class="pin${selected ? ' pin-selected' : ''}"></span>`,
    iconSize: [size, size],
    iconAnchor: [size / 2, size / 2],
  })
}

function MapResizer({ active }: { active: boolean }) {
  const map = useMap()

  useEffect(() => {
    const container = map.getContainer()
    const refresh = () => {
      window.requestAnimationFrame(() => {
        map.invalidateSize()
      })
    }
    refresh()
    const observer = new ResizeObserver(refresh)
    observer.observe(container)
    window.addEventListener('resize', refresh)
    return () => {
      observer.disconnect()
      window.removeEventListener('resize', refresh)
    }
  }, [active, map])

  return null
}

function MapView({
  events,
  selectedId,
  selectedLat,
  selectedLng,
  userCoords,
  active,
}: {
  events: EventItem[]
  selectedId: string | null
  selectedLat: number | null
  selectedLng: number | null
  userCoords: Coords | null
  active: boolean
}) {
  const map = useMap()
  const boundsKey = events.map((event) => `${event.id}:${event.lat}:${event.lng}`).join('|')

  useEffect(() => {
    if (!active || selectedLat == null || selectedLng == null) return
    const id = window.setTimeout(() => {
      map.invalidateSize()
      map.flyTo([selectedLat, selectedLng], Math.max(map.getZoom(), 13), { duration: 0.45 })
    }, 60)
    return () => window.clearTimeout(id)
  }, [active, selectedLat, selectedLng, map])

  useEffect(() => {
    if (!active || selectedId) return
    const id = window.setTimeout(() => {
      map.invalidateSize()
      fitEvents(map, events, userCoords)
    }, 60)
    return () => window.clearTimeout(id)
  }, [active, selectedId, boundsKey, events, userCoords, map])

  return null
}

function fitEvents(map: LeafletMap, events: EventItem[], userCoords: Coords | null) {
  const points = pointsOf(events)
  if (points.length === 1) {
    const [lat, lng] = points[0]
    map.setView([lat, lng], 12)
    return
  }
  if (points.length > 1) {
    map.fitBounds(points, { padding: [36, 36], maxZoom: 13 })
    return
  }
  if (userCoords) map.setView([userCoords.lat, userCoords.lng], 11)
}

export function EventMap({ events, selectedId, onSelect, userCoords, active }: Props) {
  const points = pointsOf(events)
  const selected = events.find((event) => event.id === selectedId)
  const center: [number, number] = userCoords ? [userCoords.lat, userCoords.lng] : [39.8, -98.6]

  if (!active) return null

  return (
    <div className="absolute inset-0">
      <MapContainer
        center={center}
        zoom={userCoords ? 11 : 4}
        className="h-full w-full"
        scrollWheelZoom
        aria-label="Map of events"
      >
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        <MapResizer active={active} />
        <MapView
          events={events}
          selectedId={selectedId}
          selectedLat={selected?.lat ?? null}
          selectedLng={selected?.lng ?? null}
          userCoords={userCoords}
          active={active}
        />
        {events.map((event) =>
          event.lat != null && event.lng != null ? (
            <Marker
              key={`${event.id}-${event.id === selectedId ? 'on' : 'off'}`}
              position={[event.lat, event.lng]}
              icon={pinIcon(event.id === selectedId)}
              title={event.name}
              zIndexOffset={event.id === selectedId ? 500 : 0}
              eventHandlers={{ click: () => onSelect(event.id) }}
            />
          ) : null,
        )}
      </MapContainer>
      {events.length > 0 && points.length === 0 ? (
        <p className="pointer-events-none absolute bottom-8 left-1/2 z-10 max-w-xs -translate-x-1/2 rounded-full bg-paper/90 px-4 py-2 text-center text-sm text-ink/70 shadow">
          These events have no venue coordinates.
        </p>
      ) : null}
    </div>
  )
}
