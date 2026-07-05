// Construye el filtro Prisma del segmento de una campaña a partir de los
// parámetros de la UI. Compartido por /api/campaigns/recipients (previsualizar)
// y /api/campaigns/send (enviar), para que ambos apunten al MISMO conjunto.

export interface SegmentParams {
  status?: string
  insurer?: string
  state?: string
  tag?: string
  wn?: string        // 'con' | 'sin'
  missing?: string   // 'dental' | 'wn'
}

export function buildSegmentWhere(agencyId: string, p: SegmentParams) {
  const noWn = { OR: [{ wnPolicies: null }, { NOT: { wnPolicies: { contains: '"type"' } } }] }
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
    ],
  }
}
