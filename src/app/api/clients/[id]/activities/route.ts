import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getAuth, clientInAgency } from '@/lib/auth'

type RouteContext = { params: Promise<{ id: string }> }

export async function GET(_req: NextRequest, ctx: RouteContext) {
  const auth = await getAuth()
  if (auth instanceof NextResponse) return auth
  const { id } = await ctx.params
  const activities = await prisma.activity.findMany({
    where: { clientId: id, agencyId: auth.agencyId },
    orderBy: { createdAt: 'desc' },
  })
  return NextResponse.json(activities)
}

export async function POST(request: NextRequest, ctx: RouteContext) {
  const auth = await getAuth()
  if (auth instanceof NextResponse) return auth
  const { id } = await ctx.params
  if (!(await clientInAgency(id, auth.agencyId))) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  const { type, content } = await request.json()
  const activity = await prisma.activity.create({
    data: { clientId: id, agencyId: auth.agencyId, type, content },
  })
  return NextResponse.json(activity, { status: 201 })
}
