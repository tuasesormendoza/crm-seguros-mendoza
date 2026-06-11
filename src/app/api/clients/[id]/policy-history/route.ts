import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getAuth } from '@/lib/auth'

export async function POST(request: NextRequest, ctx: RouteContext<'/api/clients/[id]'>) {
  const auth = await getAuth()
  if (auth instanceof NextResponse) return auth
  const { id } = await ctx.params
  const body = await request.json().catch(() => ({}))
  const { notes } = body as { notes?: string }
  const client = await prisma.client.findFirst({ where: { id, agencyId: auth.agencyId } })
  if (!client) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  const entry = await prisma.policyHistory.create({
    data: {
      clientId: id,
      agencyId: auth.agencyId,
      year: client.policyYear || new Date().getFullYear(),
      insurer: client.insurer,
      planName: client.planName,
      planCategory: client.planCategory,
      acaPrice: client.acaPrice,
      totalMonthly: client.totalMonthly,
      wnPolicies: client.wnPolicies,
      notes: notes || null,
    }
  })
  return NextResponse.json(entry, { status: 201 })
}

export async function GET(_req: NextRequest, ctx: RouteContext<'/api/clients/[id]'>) {
  const auth = await getAuth()
  if (auth instanceof NextResponse) return auth
  const { id } = await ctx.params
  const history = await prisma.policyHistory.findMany({
    where: { clientId: id, agencyId: auth.agencyId },
    orderBy: { year: 'desc' }
  })
  return NextResponse.json(history)
}
