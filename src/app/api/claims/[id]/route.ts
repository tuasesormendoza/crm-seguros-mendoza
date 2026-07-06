import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireRole, COMMISSIONS_ROLES } from '@/lib/auth'
import { logAudit } from '@/lib/audit'

type RouteContext = { params: Promise<{ id: string }> }

function parseClaimUpdate(d: Record<string, unknown>) {
  const out: Record<string, unknown> = {}
  if ('type' in d) out.type = d.type
  if ('status' in d) out.status = d.status
  if ('claimNumber' in d) out.claimNumber = (d.claimNumber as string) || null
  if ('serviceDate' in d) out.serviceDate = d.serviceDate ? new Date(d.serviceDate as string) : null
  if ('filedDate' in d) out.filedDate = d.filedDate ? new Date(d.filedDate as string) : null
  if ('amount' in d) out.amount = d.amount != null && d.amount !== '' ? parseFloat(d.amount as string) : null
  if ('amountPaid' in d) out.amountPaid = d.amountPaid != null && d.amountPaid !== '' ? parseFloat(d.amountPaid as string) : null
  if ('notes' in d) out.notes = (d.notes as string) || null
  return out
}

// PATCH /api/claims/[id] — actualiza estatus u otros campos del reclamo.
export async function PATCH(request: NextRequest, ctx: RouteContext) {
  const auth = await requireRole(COMMISSIONS_ROLES)
  if (auth instanceof NextResponse) return auth
  const { id } = await ctx.params

  const res = await prisma.claim.updateMany({
    where: { id, agencyId: auth.agencyId },
    data: parseClaimUpdate(await request.json()),
  })
  if (res.count === 0) return NextResponse.json({ error: 'Reclamo no encontrado.' }, { status: 404 })

  const claim = await prisma.claim.findFirst({
    where: { id, agencyId: auth.agencyId },
    include: { client: { select: { id: true, fullName: true } } },
  })
  await logAudit(auth, { action: 'update', entity: 'claim', entityId: id, entityLabel: claim?.client.fullName })
  return NextResponse.json(claim)
}

// DELETE /api/claims/[id]
export async function DELETE(_req: NextRequest, ctx: RouteContext) {
  const auth = await requireRole(COMMISSIONS_ROLES)
  if (auth instanceof NextResponse) return auth
  const { id } = await ctx.params
  const res = await prisma.claim.deleteMany({ where: { id, agencyId: auth.agencyId } })
  if (res.count === 0) return NextResponse.json({ error: 'Reclamo no encontrado.' }, { status: 404 })
  await logAudit(auth, { action: 'delete', entity: 'claim', entityId: id })
  return NextResponse.json({ ok: true })
}
