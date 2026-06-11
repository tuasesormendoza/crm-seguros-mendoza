import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getAuth } from '@/lib/auth'

export async function GET() {
  const auth = await getAuth()
  if (auth instanceof NextResponse) return auth
  const agencyId = auth.agencyId

  const goalsRow = await prisma.settings.findFirst({ where: { agencyId, key: 'productionGoals' } })
  if (!goalsRow) return NextResponse.json({ goals: null, progress: null })

  let goals
  try { goals = JSON.parse(goalsRow.value) } catch { return NextResponse.json({ goals: null, progress: null }) }

  const now = new Date()
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1)
  const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59)

  const clients = await prisma.client.findMany({
    where: { agencyId, contractDate: { gte: startOfMonth, lte: endOfMonth } },
    select: { id: true, wnPolicies: true, totalMonthly: true }
  })

  const activeClients = await prisma.client.findMany({
    where: { agencyId, status: 'Activo' },
    select: { totalMonthly: true }
  })

  const newClients = clients.length
  const wnClients = clients.filter(c => c.wnPolicies && c.wnPolicies.trim() !== '' && c.wnPolicies !== '[]').length
  const revenue = activeClients.reduce((sum, c) => sum + (c.totalMonthly || 0), 0)

  return NextResponse.json({
    goals,
    progress: { newClients, revenue: Math.round(revenue), wnClients }
  })
}
