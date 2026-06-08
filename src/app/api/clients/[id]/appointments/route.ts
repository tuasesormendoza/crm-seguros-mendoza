import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function POST(request: NextRequest, ctx: RouteContext<'/api/clients/[id]'>) {
  const { id } = await ctx.params
  const { date, notes, status } = await request.json()
  const appointment = await prisma.appointment.create({
    data: { clientId: id, date: new Date(date), notes: notes || null, status: status || 'Programada' },
  })
  return NextResponse.json(appointment, { status: 201 })
}
