// ─────────────────────────────────────────────────────────────────────────────
// Lógica PURA de comisiones (sin base de datos, sin red) — extraída del route
// `/api/commissions` para poder probarla automáticamente. No cambia el
// comportamiento: el route importa estas mismas funciones.
//
// Conceptos:
//   - Activación de póliza = 1ro del mes SIGUIENTE a la fecha de contratación.
//     Ej: contrata 06/15 → activa 07/01.
//   - Primera comisión = activación + N meses, donde N ("monthsToFirstPayment")
//     es configurable por aseguradora (por defecto 2; ej. Oscar paga a 1 mes).
//   - "Tramo" (stint): período continuo en que un cliente estuvo con UNA
//     aseguradora. Si cambia de aseguradora a mitad de póliza, cada tramo
//     reinicia su propio reloj de "primera comisión".
// ─────────────────────────────────────────────────────────────────────────────

export const DEFAULT_RATES: Record<string, number> = {
  'Alliant': 18, 'Ambetter': 18, 'AmeriHealth': 20, 'Anthem': 20, 'AvMed': 18,
  'Blue Cross Blue Shield': 25, 'CareSource': 19, 'Christus': 18, 'Cigna': 20,
  'Community': 18, 'Health First': 18, 'Health Spring': 18, 'Highmark': 18,
  'Imperial': 18, 'Kaiser': 18, 'LA Care': 18, 'Medica': 18, 'Molina': 18,
  'Oscar': 18, 'Select Health': 18, 'UnitedHealthcare': 18,
}

// Ciclo de pago por defecto: día del mes en que la aseguradora suele pagar la
// comisión (valor inicial; el agente lo puede ajustar en Comisiones → Tasas).
//   • Ciclo 1 — entre el 1 y 5 del mes  → día 5
//   • Ciclo 2 — entre el 15 y 20 del mes → día 20
//   • Sin ciclo de pago definido → null (no se muestra día)
export const DEFAULT_PAYMENT_DAYS: Record<string, number | null> = {
  // Ciclo 1 (1–5)
  'Ambetter': 5, 'Blue Cross Blue Shield': 5, 'Cigna': 5, 'UnitedHealthcare': 5,
  'Community': 5, 'AmeriHealth': 5, 'Anthem': 5, 'Medica': 5, 'Select Health': 5, 'Imperial': 5,
  // Ciclo 2 (15–20)
  'Oscar': 20, 'Molina': 20, 'Highmark': 20, 'Kaiser': 20, 'LA Care': 20,
  'Christus': 20, 'AvMed': 20, 'Health First': 20,
  // Sin ciclo definido
  'CareSource': null, 'Alliant': null, 'Health Spring': null,
}

// Las fechas de InsurerHistory se guardan como medianoche UTC del día 1 del
// mes (ej. "2026-02-01T00:00:00.000Z"). En zonas horarias detrás de UTC
// (EE.UU.), `new Date(...)` representa ese instante como las 19:00 (o 20:00)
// del día anterior, y los getters locales (getMonth/getFullYear) devuelven el
// mes ANTERIOR al que realmente se guardó. Esto rompe `buildStints`/
// `stintCovers` (un tramo "termina" un mes antes de lo registrado). Esta
// función reconstruye la fecha como medianoche LOCAL del mismo año/mes/día
// que tenía en UTC, para que el resto de la lógica (que opera con getters
// locales) la interprete correctamente.
export function normalizeMonthDate(date: Date): Date {
  return new Date(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate())
}

export function getActivationDate(contractDate: Date | null): Date | null {
  if (!contractDate) return null
  const d = new Date(contractDate)
  // 1ro del mes siguiente
  return new Date(d.getUTCFullYear(), d.getUTCMonth() + 1, 1)
}

// Un "tramo" representa un período continuo con una aseguradora específica.
// endDate === null significa "aseguradora actual" (sin fecha de fin todavía).
export type Stint = { insurer: string; startDate: Date; endDate: Date | null }

export type InsurerHistoryEntry = { insurer: string; startDate: Date; endDate: Date | null }

export function buildStints(
  insurer: string,
  contractDate: Date | null,
  history: InsurerHistoryEntry[]
): Stint[] {
  if (history.length === 0) {
    const activation = getActivationDate(contractDate)
    if (!activation) return []
    return [{ insurer, startDate: activation, endDate: null }]
  }
  const sorted = [...history]
    .sort((a, b) => a.startDate.getTime() - b.startDate.getTime())
    .map(h => ({ insurer: h.insurer, startDate: new Date(h.startDate), endDate: h.endDate ? new Date(h.endDate) : null }))

  // Si el último tramo registrado ya terminó, se completa el resto del historial
  // con la aseguradora ACTUAL del cliente a partir del mes siguiente — así el
  // agente solo registra los tramos ANTERIORES, no uno "actual" cada vez.
  const last = sorted[sorted.length - 1]
  if (last.endDate) {
    const nextStart = new Date(last.endDate.getFullYear(), last.endDate.getMonth() + 1, 1)
    sorted.push({ insurer, startDate: nextStart, endDate: null })
  }
  return sorted
}

// ¿Este tramo cubre el mes que empieza en `periodStart` (1ro del mes)?
export function stintCovers(stint: Stint, periodStart: Date): boolean {
  if (stint.startDate > periodStart) return false
  if (stint.endDate && stint.endDate < periodStart) return false
  return true
}

export function getStintFirstPaymentDate(stint: Stint, monthsMap: Record<string, number>): Date {
  const months = monthsMap[stint.insurer] ?? 2
  return new Date(stint.startDate.getFullYear(), stint.startDate.getMonth() + months, 1)
}

// ── Washington National (WN): comisión única = 30% de la prima anualizada,
//    75% al someter + 25% tras el mes 8. Clawback si cancela antes del mes 7.
export function monthsBetween(start: Date, end: Date): number {
  let months = (end.getFullYear() - start.getFullYear()) * 12 + (end.getMonth() - start.getMonth())
  if (end.getDate() < start.getDate()) months -= 1
  return Math.max(months, 0)
}

export function addMonths(d: Date, n: number): Date {
  return new Date(d.getFullYear(), d.getMonth() + n, d.getDate())
}

export type WnCommission = {
  totalCommission: number   // 30% de la prima anualizada
  firstPayment: number      // 75%
  secondPayment: number     // 25%
}

export function wnCommission(monthlyPremium: number): WnCommission {
  const annualized = monthlyPremium * 12
  const totalCommission = annualized * 0.30
  return {
    totalCommission,
    firstPayment: totalCommission * 0.75,
    secondPayment: totalCommission * 0.25,
  }
}
