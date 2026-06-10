import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { THEME_DEFAULTS } from '@/lib/utils'

const THEME_KEYS = Object.keys(THEME_DEFAULTS) as (keyof typeof THEME_DEFAULTS)[]

// Public, read-only endpoint — only exposes the 4 brand colors (no sensitive
// data) so the login page (unauthenticated) can also apply the custom theme.
export async function GET() {
  const rows = await prisma.settings.findMany({ where: { key: { in: THEME_KEYS } } })
  const map: Record<string, string> = { ...THEME_DEFAULTS }
  rows.forEach(r => {
    if (r.value && /^#[0-9a-fA-F]{6}$/.test(r.value)) map[r.key] = r.value
  })
  return NextResponse.json(map)
}
