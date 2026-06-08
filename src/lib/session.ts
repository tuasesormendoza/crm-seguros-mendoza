import { getIronSession, SessionOptions } from 'iron-session'
import { cookies } from 'next/headers'

export interface SessionData {
  isLoggedIn: boolean
  userId?: string
  email?: string
  name?: string
  role?: string
}

// Deferred so Next.js build phase (no env vars injected yet) doesn't throw.
// The check runs at request time, not at module import time.
function getSessionOptions(): SessionOptions {
  const secret = process.env.SESSION_SECRET
  if (!secret) {
    throw new Error('SESSION_SECRET no está definido. Agrégalo a tus variables de entorno (mínimo 32 caracteres).')
  }
  return {
    password: secret,
    cookieName: 'crm-session',
    cookieOptions: { secure: process.env.NODE_ENV === 'production', maxAge: 60 * 60 * 8 }, // 8 horas
  }
}

export async function getSession() {
  const cookieStore = await cookies()
  return getIronSession<SessionData>(cookieStore, getSessionOptions())
}
