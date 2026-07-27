// ─────────────────────────────────────────────────────────────────────────────
// REGLA DE ELEGIBILIDAD PARA EL SUBSIDIO (APTC)
//
// A partir del 1 de enero de 2027, solo los CIUDADANOS americanos y los
// RESIDENTES PERMANENTES (Green Card) califican para el crédito fiscal (APTC).
// Los demás estatus migratorios pueden inscribirse en un plan del Marketplace,
// pero pagan el PRECIO COMPLETO.
//
// Toda la regla vive aquí (fecha y lista de estatus) para que, si la política
// cambia, se ajuste en UN solo lugar y se refleje en todo el CRM.
// ─────────────────────────────────────────────────────────────────────────────

// Fecha en que entra en vigor la restricción.
export const SUBSIDY_RULE_DATE = new Date(2027, 0, 1) // 1 de enero de 2027

// Únicos estatus que seguirán calificando para el subsidio.
export const SUBSIDY_ELIGIBLE_STATUSES = [
  'Ciudadano/a americano/a',
  'Residente permanente (Green Card)',
] as const

export interface SubsidyCheck {
  /** ¿Tiene un estatus que seguirá calificando después del 01/01/2027? */
  keepsSubsidy: boolean
  /** ¿Perderá el subsidio por la regla de 2027? (estatus conocido y no elegible) */
  losesSubsidy: boolean
  /** No hay estatus migratorio registrado — el agente debe preguntarlo. */
  unknown: boolean
  /** ¿La regla YA está vigente (hoy es 2027 o después)? */
  ruleActive: boolean
  /** Explicación lista para mostrar al agente. */
  message: string
}

// "Prefiere no responder" y "Otro" no permiten determinar la elegibilidad:
// se tratan como desconocidos para que el agente lo confirme con el cliente.
const INCONCLUSIVE = ['Otro', 'Prefiere no responder']

export function checkSubsidy(migrationStatus?: string | null, now: Date = new Date()): SubsidyCheck {
  const status = (migrationStatus || '').trim()
  const ruleActive = now.getTime() >= SUBSIDY_RULE_DATE.getTime()

  if (!status || INCONCLUSIVE.includes(status)) {
    return {
      keepsSubsidy: false, losesSubsidy: false, unknown: true, ruleActive,
      message: 'Falta confirmar el estatus migratorio para saber si mantendrá el subsidio en 2027.',
    }
  }

  const keeps = (SUBSIDY_ELIGIBLE_STATUSES as readonly string[]).includes(status)
  if (keeps) {
    return {
      keepsSubsidy: true, losesSubsidy: false, unknown: false, ruleActive,
      message: 'Mantiene el crédito fiscal (APTC).',
    }
  }

  return {
    keepsSubsidy: false, losesSubsidy: true, unknown: false, ruleActive,
    message: ruleActive
      ? 'No califica para el crédito fiscal: paga el precio completo del plan.'
      : `Desde el 01/01/2027 no calificará para el crédito fiscal (pagará precio completo). Puede inscribirse igual.`,
  }
}

// Días que faltan para que entre en vigor la regla (0 si ya está vigente).
export function daysUntilRule(now: Date = new Date()): number {
  const ms = SUBSIDY_RULE_DATE.getTime() - now.getTime()
  return ms <= 0 ? 0 : Math.ceil(ms / (1000 * 60 * 60 * 24))
}

// Filtro para Prisma: clientes ACTIVOS que PERDERÁN el subsidio (estatus
// registrado y distinto de ciudadano/residente permanente).
export function losesSubsidyWhere(agencyId: string) {
  return {
    agencyId,
    status: 'Activo',
    migrationStatus: { not: null as string | null },
    NOT: [
      { migrationStatus: { in: [...SUBSIDY_ELIGIBLE_STATUSES, ...INCONCLUSIVE, ''] } },
    ],
  }
}
