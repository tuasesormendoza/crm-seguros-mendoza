import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireRole, COMMISSIONS_ROLES } from '@/lib/auth'

// Marca en bloque, para un período, el estado de conciliación de varios clientes:
//   - `clientIds` (+ `received`): marca esos clientes como recibido/no recibido.
//   - `gaps` [{ clientId, gapReason }]: registra clientes que NO están en el pago
//     con su motivo ('broker' = reclamar | 'cancelled' = el cliente canceló).
// Se usa por el botón "Marcar todos" de la conciliación y por el importador de PDF.
export async function POST(request: NextRequest) {
  const auth = await requireRole(COMMISSIONS_ROLES)
  if (auth instanceof NextResponse) return auth
  const body = await request.json().catch(() => ({}))
  const { clientIds, period, received, gaps } = body as {
    clientIds?: string[]
    period?: string
    received?: boolean
    gaps?: { clientId: string; gapReason: string | null }[]
  }

  if (!period) {
    return NextResponse.json({ error: 'period es requerido' }, { status: 400 })
  }

  // Solo IDs de clientes de esta agencia (seguridad multi-tenant).
  const requestedIds = [
    ...(Array.isArray(clientIds) ? clientIds : []),
    ...(Array.isArray(gaps) ? gaps.map(g => g.clientId) : []),
  ]
  if (requestedIds.length === 0) {
    return NextResponse.json({ error: 'clientIds o gaps son requeridos' }, { status: 400 })
  }
  const own = await prisma.client.findMany({
    where: { id: { in: requestedIds }, agencyId: auth.agencyId },
    select: { id: true },
  })
  const ownSet = new Set(own.map(c => c.id))

  const ops: Promise<unknown>[] = []

  // Recibidos / no recibidos
  if (Array.isArray(clientIds)) {
    for (const clientId of clientIds) {
      if (!ownSet.has(clientId)) continue
      ops.push(prisma.commissionCheck.upsert({
        where: { clientId_period: { clientId, period } },
        // Al marcar recibido, se limpia cualquier motivo de faltante previo.
        update: { received: !!received, gapReason: received ? null : undefined },
        create: { clientId, period, received: !!received, agencyId: auth.agencyId },
      }))
    }
  }

  // Faltantes con motivo (received = false)
  if (Array.isArray(gaps)) {
    for (const g of gaps) {
      if (!ownSet.has(g.clientId)) continue
      const reason = g.gapReason === 'broker' || g.gapReason === 'cancelled' ? g.gapReason : null
      ops.push(prisma.commissionCheck.upsert({
        where: { clientId_period: { clientId: g.clientId, period } },
        update: { received: false, gapReason: reason },
        create: { clientId: g.clientId, period, received: false, gapReason: reason, agencyId: auth.agencyId },
      }))
    }
  }

  await Promise.all(ops)
  return NextResponse.json({ ok: true, count: ops.length })
}
