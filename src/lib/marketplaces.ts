// ─────────────────────────────────────────────────────────────────────────────
// MERCADOS DE SALUD POR ESTADO
//
// No todos los estados usan cuidadodesalud.gov (el Mercado federal). Algunos
// operan su PROPIO mercado estatal — por ejemplo Georgia, que desde 2025 usa
// Georgia Access. En esos estados la API federal de CMS no tiene los planes
// (responde "state is not a valid marketplace state"), así que el precio del
// plan de referencia (SLCSP) se ingresa a mano desde el sitio del estado.
//
// IMPORTANTE: el CÁLCULO del subsidio es FEDERAL e idéntico en todos los
// estados (tabla del IRS + nivel de pobreza). Lo único que cambia es de dónde
// sale el precio del plan de referencia.
// ─────────────────────────────────────────────────────────────────────────────

export interface StateMarketplace {
  code: string
  name: string
  url: string
}

// Estados con mercado PROPIO (no están en la API federal de CMS).
export const STATE_MARKETPLACES: Record<string, StateMarketplace> = {
  GA: { code: 'GA', name: 'Georgia Access', url: 'https://georgiaaccess.gov' },
  CA: { code: 'CA', name: 'Covered California', url: 'https://www.coveredca.com' },
  CO: { code: 'CO', name: 'Connect for Health Colorado', url: 'https://connectforhealthco.com' },
  CT: { code: 'CT', name: 'Access Health CT', url: 'https://www.accesshealthct.com' },
  DC: { code: 'DC', name: 'DC Health Link', url: 'https://dchealthlink.com' },
  ID: { code: 'ID', name: 'Your Health Idaho', url: 'https://www.yourhealthidaho.org' },
  KY: { code: 'KY', name: 'kynect', url: 'https://kynect.ky.gov' },
  ME: { code: 'ME', name: 'CoverME.gov', url: 'https://www.coverme.gov' },
  MD: { code: 'MD', name: 'Maryland Health Connection', url: 'https://www.marylandhealthconnection.gov' },
  MA: { code: 'MA', name: 'Massachusetts Health Connector', url: 'https://www.mahealthconnector.org' },
  MN: { code: 'MN', name: 'MNsure', url: 'https://www.mnsure.org' },
  NV: { code: 'NV', name: 'Nevada Health Link', url: 'https://www.nevadahealthlink.com' },
  NJ: { code: 'NJ', name: 'Get Covered New Jersey', url: 'https://www.nj.gov/getcoverednj' },
  NM: { code: 'NM', name: 'beWellnm', url: 'https://www.bewellnm.com' },
  NY: { code: 'NY', name: 'NY State of Health', url: 'https://nystateofhealth.ny.gov' },
  PA: { code: 'PA', name: 'Pennie', url: 'https://pennie.com' },
  RI: { code: 'RI', name: 'HealthSource RI', url: 'https://healthsourceri.com' },
  VT: { code: 'VT', name: 'Vermont Health Connect', url: 'https://portal.healthconnect.vermont.gov' },
  VA: { code: 'VA', name: 'Virginia\'s Insurance Marketplace', url: 'https://marketplace.virginia.gov' },
  WA: { code: 'WA', name: 'Washington Healthplanfinder', url: 'https://www.wahealthplanfinder.org' },
}

// Nombres completos → códigos (el CRM guarda el estado como "Georgia", no "GA").
// Están los 50 estados + DC: si faltara alguno, la normalización devolvería el
// nombre completo y fallarían tanto la detección de mercado como la de Medicaid.
const NAME_TO_CODE: Record<string, string> = {
  'alabama': 'AL', 'alaska': 'AK', 'arizona': 'AZ', 'arkansas': 'AR', 'california': 'CA',
  'colorado': 'CO', 'connecticut': 'CT', 'delaware': 'DE', 'florida': 'FL', 'georgia': 'GA',
  'hawaii': 'HI', 'idaho': 'ID', 'illinois': 'IL', 'indiana': 'IN', 'iowa': 'IA',
  'kansas': 'KS', 'kentucky': 'KY', 'louisiana': 'LA', 'maine': 'ME', 'maryland': 'MD',
  'massachusetts': 'MA', 'michigan': 'MI', 'minnesota': 'MN', 'mississippi': 'MS',
  'missouri': 'MO', 'montana': 'MT', 'nebraska': 'NE', 'nevada': 'NV',
  'new hampshire': 'NH', 'new jersey': 'NJ', 'new mexico': 'NM', 'new york': 'NY',
  'north carolina': 'NC', 'north dakota': 'ND', 'ohio': 'OH', 'oklahoma': 'OK',
  'oregon': 'OR', 'pennsylvania': 'PA', 'rhode island': 'RI', 'south carolina': 'SC',
  'south dakota': 'SD', 'tennessee': 'TN', 'texas': 'TX', 'utah': 'UT', 'vermont': 'VT',
  'virginia': 'VA', 'washington': 'WA', 'west virginia': 'WV', 'wisconsin': 'WI',
  'wyoming': 'WY', 'district of columbia': 'DC', 'washington dc': 'DC',
}

// Normaliza "GA", "ga", "Georgia" → "GA".
export function stateCode(state?: string | null): string {
  const s = (state || '').trim()
  if (!s) return ''
  if (s.length === 2) return s.toUpperCase()
  return NAME_TO_CODE[s.toLowerCase()] || s.toUpperCase()
}

// Devuelve el mercado propio del estado, o null si usa el Mercado federal.
export function getStateMarketplace(state?: string | null): StateMarketplace | null {
  const code = stateCode(state)
  return code ? (STATE_MARKETPLACES[code] ?? null) : null
}

// ── Expansión de Medicaid ────────────────────────────────────────────────────
// En los estados que NO expandieron Medicaid, quien está por DEBAJO del 100%
// del FPL normalmente NO califica ni para Medicaid ni para el subsidio: cae en
// la llamada "brecha de cobertura". Distinguirlo evita decirle al cliente que
// "califica para Medicaid" cuando en realidad no tiene opciones subsidiadas.
const NON_EXPANSION_STATES = ['AL', 'FL', 'GA', 'KS', 'MS', 'SC', 'TN', 'TX', 'WI', 'WY']

export function isMedicaidExpansionState(state?: string | null): boolean {
  const code = stateCode(state)
  if (!code) return true // sin dato: se asume expansión (comportamiento anterior)
  return !NON_EXPANSION_STATES.includes(code)
}
