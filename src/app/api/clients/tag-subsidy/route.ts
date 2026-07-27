import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireRole, COMMISSIONS_ROLES } from '@/lib/auth'
import { losesSubsidyWhere, SUBSIDY_TAG } from '@/lib/subsidyEligibility'
import { logAudit } from '@/lib/audit'

// POST /api/clients/tag-subsidy — pone la etiqueta "Sin subsidio 2027" a todos
// los clientes ACTIVOS que, por su estatus migratorio, perderán el crédito
// fiscal el 01/01/2027. Evita tener que etiquetarlos uno por uno.
// Es idempotente: si un cliente ya la tiene, no se duplica.
export async function POST() {
  const auth = await requireRole(COMMISSIONS_ROLES)
  if (auth instanceof NextResponse) return auth

  const clients = await prisma.client.findMany({
    where: losesSubsidyWhere(auth.agencyId),
    select: { id: true, tags: true },
  })

  let tagged = 0
  for (const c of clients) {
    let tags: string[] = []
    try { const p = JSON.parse(c.tags || '[]'); if (Array.isArray(p)) tags = p.filter(t => typeof t === 'string') } catch { tags = [] }
    if (tags.includes(SUBSIDY_TAG)) continue
    tags.push(SUBSIDY_TAG)
    // updateMany con agencyId: el id ya viene de una consulta filtrada por
    // agencia, pero se vuelve a acotar como defensa en profundidad.
    await prisma.client.updateMany({ where: { id: c.id, agencyId: auth.agencyId }, data: { tags: JSON.stringify(tags) } })
    tagged++
  }

  await logAudit(auth, {
    action: 'update', entity: 'client', entityLabel: `Etiqueta "${SUBSIDY_TAG}"`,
    metadata: { afectados: clients.length, etiquetados: tagged },
  })

  return NextResponse.json({ ok: true, affected: clients.length, tagged })
}
