import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const period = searchParams.get('period') || new Date().toISOString().slice(0, 7)
  const checks = await prisma.commissionCheck.findMany({ where: { period } })
  return NextResponse.json(checks)
}

export async function POST(request: NextRequest) {
  const { clientId, period, received } = await request.json()
  if (!clientId || !period) {
    return NextResponse.json({ error: 'clientId y period son requeridos' }, { status: 400 })
  }
  const check = await prisma.commissionCheck.upsert({
    where: { clientId_period: { clientId, period } },
    update: { received: !!received },
    create: { clientId, period, received: !!received },
  })
  return NextResponse.json(check)
}
