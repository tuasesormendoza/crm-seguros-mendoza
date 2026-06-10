import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function DELETE(_req: NextRequest, ctx: RouteContext<'/api/commission-payments/[id]'>) {
  const { id } = await ctx.params
  await prisma.commissionPayment.delete({ where: { id } })
  return NextResponse.json({ ok: true })
}
