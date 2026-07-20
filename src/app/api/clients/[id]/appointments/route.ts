import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getAuth } from '@/lib/auth'
import { pushToGoogle } from '@/lib/calendarSync'

export async function POST(request: NextRequest, ctx: RouteContext<'/api/clients/[id]'>) {
  const auth = await getAuth()
  if (auth instanceof NextResponse) return auth
  const { id } = await ctx.params
  const client = await prisma.client.findFirst({ where: { id, agencyId: auth.agencyId }, select: { fullName: true } })
  if (!client) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  const { date, doctorName, location, notes, status } = await request.json()
  const appointment = await prisma.appointment.create({
    data: {
      clientId: id, agencyId: auth.agencyId, date: new Date(date),
      doctorName: doctorName || null, location: location || null,
      notes: notes || null, status: status || 'Programada',
    },
  })
  // Reflejar la cita médica en Google Calendar (título = nombre del cliente).
  await pushToGoogle(auth.agencyId, 'appointment', appointment.id, {
    title: `Cita médica: ${client.fullName}${doctorName ? ` — ${doctorName}` : ''}`,
    date: new Date(date),
    notes: [location, notes].filter(Boolean).join(' · ') || undefined,
  })
  return NextResponse.json(appointment, { status: 201 })
}
