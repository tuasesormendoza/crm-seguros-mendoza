// Construye el filtro Prisma del segmento de una campaña a partir de los
// parámetros de la UI. Compartido por /api/campaigns/recipients (previsualizar)
// y /api/campaigns/send (enviar), para que ambos apunten al MISMO conjunto.

import { SUBSIDY_ELIGIBLE_STATUSES } from '@/lib/subsidyEligibility'

export interface SegmentParams {
  status?: string
  insurer?: string
  state?: string
  tag?: string
  wn?: string          // 'con' | 'sin'
  missing?: string     // 'dental' | 'wn'
  clientId?: string    // un cliente específico (ignora los demás filtros)
  // ── Segmentos inteligentes ──
  renewalSoon?: string // días: '30' | '60' | '90' — renuevan dentro de ese rango
  noReview?: string    // 'si' — aún no dejaron reseña de Google
  birthdayMonth?: string // 'si' — cumplen años este mes (se filtra después, ver smartPostFilter)
  losesSubsidy?: string  // 'si' — perderán el crédito fiscal el 01/01/2027 por su estatus migratorio
}

export function buildSegmentWhere(agencyId: string, p: SegmentParams) {
  // Cliente específico: el segmento es exactamente esa persona.
  if (p.clientId) return { agencyId, id: p.clientId }

  const noWn = { OR: [{ wnPolicies: null }, { NOT: { wnPolicies: { contains: '"type"' } } }] }

  const renewalDays = p.renewalSoon ? parseInt(p.renewalSoon, 10) : 0
  let renewalFilter: Record<string, unknown> = {}
  if (renewalDays > 0) {
    const now = new Date()
    const until = new Date(now.getTime() + renewalDays * 24 * 60 * 60 * 1000)
    renewalFilter = { status: 'Activo', renewalDate: { gte: now, lte: until } }
  }

  return {
    agencyId,
    AND: [
      p.status ? { status: p.status } : {},
      p.insurer ? { insurer: p.insurer } : {},
      p.state ? { state: p.state } : {},
      p.tag ? { tags: { contains: `"${p.tag}"` } } : {},
      p.wn === 'con' ? { wnPolicies: { contains: '"type"' } } : {},
      p.wn === 'sin' ? noWn : {},
      p.missing === 'wn' ? noWn : {},
      p.missing === 'dental' ? { OR: [{ dentalInsurer: null }, { dentalInsurer: '' }] } : {},
      renewalFilter,
      p.noReview === 'si' ? { NOT: { googleReview: 'Realizada' } } : {},
      // Perderán el crédito fiscal el 01/01/2027: tienen estatus migratorio
      // registrado y NO es ciudadano ni residente permanente.
      p.losesSubsidy === 'si' ? {
        migrationStatus: { notIn: [...SUBSIDY_ELIGIBLE_STATUSES, 'Otro', 'Prefiere no responder'] },
        NOT: { migrationStatus: null },
      } : {},
    ],
  }
}

// Filtro que NO se puede expresar en el WHERE de Prisma (mes de cumpleaños):
// se aplica en memoria sobre los clientes ya consultados. Requiere que la
// consulta haya traído birthDate.
export function smartPostFilter<T extends { birthDate?: Date | string | null }>(clients: T[], p: SegmentParams): T[] {
  if (p.birthdayMonth === 'si') {
    const month = new Date().getMonth() // 0-11 local
    return clients.filter(c => {
      if (!c.birthDate) return false
      const d = new Date(c.birthDate)
      return !isNaN(d.getTime()) && d.getUTCMonth() === month
    })
  }
  return clients
}
