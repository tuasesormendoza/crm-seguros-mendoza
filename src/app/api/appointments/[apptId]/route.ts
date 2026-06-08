import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function PUT(request: NextRequest, ctx: RouteContext<'/api/appointments/[apptId]'>) {
  const { apptId } = await ctx.params
  const { date, notes, status } = await request.json()
  const appt = await prisma.appointment.update({
    where: { id: apptId },
    data: { date: date ? new Date(date) : undefined, notes, status },
  })
  return NextResponse.json(appt)
}

export async function DELETE(_req: NextRequest, ctx: RouteContext<'/api/appointments/[apptId]'>) {
  const { apptId } = await ctx.params
  await prisma.appointment.delete({ where: { id: apptId } })
  return NextResponse.json({ success: true })
}
