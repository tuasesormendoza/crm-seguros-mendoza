import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function DELETE(_req: NextRequest, ctx: RouteContext<'/api/calendar-events/[id]'>) {
  const { id } = await ctx.params
  await prisma.calendarEvent.delete({ where: { id } })
  return NextResponse.json({ success: true })
}
