import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireRole, clientInAgency, COMMISSIONS_ROLES } from '@/lib/auth'

export async function GET(request: NextRequest) {
  const auth = await requireRole(COMMISSIONS_ROLES)
  if (auth instanceof NextResponse) return auth
  const { searchParams } = new URL(request.url)
  const period = searchParams.get('period') || new Date().toISOString().slice(0, 7)
  const checks = await prisma.commissionCheck.findMany({ where: { period, agencyId: auth.agencyId } })
  return NextResponse.json(checks)
}

export async function POST(request: NextRequest) {
  const auth = await requireRole(COMMISSIONS_ROLES)
  if (auth instanceof NextResponse) return auth
  const { clientId, period, received } = await request.json()
  if (!clientId || !period) {
    return NextResponse.json({ error: 'clientId y period son requeridos' }, { status: 400 })
  }
  if (!(await clientInAgency(clientId, auth.agencyId))) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 })
  }
  const check = await prisma.commissionCheck.upsert({
    where: { clientId_period: { clientId, period } },
    update: { received: !!received },
    create: { clientId, period, received: !!received, agencyId: auth.agencyId },
  })
  return NextResponse.json(check)
}
