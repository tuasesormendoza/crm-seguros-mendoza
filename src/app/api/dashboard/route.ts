import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getAuth } from '@/lib/auth'
import { losesSubsidyWhere } from '@/lib/subsidyEligibility'

export async function GET() {
  const auth = await getAuth()
  if (auth instanceof NextResponse) return auth
  const agencyId = auth.agencyId

  const today = new Date()
  const in60 = new Date(today); in60.setDate(today.getDate() + 60)
  const thirtyDaysAgo = new Date(today); thirtyDaysAgo.setDate(today.getDate() - 30)
  const sixtyDaysAgo = new Date(today); sixtyDaysAgo.setDate(today.getDate() - 60)
  const monthStart = new Date(today.getFullYear(), today.getMonth(), 1)
  const monthEnd   = new Date(today.getFullYear(), today.getMonth() + 1, 0, 23, 59, 59)

  // Run all queries in parallel — no serial waterfall, no loading all fields
  const [
    totalPolicies,
    activeClients,
    cancelledClients,
    pendingPayment,
    livesAgg,
    livesNullCount,
    byInsurerGroups,
    byStateGroups,
    byCoverageGroups,
    upcomingRenewals,
    birthdayClients,
    unpaidFirstPremium,
    pendingFirstPayment,
    wnClients,
    reviewClients,
    newClientsThisMonth,
    totalMonthlyAgg,
  ] = await Promise.all([
    // Counts by status
    prisma.client.count({ where: { agencyId } }),
    prisma.client.count({ where: { agencyId, status: 'Activo' } }),
    prisma.client.count({ where: { agencyId, status: 'Cancelado' } }),
    prisma.client.count({ where: { agencyId, status: 'Pendiente de Pago' } }),

    // Total lives — sum of affiliatesCount (excludes nulls)
    prisma.client.aggregate({ _sum: { affiliatesCount: true }, where: { agencyId } }),
    // How many rows have null affiliatesCount (each counts as 1 life)
    prisma.client.count({ where: { agencyId, affiliatesCount: null } }),

    // By insurer — need _count.affiliatesCount to handle nulls
    prisma.client.groupBy({
      by: ['insurer'],
      _sum: { affiliatesCount: true },
      _count: { affiliatesCount: true, _all: true },
      where: { agencyId, insurer: { not: null } },
    }),

    // By state and coverage type
    prisma.client.groupBy({ by: ['state'], _count: { _all: true }, where: { agencyId, state: { not: null } } }),
    prisma.client.groupBy({ by: ['coverageType'], _count: { _all: true }, where: { agencyId, coverageType: { not: null } } }),

    // Upcoming renewals — only needed fields, already filtered in DB
    prisma.client.findMany({
      where: { agencyId, renewalDate: { gte: today, lte: in60 } },
      select: { id: true, fullName: true, renewalDate: true, insurer: true },
      orderBy: { renewalDate: 'asc' },
    }),

    // Birthdays — only needed fields; year-wrap logic done in JS
    prisma.client.findMany({
      where: { agencyId, birthDate: { not: null } },
      select: { id: true, fullName: true, birthDate: true, phone: true },
    }),

    // Unpaid first premium (last 30 days)
    prisma.client.findMany({
      where: { agencyId, contractDate: { gte: thirtyDaysAgo }, firstPaymentPaid: { not: true } },
      select: { id: true, fullName: true, contractDate: true, firstPaymentPaid: true },
    }),

    // Pending first payment (last 60 days)
    prisma.client.findMany({
      where: { agencyId, contractDate: { gte: sixtyDaysAgo }, firstPaymentPaid: { not: true } },
      select: { id: true, fullName: true, contractDate: true, insurer: true },
    }),

    // WN policies — only the JSON field
    prisma.client.findMany({
      where: { agencyId, wnPolicies: { not: null } },
      select: { wnPolicies: true },
    }),

    // Google review stage — only needed fields
    prisma.client.findMany({
      where: { agencyId },
      select: { id: true, fullName: true, phone: true, googleReview: true },
    }),

    // New clients this month
    prisma.client.findMany({
      where: { agencyId, contractDate: { gte: monthStart, lte: monthEnd } },
      select: { id: true, fullName: true, insurer: true, planCategory: true, totalMonthly: true, contractDate: true, status: true },
      orderBy: { contractDate: 'desc' },
    }),

    // Total monthly revenue
    prisma.client.aggregate({ _sum: { totalMonthly: true }, where: { agencyId } }),
  ])

  // --- Post-processing ---

  // Total lives: nulls count as 1
  const totalLives = (livesAgg._sum.affiliatesCount || 0) + livesNullCount

  // By insurer — handle affiliatesCount nulls (null → 1)
  const byInsurer: Record<string, number> = {}
  byInsurerGroups.forEach(r => {
    if (r.insurer) {
      const nullCount = r._count._all - r._count.affiliatesCount
      byInsurer[r.insurer] = (r._sum.affiliatesCount || 0) + nullCount
    }
  })

  // By state
  const byState: Record<string, number> = {}
  byStateGroups.forEach(r => { if (r.state) byState[r.state] = r._count._all })

  // By coverage type
  const byCoverage: Record<string, number> = {}
  byCoverageGroups.forEach(r => { if (r.coverageType) byCoverage[r.coverageType] = r._count._all })

  // Upcoming renewals with daysUntil
  const renewals = upcomingRenewals.map(c => ({
    ...c,
    daysUntil: Math.ceil((new Date(c.renewalDate!).getTime() - today.getTime()) / (1000 * 60 * 60 * 24)),
  }))

  // Upcoming birthdays (next 30 days, wrapping across year-end)
  const upcomingBirthdays: { id: string; name: string; birthDate: Date; daysUntil: number; type: string; phone: string | null }[] = []
  birthdayClients.forEach(c => {
    if (!c.birthDate) return
    const birth = new Date(c.birthDate)
    const nextBirthday = new Date(today.getFullYear(), birth.getUTCMonth(), birth.getUTCDate())
    if (nextBirthday < today) nextBirthday.setFullYear(today.getFullYear() + 1)
    const daysUntil = Math.ceil((nextBirthday.getTime() - today.getTime()) / (1000 * 60 * 60 * 24))
    if (daysUntil <= 30) {
      upcomingBirthdays.push({ id: c.id, name: c.fullName, birthDate: c.birthDate, daysUntil, type: 'cliente', phone: c.phone })
    }
  })
  upcomingBirthdays.sort((a, b) => a.daysUntil - b.daysUntil)

  // WN policy count
  const withWN = wnClients.filter(c => {
    if (!c.wnPolicies) return false
    try { const p = JSON.parse(c.wnPolicies); return Array.isArray(p) && p.some((x: { type: string }) => x.type) } catch { return false }
  }).length

  // Google review stages
  const REVIEW_STAGES = ['Pendiente por enviar', 'Enviada', 'Esperando por el cliente', 'Realizada']
  const reviewByStage = REVIEW_STAGES.map(stage => ({
    stage,
    count: reviewClients.filter(c => (c.googleReview || 'Pendiente por enviar') === stage).length,
    clients: reviewClients
      .filter(c => (c.googleReview || 'Pendiente por enviar') === stage)
      .map(c => ({ id: c.id, fullName: c.fullName, phone: c.phone })),
  }))
  const reviewsSent = reviewClients.filter(c => c.googleReview === 'Enviada').length
  const reviewsPending = reviewClients.filter(c => !c.googleReview || c.googleReview === 'Pendiente por enviar').length

  // Unpaid / pending first payment with computed days
  const unpaid = unpaidFirstPremium.map(c => ({
    id: c.id,
    fullName: c.fullName,
    contractDate: c.contractDate,
    daysLeft: 30 - Math.floor((today.getTime() - new Date(c.contractDate!).getTime()) / (1000 * 60 * 60 * 24)),
    firstPaymentPaid: c.firstPaymentPaid,
  }))
  const pending = pendingFirstPayment.map(c => ({
    id: c.id,
    fullName: c.fullName,
    contractDate: c.contractDate,
    insurer: c.insurer,
    daysElapsed: Math.floor((today.getTime() - new Date(c.contractDate!).getTime()) / (1000 * 60 * 60 * 24)),
  }))

  // Clientes activos afectados por la regla del 01/01/2027 (pierden el crédito
  // fiscal por su estatus migratorio) y los que aún no tienen el dato.
  const [losesSubsidyCount, missingMigrationCount] = await Promise.all([
    prisma.client.count({ where: losesSubsidyWhere(auth.agencyId) }),
    prisma.client.count({
      where: { agencyId: auth.agencyId, status: 'Activo', OR: [{ migrationStatus: null }, { migrationStatus: '' }] },
    }),
  ])

  return NextResponse.json({
    losesSubsidyCount,
    missingMigrationCount,
    totalPolicies,
    activeClients,
    cancelledClients,
    pendingPayment,
    totalLives,
    withWN,
    byInsurer,
    byState,
    byCoverage,
    upcomingRenewals: renewals,
    upcomingBirthdays,
    reviewsSent,
    reviewsPending,
    reviewByStage,
    unpaidFirstPremium: unpaid,
    pendingFirstPayment: pending,
    totalMonthly: totalMonthlyAgg._sum.totalMonthly || 0,
    newClientsThisMonth,
  })
}
