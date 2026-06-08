import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function POST(request: NextRequest, ctx: RouteContext<'/api/clients/[id]'>) {
  const { id } = await ctx.params
  const body = await request.json().catch(() => ({}))
  const { notes } = body as { notes?: string }
  const client = await prisma.client.findUnique({ where: { id } })
  if (!client) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  const entry = await prisma.policyHistory.create({
    data: {
      clientId: id,
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
  const { id } = await ctx.params
  const history = await prisma.policyHistory.findMany({
    where: { clientId: id },
    orderBy: { year: 'desc' }
  })
  return NextResponse.json(history)
}
