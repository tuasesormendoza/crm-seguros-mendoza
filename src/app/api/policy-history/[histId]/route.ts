import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getAuth } from '@/lib/auth'

export async function DELETE(_req: NextRequest, ctx: RouteContext<'/api/policy-history/[histId]'>) {
  const auth = await getAuth()
  if (auth instanceof NextResponse) return auth
  const { histId } = await ctx.params
  const res = await prisma.policyHistory.deleteMany({ where: { id: histId, agencyId: auth.agencyId } })
  if (res.count === 0) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  return NextResponse.json({ ok: true })
}
