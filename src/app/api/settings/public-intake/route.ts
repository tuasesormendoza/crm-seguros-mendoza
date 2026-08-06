import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireAdmin } from '@/lib/auth'
import { generateIntakeKey } from '@/lib/publicIntake'

// ─────────────────────────────────────────────────────────────────────────────
// Configuración de la entrada pública de leads (por agencia).
// Solo administradores. Aquí el agente genera su clave, indica desde qué
// dominios acepta leads y enciende o apaga la entrada.
// ─────────────────────────────────────────────────────────────────────────────

export async function GET() {
  const auth = await requireAdmin()
  if (auth instanceof NextResponse) return auth

  const agency = await prisma.agency.findUnique({
    where: { id: auth.agencyId },
    select: { publicIntakeKey: true, publicIntakeOrigins: true, publicIntakeEnabled: true },
  })

  return NextResponse.json({
    key: agency?.publicIntakeKey ?? null,
    origins: agency?.publicIntakeOrigins ?? '',
    enabled: agency?.publicIntakeEnabled ?? false,
  })
}

export async function POST(request: NextRequest) {
  const auth = await requireAdmin()
  if (auth instanceof NextResponse) return auth

  const body = await request.json() as {
    enabled?: boolean
    origins?: string
    regenerate?: boolean
  }

  const data: {
    publicIntakeEnabled?: boolean
    publicIntakeOrigins?: string | null
    publicIntakeKey?: string
  } = {}

  if (typeof body.enabled === 'boolean') data.publicIntakeEnabled = body.enabled

  if (typeof body.origins === 'string') {
    // Se guardan solo los hosts, en minúsculas y sin protocolo ni rutas.
    const limpio = body.origins
      .split(',')
      .map(o => o.trim().toLowerCase().replace(/^https?:\/\//, '').replace(/\/.*$/, ''))
      .filter(Boolean)
      .slice(0, 10)
      .join(',')
    data.publicIntakeOrigins = limpio || null
  }

  // Se genera la clave la primera vez, o cuando el agente pide rotarla.
  const actual = await prisma.agency.findUnique({
    where: { id: auth.agencyId },
    select: { publicIntakeKey: true },
  })
  if (body.regenerate || !actual?.publicIntakeKey) {
    data.publicIntakeKey = generateIntakeKey()
  }

  const agency = await prisma.agency.update({
    where: { id: auth.agencyId },
    data,
    select: { publicIntakeKey: true, publicIntakeOrigins: true, publicIntakeEnabled: true },
  })

  return NextResponse.json({
    key: agency.publicIntakeKey,
    origins: agency.publicIntakeOrigins ?? '',
    enabled: agency.publicIntakeEnabled,
  })
}
