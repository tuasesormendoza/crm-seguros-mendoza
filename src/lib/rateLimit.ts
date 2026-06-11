/**
 * Limitador de intentos de login PERSISTENTE (tabla LoginAttempt).
 *
 * El anterior era en memoria, lo cual es inútil en serverless (Netlify): cada
 * petición puede caer en una instancia distinta y la memoria se borra en cada
 * cold-start, así que el bloqueo casi nunca se aplicaba. Esta versión guarda los
 * intentos en Postgres (Neon), por lo que el bloqueo es real y compartido entre
 * todas las instancias.
 */
import { prisma } from '@/lib/prisma'

const MAX_ATTEMPTS = 5               // intentos fallidos antes del bloqueo
const LOCKOUT_MS   = 15 * 60 * 1000  // bloqueo de 15 minutos
const WINDOW_MS    = 10 * 60 * 1000  // ventana de conteo de 10 minutos

export async function checkRateLimit(identifier: string): Promise<{ allowed: boolean; remaining: number; retryAfter?: number }> {
  const now = Date.now()
  const entry = await prisma.loginAttempt.findUnique({ where: { identifier } }).catch(() => null)

  if (entry?.lockedUntil && now < entry.lockedUntil.getTime()) {
    const retryAfter = Math.ceil((entry.lockedUntil.getTime() - now) / 1000 / 60) // minutos
    return { allowed: false, remaining: 0, retryAfter }
  }

  // Ventana expirada → empezar de cero
  if (entry && now - entry.firstAt.getTime() > WINDOW_MS) {
    return { allowed: true, remaining: MAX_ATTEMPTS }
  }

  const count = entry?.count ?? 0
  return { allowed: true, remaining: Math.max(MAX_ATTEMPTS - count, 0) }
}

export async function recordFailedAttempt(identifier: string): Promise<{ blocked: boolean; remaining: number }> {
  const now = new Date()
  const entry = await prisma.loginAttempt.findUnique({ where: { identifier } }).catch(() => null)

  // Sin registro o ventana expirada → reiniciar conteo
  if (!entry || now.getTime() - entry.firstAt.getTime() > WINDOW_MS) {
    await prisma.loginAttempt.upsert({
      where: { identifier },
      update: { count: 1, firstAt: now, lockedUntil: null },
      create: { identifier, count: 1, firstAt: now },
    }).catch(() => null)
    return { blocked: false, remaining: MAX_ATTEMPTS - 1 }
  }

  const newCount = entry.count + 1
  if (newCount >= MAX_ATTEMPTS) {
    await prisma.loginAttempt.update({
      where: { identifier },
      data: { count: newCount, lockedUntil: new Date(now.getTime() + LOCKOUT_MS) },
    }).catch(() => null)
    return { blocked: true, remaining: 0 }
  }

  await prisma.loginAttempt.update({
    where: { identifier },
    data: { count: newCount },
  }).catch(() => null)
  return { blocked: false, remaining: MAX_ATTEMPTS - newCount }
}

export async function clearAttempts(identifier: string): Promise<void> {
  await prisma.loginAttempt.deleteMany({ where: { identifier } }).catch(() => null)
}
