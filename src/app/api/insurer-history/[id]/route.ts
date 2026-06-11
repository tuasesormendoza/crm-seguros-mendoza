import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function DELETE(_req: NextRequest, ctx: RouteContext<'/api/insurer-history/[id]'>) {
  const { id } = await ctx.params
  await prisma.insurerHistory.delete({ where: { id } })
  return NextResponse.json({ ok: true })
}
