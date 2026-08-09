import { getIronSession, SessionOptions } from 'iron-session'
import { cookies } from 'next/headers'

export interface SessionData {
  isLoggedIn: boolean
  userId?: string
  email?: string
  name?: string
  role?: string
  agencyId?: string  // Inquilino (agencia) al que pertenece el usuario — multi-tenant
  googleOAuthState?: string  // nonce anti-CSRF del flujo OAuth de Google Calendar
  // ── Verificación en dos pasos ──
  // Estado INTERMEDIO tras validar la contraseña: `isLoggedIn` sigue en false
  // (el proxy bloquea todo) hasta que se verifique el código del
  // autenticador. `pendingStage` distingue si falta verificar o registrar 2FA.
  pendingUserId?: string
  pendingStage?: 'verify' | 'enroll'
  pendingAt?: number  // marca de tiempo: el paso intermedio caduca a los 10 min
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
