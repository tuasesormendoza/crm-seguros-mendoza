import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

type RouteContext = { params: Promise<{ id: string }> }

export async function GET(_req: NextRequest, ctx: RouteContext) {
  const { id } = await ctx.params
  const activities = await prisma.activity.findMany({
    where: { clientId: id },
    orderBy: { createdAt: 'desc' },
  })
  return NextResponse.json(activities)
}

export async function POST(request: NextRequest, ctx: RouteContext) {
  const { id } = await ctx.params
  const { type, content } = await request.json()
  const activity = await prisma.activity.create({
    data: { clientId: id, type, content },
  })
  return NextResponse.json(activity, { status: 201 })
}
