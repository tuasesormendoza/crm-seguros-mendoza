import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function GET() {
  const now = new Date()
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  const todayEnd = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1)
  const in7 = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 7)
  const thirtyDaysAgo = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 30)

  // Today's appointments
  const todayAppointments = await prisma.appointment.findMany({
    where: { date: { gte: todayStart, lt: todayEnd } },
    include: { client: { select: { id: true, fullName: true } } },
    orderBy: { date: 'asc' },
  })

  // Urgent renewals: renewalDate within next 7 days
  const urgentRenewals = await prisma.client.findMany({
    where: { renewalDate: { gte: now, lte: in7 } },
    select: { id: true, fullName: true, insurer: true, renewalDate: true },
    orderBy: { renewalDate: 'asc' },
  })

  // Clients with birthday in next 7 days
  const allClients = await prisma.client.findMany({
    select: { id: true, fullName: true, birthDate: true, contractDate: true, firstPaymentPaid: true, tags: true, phone: true },
  })

  const weekBirthdays: { id: string; fullName: string; birthDate: string; age: number; daysUntil: number; phone: string | null }[] = []
  allClients.forEach(c => {
    if (!c.birthDate) return
    const birth = new Date(c.birthDate)
    const nextBday = new Date(now.getFullYear(), birth.getUTCMonth(), birth.getUTCDate())
    if (nextBday < todayStart) nextBday.setFullYear(now.getFullYear() + 1)
    const daysUntil = Math.ceil((nextBday.getTime() - todayStart.getTime()) / (1000 * 60 * 60 * 24))
    if (daysUntil <= 7) {
      const age = now.getFullYear() - birth.getUTCFullYear() + (nextBday.getFullYear() > now.getFullYear() ? 0 : 0)
      weekBirthdays.push({ id: c.id, fullName: c.fullName, birthDate: c.birthDate.toISOString(), age, daysUntil, phone: c.phone })
    }
  })
  weekBirthdays.sort((a, b) => a.daysUntil - b.daysUntil)

  // Unpaid first premium: contracted within 30 days without firstPaymentPaid = true
  const unpaidFirstPremium = allClients.filter(c =>
    c.contractDate &&
    new Date(c.contractDate) >= thirtyDaysAgo &&
    c.firstPaymentPaid !== true
  ).map(c => ({
    id: c.id,
    fullName: c.fullName,
    contractDate: c.contractDate!.toISOString(),
    daysElapsed: Math.floor((now.getTime() - new Date(c.contractDate!).getTime()) / (1000 * 60 * 60 * 24)),
  }))

  // Pending follow-up: tag "Necesita seguimiento"
  const pendingFollowUp = allClients.filter(c => {
    if (!c.tags) return false
    try {
      const tags: string[] = JSON.parse(c.tags)
      return tags.includes('Necesita seguimiento')
    } catch { return false }
  }).map(c => ({ id: c.id, fullName: c.fullName }))

  return NextResponse.json({
    todayAppointments: todayAppointments.map(a => ({
      id: a.id,
      date: a.date.toISOString(),
      notes: a.notes,
      status: a.status,
      clientId: a.client.id,
      clientName: a.client.fullName,
    })),
    urgentRenewals: urgentRenewals.map(c => ({
      id: c.id,
      fullName: c.fullName,
      insurer: c.insurer,
      renewalDate: c.renewalDate!.toISOString(),
      daysUntil: Math.ceil((new Date(c.renewalDate!).getTime() - now.getTime()) / (1000 * 60 * 60 * 24)),
    })),
    weekBirthdays,
    unpaidFirstPremium,
    pendingFollowUp,
  })
}
