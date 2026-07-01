import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { decryptClientFields } from '@/lib/encrypt'
import { getAuth } from '@/lib/auth'

type RouteContext = { params: Promise<{ id: string }> }

// Consolidated read endpoint for the client profile page. Instead of the browser
// firing 5 separate requests (each a distinct serverless invocation with its own
// cold-start + DB round-trip), this runs every query in parallel inside ONE
// invocation over ONE Neon connection, then returns the whole payload at once.
export async function GET(_req: NextRequest, ctx: RouteContext) {
  const auth = await getAuth()
  if (auth instanceof NextResponse) return auth
  const { id } = await ctx.params
  const agencyId = auth.agencyId

  const [client, activities, policyHistory, insurerHistory, surveyResponses] = await Promise.all([
    prisma.client.findFirst({
      where: { id, agencyId },
      include: { dependents: true, appointments: { orderBy: { date: 'asc' } } },
    }),
    prisma.activity.findMany({
      where: { clientId: id, agencyId },
      orderBy: { createdAt: 'desc' },
    }),
    prisma.policyHistory.findMany({
      where: { clientId: id, agencyId },
      orderBy: { year: 'desc' },
    }),
    prisma.insurerHistory.findMany({
      where: { clientId: id, agencyId },
      orderBy: { startDate: 'asc' },
    }),
    prisma.surveyResponse.findMany({
      where: { clientId: id },
      orderBy: { submittedAt: 'desc' },
    }),
  ])

  if (!client) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  return NextResponse.json({
    client: decryptClientFields(client),
    activities,
    policyHistory,
    insurerHistory,
    surveyResponses,
  })
}
