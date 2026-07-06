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

// Email del dueño del CRM, en variables de entorno de Netlify (OWNER_EMAIL).
export function ownerEmail(): string {
  return (process.env.OWNER_EMAIL || '').trim().toLowerCase()
}

// ¿El usuario logueado es el dueño del CRM? Solo él ve/edita la config de plataforma.
export function isOwner(auth: { email?: string | null }): boolean {
  const oe = ownerEmail()
  return !!oe && (auth.email || '').trim().toLowerCase() === oe
}

// agencyId del dueño (para leer sus settings de plataforma). Cacheado en memoria
// del proceso: es un valor global que no cambia durante la vida del lambda.
let cachedOwnerAgencyId: string | null | undefined
export async function ownerAgencyId(): Promise<string | null> {
  if (cachedOwnerAgencyId !== undefined) return cachedOwnerAgencyId
  const oe = ownerEmail()
  if (!oe) { cachedOwnerAgencyId = null; return null }
  const u = await prisma.user.findUnique({ where: { email: oe }, select: { agencyId: true } }).catch(() => null)
  cachedOwnerAgencyId = u?.agencyId ?? null
  return cachedOwnerAgencyId
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
