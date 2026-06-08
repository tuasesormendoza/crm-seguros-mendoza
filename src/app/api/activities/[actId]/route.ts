import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

type RouteContext = { params: Promise<{ actId: string }> }

export async function DELETE(_req: NextRequest, ctx: RouteContext) {
  const { actId } = await ctx.params
  await prisma.activity.delete({ where: { id: actId } })
  return NextResponse.json({ success: true })
}
