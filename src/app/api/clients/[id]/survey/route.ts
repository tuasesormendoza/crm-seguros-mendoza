import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getAuth } from '@/lib/auth'

type RouteContext = { params: Promise<{ id: string }> }

export async function GET(_req: NextRequest, ctx: RouteContext) {
  const auth = await getAuth()
  if (auth instanceof NextResponse) return auth
  const { id } = await ctx.params

  const responses = await prisma.surveyResponse.findMany({
    where: { clientId: id },
    orderBy: { submittedAt: 'desc' },
  })
  return NextResponse.json(responses)
}
