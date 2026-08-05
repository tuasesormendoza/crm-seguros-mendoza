// ─────────────────────────────────────────────────────────────────────────────
// MERCADO DE GEORGIA (Georgia Access) — consulta y cálculo.
//
// Los datos vienen de los archivos oficiales del estado, importados por
// scripts/import-georgia.mjs a la tabla GeorgiaMarketData (una fila por área
// de tarifa con sus planes y las tarifas por edad).
//
// Aquí se calcula lo mismo que la API federal devuelve para los demás estados:
// el SLCSP (2º plan Silver más barato) y el listado de mejores planes, ya con
// el precio del HOGAR completo.
// ─────────────────────────────────────────────────────────────────────────────

// Import relativo (no alias): así el runner de pruebas puede cargarlo.
import { GA_COUNTY_RATING_AREA } from './georgiaRatingAreas.ts'

export interface GaPlan {
  id: string
  name: string
  issuer: string | null
  metalLevel: string
  type: string
  deductible: number | null
  moop: number | null
  hsaEligible?: boolean
  /** Clave del área de servicio ("issuerId|serviceAreaId") para filtrar por condado. */
  sa?: string
  /**
   * Parte de la prima que corresponde a Beneficios Esenciales de Salud (0–1).
   * Solo esa parte cuenta para el subsidio; los extras que NO son beneficio
   * esencial (quiropráctica añadida, visión/dental de adulto…) se descuentan.
   */
  ehb?: number
  primaryCare?: string | null
  specialist?: string | null
  urgentCare?: string | null
  emergencyRoom?: string | null
  genericDrugs?: string | null
}

export interface GaPayload {
  plans: GaPlan[]
  rates: Record<string, Record<string, number>>  // edad → planId → tarifa
  // "issuerId|serviceAreaId" → "ALL" (todo el estado) o lista de FIPS de condado.
  serviceAreas?: Record<string, 'ALL' | string[]>
}

// Condado ("Fulton County", "fulton") → área de tarifa 1..16.
export function ratingAreaForCounty(county?: string | null): number | null {
  const c = (county || '').trim().toLowerCase().replace(/\s+county$/, '')
  if (!c) return null
  return GA_COUNTY_RATING_AREA[c] ?? null
}

// Los archivos agrupan las edades así: "0-14", "15".."64", "65 and over".
export function ageKey(age: number, available: string[]): string | null {
  if (!isFinite(age)) return null
  const has = (k: string) => available.includes(k)
  if (age <= 14) {
    return ['0-14', '14', '0-20'].find(has) ?? null
  }
  if (age >= 65) {
    return ['65 and over', '65', '64'].find(has) ?? null
  }
  const exact = String(Math.floor(age))
  if (has(exact)) return exact
  // Si falta esa edad exacta, se usa la más cercana disponible (defensivo).
  const nums = available.map(a => parseInt(a, 10)).filter(n => isFinite(n))
  if (!nums.length) return null
  const closest = nums.reduce((best, n) => Math.abs(n - age) < Math.abs(best - age) ? n : best, nums[0])
  return available.find(a => parseInt(a, 10) === closest) ?? null
}

// Precio MENSUAL del hogar para un plan: se suman las tarifas de cada persona.
// Regla del Marketplace: de los menores de 21 solo se cobran los 3 mayores.
export function householdPremium(payload: GaPayload, planId: string, ages: number[]): number | null {
  const available = Object.keys(payload.rates)
  if (!available.length || !ages.length) return null

  const adults = ages.filter(a => a >= 21).sort((a, b) => b - a)
  const kids = ages.filter(a => a < 21).sort((a, b) => b - a).slice(0, 3)
  let total = 0
  for (const age of [...adults, ...kids]) {
    const key = ageKey(age, available)
    if (!key) return null
    const rate = payload.rates[key]?.[planId]
    if (rate == null) return null   // ese plan no cubre esa edad → no cotizable
    total += rate
  }
  return Math.round(total * 100) / 100
}

export interface GaQuote {
  slcspMonthly: number | null
  slcspPlanName: string | null
  silverCount: number
  plans: (GaPlan & { premium: number })[]   // todos los planes con precio del hogar
}

/**
 * Prima del plan de referencia que cuenta para el subsidio.
 *
 * La ley (26 U.S.C. §36B) manda usar solo la parte de la prima que paga
 * Beneficios Esenciales de Salud. Un plan Silver puede traer extras que no lo
 * son —quiropráctica añadida, visión o dental de adulto— y esa parte NO genera
 * crédito fiscal. El archivo oficial la publica como EHBPercentTotalPremium.
 *
 * Ojo: el cliente sigue pagando la prima COMPLETA; el ajuste solo afecta al
 * cálculo del subsidio. Por eso no se toca `premium` en el listado de planes.
 */
export function ehbAdjustedPremium(plan: GaPlan, premium: number): number {
  const pct = typeof plan.ehb === 'number' && plan.ehb > 0 && plan.ehb <= 1 ? plan.ehb : 1
  return Math.round(premium * pct * 100) / 100
}

// Niveles metálicos de planes de SALUD. Los planes dentales usan "High"/"Low"
// y no deben aparecer en la cotización médica ni contar para el SLCSP.
export const HEALTH_METAL_LEVELS = new Set([
  'Bronze', 'Expanded Bronze', 'Silver', 'Gold', 'Platinum', 'Catastrophic',
])

/**
 * ¿El plan se vende en ese condado? Muchos planes existen en un área de tarifa
 * pero solo cubren algunos de sus condados. Si no hay datos de área de servicio
 * se asume que sí (no se descarta nada por falta de información).
 */
export function planCoversCounty(payload: GaPayload, plan: GaPlan, countyFips?: string | null): boolean {
  if (!countyFips || !payload.serviceAreas || !plan.sa) return true
  const area = payload.serviceAreas[plan.sa]
  if (!area) return true
  return area === 'ALL' || area.includes(countyFips)
}

// Calcula el SLCSP y el precio de cada plan para el hogar indicado.
// `countyFips` limita la cotización a los planes que se venden en ese condado.
export function quoteGeorgia(payload: GaPayload, ages: number[], countyFips?: string | null): GaQuote {
  const priced: (GaPlan & { premium: number })[] = []
  for (const plan of payload.plans) {
    if (!HEALTH_METAL_LEVELS.has(plan.metalLevel)) continue   // descarta dentales
    if (!planCoversCounty(payload, plan, countyFips)) continue // no se vende ahí
    const premium = householdPremium(payload, plan.id, ages)
    if (premium != null && premium > 0) priced.push({ ...plan, premium })
  }

  const silver = priced.filter(p => p.metalLevel === 'Silver').sort((a, b) => a.premium - b.premium)
  // SLCSP = segundo plan Silver más barato (si solo hay uno, ese). El orden se
  // hace por la prima completa —así es como se listan los planes— y al elegido
  // se le descuenta la parte que no es Beneficio Esencial de Salud.
  const benchmark = silver[1] ?? silver[0] ?? null

  return {
    slcspMonthly: benchmark ? ehbAdjustedPremium(benchmark, benchmark.premium) : null,
    slcspPlanName: benchmark ? benchmark.name : null,
    silverCount: silver.length,
    plans: priced,
  }
}

export function parsePayload(json: string): GaPayload | null {
  try {
    const p = JSON.parse(json)
    if (p && Array.isArray(p.plans) && p.rates) return p as GaPayload
  } catch { /* payload inválido */ }
  return null
}
