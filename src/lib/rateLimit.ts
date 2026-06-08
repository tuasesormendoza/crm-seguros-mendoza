/**
 * Simple in-memory rate limiter for login attempts.
 * Blocks an IP after MAX_ATTEMPTS failed logins for LOCKOUT_MS milliseconds.
 */

const MAX_ATTEMPTS = 5          // max failed attempts before lockout
const LOCKOUT_MS   = 15 * 60 * 1000  // 15 minutes lockout
const WINDOW_MS    = 10 * 60 * 1000  // track attempts within 10-minute window

interface Attempt {
  count: number
  firstAttempt: number
  lockedUntil?: number
}

// In-memory store — resets on server restart (acceptable for this use case)
const store = new Map<string, Attempt>()

export function checkRateLimit(ip: string): { allowed: boolean; remaining: number; retryAfter?: number } {
  const now = Date.now()
  const entry = store.get(ip)

  // Check if currently locked
  if (entry?.lockedUntil && now < entry.lockedUntil) {
    const retryAfter = Math.ceil((entry.lockedUntil - now) / 1000 / 60) // minutes
    return { allowed: false, remaining: 0, retryAfter }
  }

  // Reset if window expired
  if (entry && now - entry.firstAttempt > WINDOW_MS) {
    store.delete(ip)
    return { allowed: true, remaining: MAX_ATTEMPTS }
  }

  const count = entry?.count ?? 0
  return { allowed: true, remaining: MAX_ATTEMPTS - count }
}

export function recordFailedAttempt(ip: string): { blocked: boolean; remaining: number } {
  const now = Date.now()
  const entry = store.get(ip)

  // Reset if window expired
  if (entry && now - entry.firstAttempt > WINDOW_MS) {
    store.set(ip, { count: 1, firstAttempt: now })
    return { blocked: false, remaining: MAX_ATTEMPTS - 1 }
  }

  const newCount = (entry?.count ?? 0) + 1
  const firstAttempt = entry?.firstAttempt ?? now

  if (newCount >= MAX_ATTEMPTS) {
    store.set(ip, { count: newCount, firstAttempt, lockedUntil: now + LOCKOUT_MS })
    return { blocked: true, remaining: 0 }
  }

  store.set(ip, { count: newCount, firstAttempt })
  return { blocked: false, remaining: MAX_ATTEMPTS - newCount }
}

export function clearAttempts(ip: string) {
  store.delete(ip)
}
