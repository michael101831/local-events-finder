import { useEffect, useState } from 'react'

export const THEME_KEY = 'localfind.theme'

export type ThemeName = 'light' | 'dark'

const THEME_COLOR = { light: '#f4efe6', dark: '#171410' }

export function preferredTheme(): ThemeName {
  try {
    const stored = localStorage.getItem(THEME_KEY)
    if (stored === 'dark' || stored === 'light') return stored
  } catch {
    // Storage can be blocked. Fall through to the system theme.
  }
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
}

export function applyTheme(theme: ThemeName) {
  document.documentElement.classList.toggle('dark', theme === 'dark')
  document.querySelector('meta[name="theme-color"]')?.setAttribute('content', THEME_COLOR[theme])
}

export function useTheme() {
  const [theme, setTheme] = useState<ThemeName>(preferredTheme)

  useEffect(() => {
    applyTheme(theme)
  }, [theme])

  useEffect(() => {
    const media = window.matchMedia('(prefers-color-scheme: dark)')
    const onChange = () => {
      try {
        const stored = localStorage.getItem(THEME_KEY)
        if (stored === 'dark' || stored === 'light') return
      } catch {
        return
      }
      setTheme(media.matches ? 'dark' : 'light')
    }
    media.addEventListener('change', onChange)
    return () => media.removeEventListener('change', onChange)
  }, [])

  function toggle() {
    setTheme((current) => {
      const next = current === 'dark' ? 'light' : 'dark'
      try {
        localStorage.setItem(THEME_KEY, next)
      } catch {
        // The choice still applies for this visit.
      }
      return next
    })
  }

  return { dark: theme === 'dark', toggle }
}
