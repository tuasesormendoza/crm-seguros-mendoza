import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function GET() {
  const goalsRow = await prisma.settings.findUnique({ where: { key: 'productionGoals' } })
  if (!goalsRow) return NextResponse.json({ goals: null, progress: null })

  let goals
  try { goals = JSON.parse(goalsRow.value) } catch { return NextResponse.json({ goals: null, progress: null }) }

  const now = new Date()
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1)
  const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59)

  const clients = await prisma.client.findMany({
    where: { contractDate: { gte: startOfMonth, lte: endOfMonth } },
    select: { id: true, wnPolicies: true, totalMonthly: true }
  })

  const activeClients = await prisma.client.findMany({
    where: { status: 'Activo' },
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
