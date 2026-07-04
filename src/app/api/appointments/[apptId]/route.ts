import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getAuth } from '@/lib/auth'
import { pushToGoogle, deleteFromGoogle } from '@/lib/calendarSync'

export async function PUT(request: NextRequest, ctx: RouteContext<'/api/appointments/[apptId]'>) {
  const auth = await getAuth()
  if (auth instanceof NextResponse) return auth
  const { apptId } = await ctx.params
  const { date, notes, status } = await request.json()
  const res = await prisma.appointment.updateMany({
    where: { id: apptId, agencyId: auth.agencyId },
    data: { date: date ? new Date(date) : undefined, notes, status },
  })
  if (res.count === 0) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  const appt = await prisma.appointment.findFirst({
    where: { id: apptId, agencyId: auth.agencyId },
    include: { client: { select: { fullName: true } } },
  })
  // Reflejar la actualización de la cita en Google Calendar.
  if (appt) {
    await pushToGoogle(auth.agencyId, 'appointment', appt.id, {
      title: `Cita: ${appt.client.fullName}`,
      date: appt.date,
      notes: appt.notes,
    })
  }
  return NextResponse.json(appt)
}

export async function DELETE(_req: NextRequest, ctx: RouteContext<'/api/appointments/[apptId]'>) {
  const auth = await getAuth()
  if (auth instanceof NextResponse) return auth
  const { apptId } = await ctx.params
  const res = await prisma.appointment.deleteMany({ where: { id: apptId, agencyId: auth.agencyId } })
  if (res.count === 0) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  // Borrar también el espejo en Google Calendar.
  await deleteFromGoogle(auth.agencyId, 'appointment', apptId)
  return NextResponse.json({ success: true })
}
