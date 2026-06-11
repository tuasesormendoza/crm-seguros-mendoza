import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getAuth, clientInAgency } from '@/lib/auth'

export async function POST(request: NextRequest, ctx: RouteContext<'/api/clients/[id]'>) {
  const auth = await getAuth()
  if (auth instanceof NextResponse) return auth
  const { id } = await ctx.params
  if (!(await clientInAgency(id, auth.agencyId))) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  const { date, notes, status } = await request.json()
  const appointment = await prisma.appointment.create({
    data: { clientId: id, agencyId: auth.agencyId, date: new Date(date), notes: notes || null, status: status || 'Programada' },
  })
  return NextResponse.json(appointment, { status: 201 })
}
