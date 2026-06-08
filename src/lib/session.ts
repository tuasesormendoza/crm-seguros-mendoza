import { getIronSession, SessionOptions } from 'iron-session'
import { cookies } from 'next/headers'

export interface SessionData {
  isLoggedIn: boolean
  userId?: string
  email?: string
  name?: string
  role?: string
}

if (!process.env.SESSION_SECRET) {
  throw new Error('SESSION_SECRET no está definido. Agrégalo a .env.local (mínimo 32 caracteres).')
}

export const sessionOptions: SessionOptions = {
  password: process.env.SESSION_SECRET,
  cookieName: 'crm-session',
  cookieOptions: { secure: process.env.NODE_ENV === 'production', maxAge: 60 * 60 * 8 }, // 8 horas
}

export async function getSession() {
  const cookieStore = await cookies()
  return getIronSession<SessionData>(cookieStore, sessionOptions)
}
