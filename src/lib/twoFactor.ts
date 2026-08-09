// ─────────────────────────────────────────────────────────────────────────────
// Verificación en dos pasos (2FA) — helpers compartidos por las rutas de login.
//
// Flujo: contraseña correcta → sesión INTERMEDIA (isLoggedIn=false, el
// proxy sigue bloqueando) → código del autenticador → sesión completa.
// El paso intermedio caduca a los 10 minutos.
// ─────────────────────────────────────────────────────────────────────────────

import bcrypt from 'bcryptjs'
import { prisma } from '@/lib/prisma'
import { getSession, type SessionData } from '@/lib/session'
import { logAudit } from '@/lib/audit'
import { normalizeBackupCode } from '@/lib/totp'

export const PENDING_TTL_MS = 10 * 60 * 1000 // 10 minutos

type Session = Awaited<ReturnType<typeof getSession>>

export interface PendingUser {
  id: string; email: string; name: string; role: string; agencyId: string | null
  totpSecret: string | null; totpEnabled: boolean; backupCodes: string | null
}

// Devuelve el usuario del paso intermedio si la sesión es válida y no caducó.
// `stage` restringe a un paso concreto ('verify' o 'enroll').
export async function getPendingUser(session: SessionData, stage?: 'verify' | 'enroll'): Promise<PendingUser | null> {
  if (!session.pendingUserId || !session.pendingStage) return null
  if (stage && session.pendingStage !== stage) return null
  if (!session.pendingAt || Date.now() - session.pendingAt > PENDING_TTL_MS) return null
  const user = await prisma.user.findUnique({
    where: { id: session.pendingUserId },
    select: { id: true, email: true, name: true, role: true, agencyId: true, totpSecret: true, totpEnabled: true, backupCodes: true, active: true },
  }).catch(() => null)
  if (!user || !user.active) return null
  const { active: _active, ...rest } = user
  return rest
}

// Marca la sesión como "falta el segundo paso" (sin dar acceso todavía).
export async function startPending(session: Session, userId: string, stage: 'verify' | 'enroll'): Promise<void> {
  session.isLoggedIn = false
  session.userId = undefined
  session.email = undefined
  session.name = undefined
  session.role = undefined
  session.agencyId = undefined
  session.pendingUserId = userId
  session.pendingStage = stage
  session.pendingAt = Date.now()
  await session.save()
}

// Cierra el login: crea la sesión completa y registra la auditoría.
export async function completeLogin(
  session: Session,
  user: { id: string; email: string; name: string; role: string; agencyId: string | null },
  ip?: string,
): Promise<void> {
  session.isLoggedIn = true
  session.userId = user.id
  session.email = user.email
  session.name = user.name
  session.role = user.role
  session.agencyId = user.agencyId ?? undefined
  session.pendingUserId = undefined
  session.pendingStage = undefined
  session.pendingAt = undefined
  await session.save()

  if (user.agencyId) {
    await logAudit(
      { agencyId: user.agencyId, userId: user.id, name: user.name, email: user.email },
      { action: 'login', entity: 'session', entityLabel: user.name, ip },
    )
  }
}

// ── Códigos de respaldo (hasheados con bcrypt, de un solo uso) ───────────────

export async function hashBackupCodes(codes: string[]): Promise<string> {
  const hashes = await Promise.all(codes.map(c => bcrypt.hash(normalizeBackupCode(c), 10)))
  return JSON.stringify(hashes)
}

// Si el código es válido lo CONSUME (lo borra de la lista) y devuelve true.
export async function consumeBackupCode(userId: string, stored: string | null, input: string): Promise<boolean> {
  if (!stored) return false
  let hashes: string[]
  try { hashes = JSON.parse(stored) } catch { return false }
  if (!Array.isArray(hashes) || hashes.length === 0) return false

  const candidate = normalizeBackupCode(input)
  if (!candidate) return false

  for (let i = 0; i < hashes.length; i++) {
    if (await bcrypt.compare(candidate, hashes[i])) {
      const remaining = hashes.filter((_, idx) => idx !== i)
      await prisma.user.update({ where: { id: userId }, data: { backupCodes: JSON.stringify(remaining) } })
      return true
    }
  }
  return false
}

export function countBackupCodes(stored: string | null): number {
  if (!stored) return 0
  try { const a = JSON.parse(stored); return Array.isArray(a) ? a.length : 0 } catch { return 0 }
}
