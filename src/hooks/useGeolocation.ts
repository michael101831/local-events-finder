import { useCallback, useState } from 'react'
import type { Coords } from '../types.ts'

export type GeoStatus = 'idle' | 'locating' | 'granted' | 'denied' | 'unsupported' | 'error'

export function useGeolocation() {
  const [status, setStatus] = useState<GeoStatus>('idle')
  const [coords, setCoords] = useState<Coords | null>(null)

  const request = useCallback(() => {
    if (typeof navigator === 'undefined' || !navigator.geolocation) {
      setStatus('unsupported')
      return
    }

    setStatus('locating')
    navigator.geolocation.getCurrentPosition(
      (position) => {
        setCoords({
          lat: position.coords.latitude,
          lng: position.coords.longitude,
        })
        setStatus('granted')
      },
      (error) => {
        setStatus(error.code === error.PERMISSION_DENIED ? 'denied' : 'error')
      },
      { enableHighAccuracy: false, timeout: 12000, maximumAge: 5 * 60 * 1000 },
    )
  }, [])

  return { status, coords, request }
}
