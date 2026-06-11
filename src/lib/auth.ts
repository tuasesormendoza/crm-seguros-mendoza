import { NextResponse } from 'next/server'
import { getSession } from '@/lib/session'
import { prisma } from '@/lib/prisma'

// ─────────────────────────────────────────────────────────────────────────────
// Autenticación + aislamiento por agencia (multi-tenant), del lado del SERVIDOR.
//
// Toda ruta API protegida debe empezar con:
//
//   const auth = await getAuth()
//   if (auth instanceof NextResponse) return auth
//   // ...usar auth.agencyId en CADA consulta a la base de datos...
//
// `auth.agencyId` es el inquilino del usuario logueado. NUNCA se debe consultar
// ni escribir un registro sin filtrarlo/asignarlo a este agencyId, de lo
// contrario una agencia podría ver o modificar datos de otra.
//
// El control de ROL también vive aquí (no solo en el navegador): el rol
// "assistant" no puede acceder a comisiones ni reportes, etc.
// ─────────────────────────────────────────────────────────────────────────────

export type AuthContext = {
  userId?: string
  email?: string
  name?: string
  role: string        // 'admin' | 'agent' | 'assistant'
  agencyId: string    // SIEMPRE presente cuando getAuth tiene éxito
}

export type AuthResult = AuthContext | NextResponse

/**
 * Exige sesión válida + agencia asignada. Devuelve el contexto de auth, o un
 * NextResponse de error (401/403) que la ruta debe retornar inmediatamente.
 */
export async function getAuth(): Promise<AuthResult> {
  const session = await getSession()
  if (!session.isLoggedIn) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
  }
  if (!session.agencyId) {
    // Fail-closed: sin agencia no se puede aislar — se niega el acceso a datos.
    return NextResponse.json(
      { error: 'Tu cuenta no tiene una agencia asignada. Contacta al administrador.' },
      { status: 403 }
    )
  }
  return {
    userId: session.userId,
    email: session.email,
    name: session.name,
    role: session.role || 'agent',
    agencyId: session.agencyId,
  }
}

/**
 * Como getAuth, pero además exige que el rol esté dentro de `roles`.
 * Ej: requireRole(['admin', 'agent']) bloquea a 'assistant'.
 */
export async function requireRole(roles: string[]): Promise<AuthResult> {
  const auth = await getAuth()
  if (auth instanceof NextResponse) return auth
  if (!roles.includes(auth.role)) {
    return NextResponse.json(
      { error: 'No tienes permiso para acceder a esta sección.' },
      { status: 403 }
    )
  }
  return auth
}

/** Atajo: solo administradores. */
export function requireAdmin(): Promise<AuthResult> {
  return requireRole(['admin'])
}

/** Roles que SÍ pueden ver comisiones y reportes (assistant queda excluido). */
export const COMMISSIONS_ROLES = ['admin', 'agent']

/**
 * Verifica que un cliente exista Y pertenezca a la agencia indicada. Se usa en
 * las rutas hijas (citas, actividades, documentos, historial…) para impedir que
 * una agencia cree/lea/modifique sub-registros bajo un cliente de otra agencia.
 */
export async function clientInAgency(clientId: string, agencyId: string): Promise<boolean> {
  const found = await prisma.client.findFirst({ where: { id: clientId, agencyId }, select: { id: true } })
  return !!found
}
