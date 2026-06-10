'use client'

import { useEffect } from 'react'
import { applyTheme } from '@/lib/utils'

/**
 * Applies the agency's custom brand colors (configured in Settings →
 * Apariencia) as CSS custom properties on <html>, overriding the defaults
 * defined in globals.css. Falls back silently to the built-in palette if the
 * request fails or no custom colors are set.
 */
export default function ThemeProvider({ children }: { children: React.ReactNode }) {
  useEffect(() => {
    let cancelled = false
    fetch('/api/theme')
      .then(res => res.ok ? res.json() : null)
      .then((theme: Record<string, string> | null) => {
        if (!theme || cancelled) return
        applyTheme(theme)
      })
      .catch(() => { /* keep defaults */ })
    return () => { cancelled = true }
  }, [])

  return <>{children}</>
}
