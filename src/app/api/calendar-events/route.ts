import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function POST(request: NextRequest) {
  const { title, date, notes } = await request.json()
  if (!title || !date) {
    return NextResponse.json({ error: 'title y date son requeridos' }, { status: 400 })
  }
  const event = await prisma.calendarEvent.create({
    data: {
      title,
      date: new Date(date),
      notes: notes || null,
    },
  })
  return NextResponse.json(event)
}
