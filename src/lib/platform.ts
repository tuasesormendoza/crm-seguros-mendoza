// ─────────────────────────────────────────────────────────────────────────────
// Configuración de PLATAFORMA (el "plus" del dueño del CRM).
//
// Algunas claves NO son de cada agencia: son iguales para TODAS y las controla
// únicamente el dueño del CRM (tú). Las agencias cliente las HEREDAN sin verlas
// ni poder editarlas:
//   • cmsApiKey        → datos exactos del Marketplace en la Calculadora APTC
//   • anthropicApiKey  → IA para el asistente y la Tarjeta de Plan
//   • valores FPL      → niveles de pobreza (los publica el gobierno; son iguales
//                        para todo el país y cambian una vez al año)
//
// Fuente de verdad: la agencia del DUEÑO (identificada por OWNER_EMAIL). Si el
// dueño no tiene el valor guardado, se cae a variables de entorno / defaults.
// Así el dueño edita estas claves una sola vez (en su propia Configuración) y
// todas las agencias del sistema se benefician.
// ─────────────────────────────────────────────────────────────────────────────

import { prisma } from '@/lib/prisma'

export const PLATFORM_KEYS = ['cmsApiKey', 'anthropicApiKey', 'fplYear', 'fpl1Person', 'fplPerPerson', 'aptcMaxPct'] as const
export type PlatformKey = typeof PLATFORM_KEYS[number]

// Claves de plataforma que además son SECRETAS (no deben mostrarse a nadie más
// que al dueño, ni siquiera enmascaradas revelan su valor).
export const PLATFORM_SECRET_KEYS: PlatformKey[] = ['cmsApiKey', 'anthropicApiKey']

// Respaldo a variables de entorno (para las llaves) y a defaults (para FPL)
// cuando el dueño aún no configuró el valor en su Configuración.
const ENV_FALLBACK: Partial<Record<PlatformKey, string | undefined>> = {
  cmsApiKey: process.env.CMS_API_KEY,
  anthropicApiKey: process.env.ANTHROPIC_API_KEY,
}
const DEFAULT_FALLBACK: Partial<Record<PlatformKey, string>> = {
  fplYear: '2026', fpl1Person: '15650', fplPerPerson: '5500', aptcMaxPct: '8.5',
}

// Email del dueño del CRM (opcional), en variables de entorno de Netlify.
// Es un OVERRIDE manual; si no se define, el dueño se detecta automáticamente
// (ver ownerAgencyId).
export function ownerEmail(): string {
  return (process.env.OWNER_EMAIL || '').trim().toLowerCase()
}

// agencyId del DUEÑO del CRM (para leer sus settings de plataforma). Cacheado en
// memoria del proceso: es un valor global que no cambia durante la vida del lambda.
//   1) Si hay OWNER_EMAIL, se usa la agencia de ese usuario (override explícito).
//   2) Si no, el dueño es la agencia MÁS ANTIGUA (la principal, creada antes que
//      cualquier agencia cliente). Así funciona sin configurar nada.
let cachedOwnerAgencyId: string | null | undefined
export async function ownerAgencyId(): Promise<string | null> {
  if (cachedOwnerAgencyId !== undefined) return cachedOwnerAgencyId
  const oe = ownerEmail()
  if (oe) {
    const u = await prisma.user.findUnique({ where: { email: oe }, select: { agencyId: true } }).catch(() => null)
    if (u?.agencyId) { cachedOwnerAgencyId = u.agencyId; return cachedOwnerAgencyId }
  }
  const first = await prisma.agency.findFirst({ orderBy: { createdAt: 'asc' }, select: { id: true } }).catch(() => null)
  cachedOwnerAgencyId = first?.id ?? null
  return cachedOwnerAgencyId
}

// ¿El usuario logueado pertenece a la agencia DUEÑA? Solo ella ve/edita la
// config de plataforma (CMS, Claude AI, FPL).
export async function isOwner(auth: { agencyId?: string | null }): Promise<boolean> {
  const oaid = await ownerAgencyId()
  return !!oaid && auth.agencyId === oaid
}

// Valor GLOBAL de una clave de plataforma: settings del dueño → env → default.
export async function getPlatformSetting(key: PlatformKey): Promise<string> {
  const oaid = await ownerAgencyId()
  if (oaid) {
    const row = await prisma.settings.findFirst({ where: { agencyId: oaid, key }, select: { value: true } })
    if (row?.value) return row.value
  }
  return ENV_FALLBACK[key] || DEFAULT_FALLBACK[key] || ''
}

// Varias claves de plataforma a la vez.
export async function getPlatformSettings(keys: readonly PlatformKey[]): Promise<Record<string, string>> {
  const out: Record<string, string> = {}
  await Promise.all(keys.map(async k => { out[k] = await getPlatformSetting(k) }))
  return out
}
