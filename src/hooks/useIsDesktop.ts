import { useEffect, useState } from 'react'

export function useIsDesktop() {
  const [matches, setMatches] = useState(() => window.matchMedia('(min-width: 768px)').matches)

  useEffect(() => {
    const media = window.matchMedia('(min-width: 768px)')
    const onChange = () => setMatches(media.matches)
    media.addEventListener('change', onChange)
    return () => media.removeEventListener('change', onChange)
  }, [])

  return matches
}
