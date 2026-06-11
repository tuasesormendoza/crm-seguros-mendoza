import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getSession } from '@/lib/session'
import { THEME_DEFAULTS } from '@/lib/utils'

const THEME_KEYS = Object.keys(THEME_DEFAULTS) as (keyof typeof THEME_DEFAULTS)[]

// Read-only endpoint — solo expone los 4 colores de marca (no datos sensibles).
// Multi-tenant: si hay sesión con agencia, devuelve el tema de ESA agencia; si
// no (ej. la página de login antes de autenticar), devuelve los colores por
// defecto. Así cada agencia tiene su propia marca dentro de la app sin filtrar
// la de otra.
export async function GET() {
  const session = await getSession().catch(() => null)
  const agencyId = session?.isLoggedIn ? session.agencyId : undefined

  const map: Record<string, string> = { ...THEME_DEFAULTS }
  if (agencyId) {
    const rows = await prisma.settings.findMany({ where: { agencyId, key: { in: THEME_KEYS } } })
    rows.forEach(r => {
      if (r.value && /^#[0-9a-fA-F]{6}$/.test(r.value)) map[r.key] = r.value
    })
  }
  return NextResponse.json(map)
}
