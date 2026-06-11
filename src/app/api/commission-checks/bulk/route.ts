import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireRole, COMMISSIONS_ROLES } from '@/lib/auth'

// Marca (o desmarca) "recibido" para varios clientes a la vez, en un período
// dado — usado por el botón "Marcar todos como recibido" de la conciliación,
// para procesar de un solo clic los meses atrasados de una aseguradora.
export async function POST(request: NextRequest) {
  const auth = await requireRole(COMMISSIONS_ROLES)
  if (auth instanceof NextResponse) return auth
  const body = await request.json().catch(() => ({}))
  const { clientIds, period, received } = body as {
    clientIds?: string[]
    period?: string
    received?: boolean
  }

  if (!Array.isArray(clientIds) || clientIds.length === 0 || !period) {
    return NextResponse.json({ error: 'clientIds y period son requeridos' }, { status: 400 })
  }

  // Filtra a solo los clientes que pertenecen a esta agencia — ignora cualquier
  // id ajeno que pudiera venir en la petición.
  const ownClients = await prisma.client.findMany({
    where: { id: { in: clientIds }, agencyId: auth.agencyId },
    select: { id: true },
  })
  const ownIds = ownClients.map(c => c.id)

  await Promise.all(ownIds.map(clientId =>
    prisma.commissionCheck.upsert({
      where: { clientId_period: { clientId, period } },
      update: { received: !!received },
      create: { clientId, period, received: !!received, agencyId: auth.agencyId },
    })
  ))

  return NextResponse.json({ ok: true, count: ownIds.length })
}
