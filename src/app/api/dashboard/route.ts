import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function GET() {
  const clients = await prisma.client.findMany({ include: { dependents: true } })

  const active = clients.filter(c => c.status === 'Activo').length
  const cancelled = clients.filter(c => c.status === 'Cancelado').length
  const pendingPayment = clients.filter(c => c.status === 'Pendiente de Pago').length

  const totalLives = clients.reduce((acc, c) => acc + (c.affiliatesCount || 1), 0)

  const byInsurer: Record<string, number> = {}
  clients.forEach(c => {
    if (c.insurer) {
      byInsurer[c.insurer] = (byInsurer[c.insurer] || 0) + (c.affiliatesCount || 1)
    }
  })

  const byState: Record<string, number> = {}
  clients.forEach(c => {
    if (c.state) byState[c.state] = (byState[c.state] || 0) + 1
  })

  const byCoverage: Record<string, number> = {}
  clients.forEach(c => {
    if (c.coverageType) byCoverage[c.coverageType] = (byCoverage[c.coverageType] || 0) + 1
  })

  const today = new Date()
  const in60 = new Date(today)
  in60.setDate(today.getDate() + 60)
  const upcomingRenewals = clients
    .filter(c => c.renewalDate && new Date(c.renewalDate) >= today && new Date(c.renewalDate) <= in60)
    .sort((a, b) => new Date(a.renewalDate!).getTime() - new Date(b.renewalDate!).getTime())
    .map(c => ({
      id: c.id,
      fullName: c.fullName,
      renewalDate: c.renewalDate,
      insurer: c.insurer,
      daysUntil: Math.ceil((new Date(c.renewalDate!).getTime() - today.getTime()) / (1000 * 60 * 60 * 24))
    }))

  const upcomingBirthdays: { id: string; name: string; birthDate: Date; daysUntil: number; type: string; phone: string | null }[] = []

  clients.forEach(c => {
    if (c.birthDate) {
      const birth = new Date(c.birthDate)
      const nextBirthday = new Date(today.getFullYear(), birth.getUTCMonth(), birth.getUTCDate())
      if (nextBirthday < today) nextBirthday.setFullYear(today.getFullYear() + 1)
      const daysUntil = Math.ceil((nextBirthday.getTime() - today.getTime()) / (1000 * 60 * 60 * 24))
      if (daysUntil <= 30) {
        upcomingBirthdays.push({ id: c.id, name: c.fullName, birthDate: c.birthDate, daysUntil, type: 'cliente', phone: c.phone })
      }
    }
  })

  // Birthdays only for main policy holder (not dependents)

  upcomingBirthdays.sort((a, b) => a.daysUntil - b.daysUntil)

  const sixtyDaysAgo = new Date()
  sixtyDaysAgo.setDate(sixtyDaysAgo.getDate() - 60)
  const thirtyDaysAgo = new Date()
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30)
  const unpaidFirstPremium = clients.filter(c =>
    c.contractDate &&
    new Date(c.contractDate) >= thirtyDaysAgo &&
    c.firstPaymentPaid !== true
  ).map(c => ({
    id: c.id,
    fullName: c.fullName,
    contractDate: c.contractDate,
    daysLeft: 30 - Math.floor((today.getTime() - new Date(c.contractDate!).getTime()) / (1000*60*60*24)),
    firstPaymentPaid: c.firstPaymentPaid,
  }))

  const pendingFirstPayment = clients.filter(c =>
    c.contractDate &&
    new Date(c.contractDate) >= sixtyDaysAgo &&
    c.firstPaymentPaid !== true
  ).map(c => ({
    id: c.id,
    fullName: c.fullName,
    contractDate: c.contractDate,
    insurer: c.insurer,
    daysElapsed: Math.floor((today.getTime() - new Date(c.contractDate!).getTime()) / (1000*60*60*24)),
  }))

  const withWN = clients.filter(c => {
    if (!c.wnPolicies) return false
    try { const p = JSON.parse(c.wnPolicies); return Array.isArray(p) && p.some((x: {type: string; monthly: string}) => x.type) } catch { return false }
  }).length
  const REVIEW_STAGES = ['Pendiente por enviar', 'Enviada', 'Esperando por el cliente', 'Realizada']
  const reviewByStage = REVIEW_STAGES.map(stage => ({
    stage,
    count: clients.filter(c => (c.googleReview || 'Pendiente por enviar') === stage).length,
    clients: clients
      .filter(c => (c.googleReview || 'Pendiente por enviar') === stage)
      .map(c => ({ id: c.id, fullName: c.fullName, phone: c.phone })),
  }))
  const reviewsSent = clients.filter(c => c.googleReview === 'Enviada').length
  const reviewsPending = clients.filter(c => !c.googleReview || c.googleReview === 'Pendiente por enviar').length

  // New clients this month (by contractDate)
  const monthStart = new Date(today.getFullYear(), today.getMonth(), 1)
  const monthEnd   = new Date(today.getFullYear(), today.getMonth() + 1, 0, 23, 59, 59)
  const newClientsThisMonth = clients
    .filter(c => c.contractDate && new Date(c.contractDate) >= monthStart && new Date(c.contractDate) <= monthEnd)
    .sort((a, b) => new Date(b.contractDate!).getTime() - new Date(a.contractDate!).getTime())
    .map(c => ({
      id: c.id,
      fullName: c.fullName,
      insurer: c.insurer,
      planCategory: c.planCategory,
      totalMonthly: c.totalMonthly,
      contractDate: c.contractDate,
      status: c.status,
    }))

  return NextResponse.json({
    totalPolicies: clients.length,
    activeClients: active,
    cancelledClients: cancelled,
    pendingPayment,
    totalLives,
    withWN,
    byInsurer,
    byState,
    byCoverage,
    upcomingRenewals,
    upcomingBirthdays,
    reviewsSent,
    reviewsPending,
    reviewByStage,
    unpaidFirstPremium,
    pendingFirstPayment,
    totalMonthly: clients.reduce((sum, c) => sum + (c.totalMonthly || 0), 0),
    newClientsThisMonth,
  })
}
