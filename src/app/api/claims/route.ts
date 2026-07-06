import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireRole, COMMISSIONS_ROLES } from '@/lib/auth'
import { logAudit } from '@/lib/audit'

// Reclamos SOLO para clientes con Washington National.
function hasWn(wnPolicies: string | null): boolean {
  return !!wnPolicies && wnPolicies.includes('"type"')
}

function parseClaim(d: Record<string, unknown>) {
  return {
    type: (d.type as string) || 'Otro',
    status: (d.status as string) || 'Reportado',
    claimNumber: (d.claimNumber as string) || null,
    serviceDate: d.serviceDate ? new Date(d.serviceDate as string) : null,
    filedDate: d.filedDate ? new Date(d.filedDate as string) : null,
    amount: d.amount != null && d.amount !== '' ? parseFloat(d.amount as string) : null,
    amountPaid: d.amountPaid != null && d.amountPaid !== '' ? parseFloat(d.amountPaid as string) : null,
    notes: (d.notes as string) || null,
  }
}

// GET /api/claims — lista los reclamos de la agencia (opcional ?clientId= y ?status=).
export async function GET(request: NextRequest) {
  const auth = await requireRole(COMMISSIONS_ROLES)
  if (auth instanceof NextResponse) return auth

  const sp = request.nextUrl.searchParams
  const clientId = sp.get('clientId') || undefined
  const status = sp.get('status') || undefined

  const claims = await prisma.claim.findMany({
    where: { agencyId: auth.agencyId, ...(clientId ? { clientId } : {}), ...(status ? { status } : {}) },
    include: { client: { select: { id: true, fullName: true } } },
    orderBy: { createdAt: 'desc' },
  })
  return NextResponse.json(claims)
}

// POST /api/claims — crea un reclamo. El cliente debe pertenecer a la agencia y
// tener póliza Washington National.
export async function POST(request: NextRequest) {
  const auth = await requireRole(COMMISSIONS_ROLES)
  if (auth instanceof NextResponse) return auth

  const data = await request.json()
  const clientId = data.clientId as string
  if (!clientId) return NextResponse.json({ error: 'Falta el cliente.' }, { status: 400 })

  const client = await prisma.client.findFirst({
    where: { id: clientId, agencyId: auth.agencyId },
    select: { fullName: true, wnPolicies: true },
  })
  if (!client) return NextResponse.json({ error: 'Cliente no encontrado.' }, { status: 404 })
  if (!hasWn(client.wnPolicies)) {
    return NextResponse.json({ error: 'Los reclamos solo aplican a clientes con póliza Washington National.' }, { status: 400 })
  }

  const claim = await prisma.claim.create({
    data: { clientId, agencyId: auth.agencyId, ...parseClaim(data) },
  })
  await logAudit(auth, { action: 'create', entity: 'claim', entityId: claim.id, entityLabel: `${client.fullName} — ${claim.type}` })
  return NextResponse.json(claim, { status: 201 })
}
