// ─────────────────────────────────────────────────────────────────────────────
// TABLA DE PORCENTAJE APLICABLE (IRS) — cuánto se espera que pague el cliente
// de su propio bolsillo por el plan de referencia, según su % del FPL.
//
// IMPORTANTE: los subsidios "mejorados" (American Rescue Plan / Inflation
// Reduction Act, 2021–2025) EXPIRARON el 1 de enero de 2026. Desde 2026 la
// tabla vuelve al esquema original de la ACA:
//   • Los porcentajes son MÁS ALTOS (el cliente paga más).
//   • Dentro de cada tramo el porcentaje sube de forma GRADUAL (escala móvil),
//     no es un valor fijo por tramo.
//   • Vuelve el "precipicio" del 400% del FPL: por encima no hay subsidio.
//
// Valores de 2026 según Rev. Proc. 2025-25.
// ─────────────────────────────────────────────────────────────────────────────

export interface PctBand {
  /** Límite inferior del tramo (% del FPL) */
  min: number
  /** Límite superior del tramo (% del FPL) */
  max: number
  /** Porcentaje al inicio del tramo */
  startPct: number
  /** Porcentaje al final del tramo */
  endPct: number
}

// Tabla vigente para el año de plan 2026 en adelante.
export const APPLICABLE_PCT_2026: PctBand[] = [
  { min: 0,   max: 133, startPct: 2.10, endPct: 2.10 },
  { min: 133, max: 150, startPct: 3.14, endPct: 4.19 },
  { min: 150, max: 200, startPct: 4.19, endPct: 6.60 },
  { min: 200, max: 250, startPct: 6.60, endPct: 8.44 },
  { min: 250, max: 300, startPct: 8.44, endPct: 9.96 },
  { min: 300, max: 400, startPct: 9.96, endPct: 9.96 },
]

// Tabla de los subsidios mejorados (2021–2025). Se conserva para poder cotizar
// años anteriores correctamente.
export const APPLICABLE_PCT_ARPA: PctBand[] = [
  { min: 0,   max: 150, startPct: 0,   endPct: 0 },
  { min: 150, max: 200, startPct: 0,   endPct: 2 },
  { min: 200, max: 250, startPct: 2,   endPct: 4 },
  { min: 250, max: 300, startPct: 4,   endPct: 6 },
  { min: 300, max: 400, startPct: 6,   endPct: 8.5 },
  { min: 400, max: Infinity, startPct: 8.5, endPct: 8.5 },
]

/** Los subsidios mejorados aplicaron hasta el año de plan 2025 inclusive. */
export function usesEnhancedSubsidies(planYear: number): boolean {
  return planYear <= 2025
}

/** ¿Existe el precipicio del 400% del FPL en ese año? (sí desde 2026) */
export function hasSubsidyCliff(planYear: number): boolean {
  return !usesEnhancedSubsidies(planYear)
}

export function scheduleFor(planYear: number): PctBand[] {
  return usesEnhancedSubsidies(planYear) ? APPLICABLE_PCT_ARPA : APPLICABLE_PCT_2026
}

/**
 * Porcentaje del ingreso que se espera que pague el cliente.
 * Dentro del tramo se interpola linealmente (escala móvil), que es como lo
 * calcula el Mercado — usar el valor fijo del tramo da subsidios equivocados.
 * Devuelve null si no califica (por encima del 400% del FPL desde 2026).
 */
export function applicablePercentage(fplPct: number, planYear: number): number | null {
  const bands = scheduleFor(planYear)

  if (fplPct >= 400 && hasSubsidyCliff(planYear)) return null  // precipicio del 400%

  for (const b of bands) {
    if (fplPct >= b.min && fplPct < b.max) {
      if (b.startPct === b.endPct) return b.startPct
      const ratio = (fplPct - b.min) / (b.max - b.min)
      return b.startPct + ratio * (b.endPct - b.startPct)
    }
  }
  // Por encima de la tabla sin precipicio (años ARPA): el tope superior.
  const last = bands[bands.length - 1]
  return last.endPct
}

/** Aporte mensual esperado del cliente. null = no califica para subsidio. */
export function expectedMonthlyContribution(annualIncome: number, fplPct: number, planYear: number): number | null {
  const pct = applicablePercentage(fplPct, planYear)
  if (pct == null) return null
  return (annualIncome * (pct / 100)) / 12
}
