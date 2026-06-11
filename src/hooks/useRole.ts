'use client'

import { useEffect, useState } from 'react'

/**
 * Returns the current user's role ('admin' | 'agent' | 'assistant'), or
 * `null` while it's still loading. Used to gate pages/sections that
 * shouldn't be visible to certain roles (e.g. Asistente).
 */
export function useRole(): string | null {
  const [role, setRole] = useState<string | null>(null)

  useEffect(() => {
    fetch('/api/auth')
      .then(res => res.ok ? res.json() : { role: 'agent' })
      .then(data => setRole(data.role || 'agent'))
      .catch(() => setRole('agent'))
  }, [])

  return role
}
