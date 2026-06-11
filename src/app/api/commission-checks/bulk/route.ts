import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

// Marca (o desmarca) "recibido" para varios clientes a la vez, en un período
// dado — usado por el botón "Marcar todos como recibido" de la conciliación,
// para procesar de un solo clic los meses atrasados de una aseguradora.
export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => ({}))
  const { clientIds, period, received } = body as {
    clientIds?: string[]
    period?: string
    received?: boolean
  }

  if (!Array.isArray(clientIds) || clientIds.length === 0 || !period) {
    return NextResponse.json({ error: 'clientIds y period son requeridos' }, { status: 400 })
  }

  await Promise.all(clientIds.map(clientId =>
    prisma.commissionCheck.upsert({
      where: { clientId_period: { clientId, period } },
      update: { received: !!received },
      create: { clientId, period, received: !!received },
    })
  ))

  return NextResponse.json({ ok: true, count: clientIds.length })
}
