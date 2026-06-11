import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

// Historial de cambios de aseguradora de un cliente — usado para que la
// conciliación de comisiones atribuya cada mes a la aseguradora que
// realmente aplicaba en ese período (ej. tenía Oscar hasta febrero y se
// cambió a Ambetter en marzo).

function periodToDate(period: string): Date | null {
  if (!/^\d{4}-\d{2}$/.test(period)) return null
  const [y, m] = period.split('-').map(Number)
  return new Date(y, m - 1, 1)
}

export async function GET(_req: NextRequest, ctx: RouteContext<'/api/clients/[id]'>) {
  const { id } = await ctx.params
  const history = await prisma.insurerHistory.findMany({
    where: { clientId: id },
    orderBy: { startDate: 'asc' },
  })
  return NextResponse.json(history)
}

export async function POST(request: NextRequest, ctx: RouteContext<'/api/clients/[id]'>) {
  const { id } = await ctx.params
  const body = await request.json().catch(() => ({}))
  const { insurer, startPeriod, endPeriod, notes } = body as {
    insurer?: string
    startPeriod?: string // "YYYY-MM"
    endPeriod?: string | null // "YYYY-MM" or null = aseguradora actual
    notes?: string
  }

  if (!insurer || !startPeriod) {
    return NextResponse.json({ error: 'Aseguradora y mes de inicio son requeridos' }, { status: 400 })
  }

  const startDate = periodToDate(startPeriod)
  if (!startDate) {
    return NextResponse.json({ error: 'Mes de inicio inválido, debe tener formato YYYY-MM' }, { status: 400 })
  }

  let endDate: Date | null = null
  if (endPeriod) {
    endDate = periodToDate(endPeriod)
    if (!endDate) {
      return NextResponse.json({ error: 'Mes de fin inválido, debe tener formato YYYY-MM' }, { status: 400 })
    }
    if (endDate < startDate) {
      return NextResponse.json({ error: 'El mes de fin no puede ser anterior al mes de inicio' }, { status: 400 })
    }
  }

  const client = await prisma.client.findUnique({ where: { id }, select: { id: true, insurer: true } })
  if (!client) return NextResponse.json({ error: 'Cliente no encontrado' }, { status: 404 })

  // Si esta entrada representa la aseguradora ACTUAL (sin fecha de fin),
  // cierra cualquier otra entrada que también esté abierta y actualiza
  // client.insurer para mantenerlo en sincronía.
  if (!endDate) {
    const openEntries = await prisma.insurerHistory.findMany({
      where: { clientId: id, endDate: null },
    })
    for (const entry of openEntries) {
      const closeAt = new Date(startDate.getFullYear(), startDate.getMonth() - 1, 1)
      await prisma.insurerHistory.update({ where: { id: entry.id }, data: { endDate: closeAt } })
    }
    if (client.insurer !== insurer) {
      await prisma.client.update({ where: { id }, data: { insurer } })
    }
  }

  const entry = await prisma.insurerHistory.create({
    data: { clientId: id, insurer, startDate, endDate, notes: notes || null },
  })

  return NextResponse.json(entry, { status: 201 })
}
