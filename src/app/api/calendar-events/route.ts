import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getAuth } from '@/lib/auth'

export async function POST(request: NextRequest) {
  const auth = await getAuth()
  if (auth instanceof NextResponse) return auth
  const { title, date, notes } = await request.json()
  if (!title || !date) {
    return NextResponse.json({ error: 'title y date son requeridos' }, { status: 400 })
  }
  const event = await prisma.calendarEvent.create({
    data: {
      agencyId: auth.agencyId,
      title,
      date: new Date(date),
      notes: notes || null,
    },
  })
  return NextResponse.json(event)
}
