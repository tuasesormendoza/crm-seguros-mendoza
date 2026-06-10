import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const month = searchParams.get('month') || new Date().toISOString().slice(0, 7)
  const [year, mon] = month.split('-').map(Number)

  const start = new Date(year, mon - 1, 1)
  const end = new Date(year, mon, 0, 23, 59, 59)

  // Appointments
  const appointments = await prisma.appointment.findMany({
    where: { date: { gte: start, lte: end } },
    include: { client: { select: { id: true, fullName: true } } },
  })

  // Manually-created calendar events
  const events = await prisma.calendarEvent.findMany({
    where: { date: { gte: start, lte: end } },
    orderBy: { date: 'asc' },
  })

  // Renewals
  const renewals = await prisma.client.findMany({
    where: { renewalDate: { gte: start, lte: end } },
    select: { id: true, fullName: true, renewalDate: true, insurer: true },
  })

  // Birthdays - all clients + dependents, check month/day
  const allClients = await prisma.client.findMany({
    select: { id: true, fullName: true, birthDate: true },
    where: { birthDate: { not: null } },
  })
  const allDependents = await prisma.dependent.findMany({
    select: { id: true, name: true, birthDate: true, clientId: true },
    where: { birthDate: { not: null } },
  })

  const birthdays: { id: string; name: string; date: string; clientId?: string }[] = []

  for (const c of allClients) {
    if (!c.birthDate) continue
    const bd = new Date(c.birthDate)
    if (bd.getUTCMonth() + 1 === mon) {
      birthdays.push({
        id: c.id,
        name: c.fullName,
        date: `${year}-${String(mon).padStart(2, '0')}-${String(bd.getUTCDate()).padStart(2, '0')}`,
        clientId: c.id,
      })
    }
  }

  for (const d of allDependents) {
    if (!d.birthDate) continue
    const bd = new Date(d.birthDate)
    if (bd.getUTCMonth() + 1 === mon) {
      birthdays.push({
        id: d.id,
        name: d.name || 'Dependiente',
        date: `${year}-${String(mon).padStart(2, '0')}-${String(bd.getUTCDate()).padStart(2, '0')}`,
        clientId: d.clientId,
      })
    }
  }

  return NextResponse.json({ appointments, renewals, birthdays, events })
}
