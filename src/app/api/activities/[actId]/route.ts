import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getAuth } from '@/lib/auth'

type RouteContext = { params: Promise<{ actId: string }> }

export async function DELETE(_req: NextRequest, ctx: RouteContext) {
  const auth = await getAuth()
  if (auth instanceof NextResponse) return auth
  const { actId } = await ctx.params
  const res = await prisma.activity.deleteMany({ where: { id: actId, agencyId: auth.agencyId } })
  if (res.count === 0) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  return NextResponse.json({ success: true })
}
