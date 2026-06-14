import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireRole, COMMISSIONS_ROLES } from '@/lib/auth'
import { logAudit } from '@/lib/audit'

export async function DELETE(_req: NextRequest, ctx: RouteContext<'/api/commission-payments/[id]'>) {
  const auth = await requireRole(COMMISSIONS_ROLES)
  if (auth instanceof NextResponse) return auth
  const { id } = await ctx.params
  const res = await prisma.commissionPayment.deleteMany({ where: { id, agencyId: auth.agencyId } })
  if (res.count === 0) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  await logAudit(auth, { action: 'delete', entity: 'commissionPayment', entityId: id })
  return NextResponse.json({ ok: true })
}

// Permite corregir la fecha en que realmente se recibió el pago (el PDF del
// estado de cuenta no incluye esa fecha, así que al importar se usa "hoy" por
// defecto y el usuario puede ajustarla después).
export async function PATCH(request: NextRequest, ctx: RouteContext<'/api/commission-payments/[id]'>) {
  const auth = await requireRole(COMMISSIONS_ROLES)
  if (auth instanceof NextResponse) return auth
  const { id } = await ctx.params
  const body = await request.json().catch(() => ({}))
  const { receivedDate } = body as { receivedDate?: string }
  if (!receivedDate || !/^\d{4}-\d{2}-\d{2}$/.test(receivedDate)) {
    return NextResponse.json({ error: 'receivedDate inválido, debe tener formato YYYY-MM-DD' }, { status: 400 })
  }
  const existing = await prisma.commissionPayment.findFirst({ where: { id, agencyId: auth.agencyId } })
  if (!existing) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  const payment = await prisma.commissionPayment.update({
    where: { id },
    data: { receivedDate: new Date(receivedDate) },
  })
  await logAudit(auth, { action: 'update', entity: 'commissionPayment', entityId: id, entityLabel: `${payment.insurer} ${payment.period}`, metadata: { receivedDate } })
  return NextResponse.json(payment)
}
