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
