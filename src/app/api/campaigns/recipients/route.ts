import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getAuth } from '@/lib/auth'
import { buildSegmentWhere } from '@/lib/campaignFilters'

// GET /api/campaigns/recipients — calcula el segmento de clientes según filtros.
// Filtros: status, insurer, state, tag, wn (con|sin), missing (dental|wn).
// Devuelve conteos (total, con email, con teléfono) y la lista mínima.
export async function GET(request: NextRequest) {
  const auth = await getAuth()
  if (auth instanceof NextResponse) return auth

  const sp = request.nextUrl.searchParams
  const where = buildSegmentWhere(auth.agencyId, {
    status: sp.get('status') || undefined,
    insurer: sp.get('insurer') || undefined,
    state: sp.get('state') || undefined,
    tag: sp.get('tag') || undefined,
    wn: sp.get('wn') || undefined,
    missing: sp.get('missing') || undefined,
  })

  const clients = await prisma.client.findMany({
    where,
    select: { id: true, fullName: true, email: true, phone: true },
    orderBy: { fullName: 'asc' },
  })

  return NextResponse.json({
    total: clients.length,
    withEmail: clients.filter(c => c.email && c.email.trim()).length,
    withPhone: clients.filter(c => c.phone && c.phone.trim()).length,
    recipients: clients,
  })
}
