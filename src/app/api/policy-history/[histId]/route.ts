import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function DELETE(_req: NextRequest, ctx: RouteContext<'/api/policy-history/[histId]'>) {
  const { histId } = await ctx.params
  await prisma.policyHistory.delete({ where: { id: histId } })
  return NextResponse.json({ ok: true })
}
