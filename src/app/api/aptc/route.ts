import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getAuth } from '@/lib/auth'
import { getPlatformSettings } from '@/lib/platform'

// ── FPL applicable percentage table (IRS) ─────────────────────────────────────
const APPLICABLE_PCT: [number, number, number][] = [
  [0,    100,  0],     // Medicaid range — no APTC
  [100,  133,  0],
  [133,  150,  0],
  [150,  200,  2],
  [200,  250,  4],
  [250,  300,  6],
  [300,  400,  8.5],
  [400, 9999,  8.5],   // Rescue Plan Act extension
]

function getApplicablePct(fplPct: number): number {
  for (const [min, max, pct] of APPLICABLE_PCT) {
    if (fplPct >= min && fplPct < max) return pct
  }
  return 8.5
}

export async function POST(request: NextRequest) {
  const auth = await getAuth()
  if (auth instanceof NextResponse) return auth

  const { zipcode, income, householdSize, age, ages, year, state } = await request.json()

  if (!zipcode || !income || !age) {
    return NextResponse.json({ error: 'ZIP code, ingreso y edad son requeridos' }, { status: 400 })
  }

  // CMS API Key y valores FPL son de PLATAFORMA (globales, del dueño del CRM).
  // El modo de orden de "mejores planes" sí es de cada agencia.
  const [rankRow, platform] = await Promise.all([
    prisma.settings.findFirst({ where: { agencyId: auth.agencyId, key: 'bestPlansRankMode' }, select: { value: true } }),
    getPlatformSettings(['cmsApiKey', 'fpl1Person', 'fplPerPerson', 'fplYear']),
  ])

  const cmsApiKey = platform.cmsApiKey || ''
  const fpl1 = Number(platform.fpl1Person || 15650)
  const fplPer = Number(platform.fplPerPerson || 5500)
  const planYear = year || platform.fplYear || '2026'
  const rankMode = rankRow?.value === 'cheapest' ? 'cheapest' : 'protection'
  const size = parseInt(householdSize) || 1
  const annualIncome = parseFloat(income)
  const clientAge = parseInt(age)

  // ── FPL calculation ──────────────────────────────────────────────────────────
  const fplThreshold = fpl1 + fplPer * (size - 1)
  const fplPct = (annualIncome / fplThreshold) * 100
  const applicablePct = getApplicablePct(fplPct)
  const maxClientPayYear = annualIncome * (applicablePct / 100)
  const maxClientPayMonth = maxClientPayYear / 12

  // ── Eligibility checks ───────────────────────────────────────────────────────
  const qualifiesMedicaid = fplPct > 0 && fplPct < 100
  const qualifiesAPTC = fplPct >= 100
  const qualifiesCSR = fplPct >= 100 && fplPct <= 250

  // ── CMS API call for exact SLCSP ─────────────────────────────────────────────
  let slcspMonthly: number | null = null
  let slcspPremiumWCredit: number | null = null
  let slcspPlanName: string | null = null
  let bestPlans: {
    id: string; name: string; issuer: string | null; metalLevel: string; type: string
    premium: number; premiumWCredit: number; deductible: number | null; moop: number | null
    hsaEligible: boolean
    primaryCare: string | null; specialist: string | null; urgentCare: string | null
    emergencyRoom: string | null; genericDrugs: string | null
    worstCaseAnnual: number
  }[] = []
  let cmsError: string | null = null
  let dataSource = 'estimated'

  if (cmsApiKey && qualifiesAPTC) {
    try {
      // Step 1: Get county FIPS from ZIP code (required by CMS API)
      let countyFips = ''
      let stateAbbr = state?.trim().toUpperCase() || ''

      const countyRes = await fetch(
        `https://marketplace.api.healthcare.gov/api/v1/counties/by/zip/${zipcode.trim()}?apikey=${cmsApiKey}`,
        { signal: AbortSignal.timeout(6000) }
      ).catch(() => null)

      if (countyRes?.ok) {
        const countyData = await countyRes.json()
        const counties = countyData.counties || countyData
        if (Array.isArray(counties) && counties.length > 0) {
          countyFips = counties[0].fips || counties[0].county_fips || ''
          if (!stateAbbr) stateAbbr = counties[0].state || ''
        }
      }

      // Step 2: Build household for CMS API — use the real ages provided for
      // each member (premiums are age-rated, so guessing them skews the result)
      const memberAges: number[] = Array.isArray(ages) && ages.length === size
        ? ages.map((a: number) => parseInt(String(a)) || clientAge)
        : Array.from({ length: size }, (_, i) => i === 0 ? clientAge : clientAge)

      const people = memberAges.map((personAge) => ({
        age: personAge,
        aptc_eligible: true,
        uses_tobacco: false,
        gender: 'Male',
        utilizaton_level: 'medium',
      }))

      const placeObj: Record<string, string> = { zipcode: zipcode.trim(), state: stateAbbr }
      if (countyFips) placeObj.countyfips = countyFips

      type CmsPlan = {
        id: string; premium: number; premium_w_credit?: number; name: string
        metal_level: string; type: string; issuer?: { name?: string }
        deductibles?: { type: string; amount: number; individual?: boolean; family?: boolean; csr?: string }[]
        moops?: { type: string; amount: number; individual?: boolean; family?: boolean; csr?: string }[]
        hsa_eligible?: boolean
        benefits?: {
          type: string
          cost_sharings?: { network_tier: string; display_string: string }[]
        }[]
      }

      const searchPlans = (filter?: Record<string, unknown>) => fetch(
        `https://marketplace.api.healthcare.gov/api/v1/plans/search?apikey=${cmsApiKey}&year=${planYear}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
          body: JSON.stringify({
            household: { income: annualIncome, people },
            market: 'Individual',
            place: placeObj,
            ...(filter ? { filter } : {}),
            order: 'asc',
            sort: 'premium',
            limit: 40,
            offset: 0,
          }),
          signal: AbortSignal.timeout(8000),
        }
      )

      // Two queries: one scoped to Silver (for the official SLCSP benchmark),
      // one unfiltered (to surface the best real options across all metal levels —
      // Silver plans tend to be pricier, so they'd be crowded out of a single list)
      const [silverRes, allRes] = await Promise.all([
        searchPlans({ metal_levels: ['Silver'] }),
        searchPlans(),
      ])

      if (silverRes.ok) {
        const silverData = await silverRes.json()
        const silverPlans: CmsPlan[] = (silverData.plans || [])
          .filter((p: CmsPlan) => p.metal_level?.toLowerCase() === 'silver' && p.premium > 0)
          .sort((a: CmsPlan, b: CmsPlan) => a.premium - b.premium)

        if (silverPlans.length >= 2) {
          slcspMonthly = silverPlans[1].premium   // Second Lowest Cost Silver Plan
          slcspPlanName = silverPlans[1].name
          slcspPremiumWCredit = silverPlans[1].premium_w_credit ?? null
          dataSource = 'cms_exact'
        } else if (silverPlans.length === 1) {
          slcspMonthly = silverPlans[0].premium    // Only one Silver plan available
          slcspPlanName = silverPlans[0].name
          slcspPremiumWCredit = silverPlans[0].premium_w_credit ?? null
          dataSource = 'cms_single'
        } else {
          cmsError = 'No se encontraron planes Silver para este ZIP code en el año seleccionado'
        }
      } else {
        const errBody = await silverRes.text()
        if (silverRes.status === 401 || silverRes.status === 403) {
          cmsError = 'API Key inválida o expirada. Verifica la key en Configuración.'
        } else if (silverRes.status === 404) {
          cmsError = `ZIP code ${zipcode} no encontrado en el Marketplace federal`
        } else if (/effective date/i.test(errBody)) {
          // El Marketplace aún no publica los planes del año consultado (se
          // publican en el otoño anterior). No es un error de configuración.
          cmsError = `El Marketplace todavía no tiene planes publicados para el año ${planYear}. Se muestra un cálculo estimado con promedios nacionales.`
        } else {
          cmsError = `Error CMS API: ${silverRes.status} — ${errBody.slice(0, 120)}`
        }
      }

      if (allRes.ok) {
        const allData = await allRes.json()
        const plans: CmsPlan[] = allData.plans || []

        // ── Best real plans for this client ──────────────────────────────────────
        // Ranked by financial protection, not just monthly price: a $0/mes plan
        // with a $9,200 MOOP can ruin a low-income family if someone gets sick.
        // We rank by "worst-case annual cost" = 12 months of premium + the MOOP
        // ceiling (the most they could ever pay in a year if something serious happens).
        // For multi-person households CMS often has no "individual" entry — only
        // "Family" and "Family Per Person". Fall back to "Family Per Person" so we
        // never under-report a family plan's real per-person exposure as $0/null.
        const pickAmount = (
          entries: { type: string; amount: number; individual?: boolean; family?: boolean }[] | undefined
        ) =>
          entries?.find(e => e.individual && e.type?.includes('Medical and Drug'))?.amount
          ?? entries?.find(e => e.individual)?.amount
          ?? entries?.find(e => !e.individual && !e.family && e.type?.includes('Medical and Drug'))?.amount
          ?? entries?.find(e => !e.individual && !e.family)?.amount
          ?? null
        const pickDeductible = (p: CmsPlan) => pickAmount(p.deductibles)
        const pickMoop = (p: CmsPlan) => pickAmount(p.moops)
        const pickBenefit = (p: CmsPlan, benefitType: string) =>
          p.benefits?.find(b => b.type === benefitType)
            ?.cost_sharings?.find(c => c.network_tier === 'In-Network')
            ?.display_string || null

        bestPlans = plans
          .filter(p => p.premium > 0 && typeof p.premium_w_credit === 'number')
          .map(p => {
            const moop = pickMoop(p)
            const premiumWCredit = Math.round(p.premium_w_credit! * 100) / 100
            return {
              id: p.id,
              name: p.name,
              issuer: p.issuer?.name ?? null,
              metalLevel: p.metal_level,
              type: p.type,
              premium: Math.round(p.premium * 100) / 100,
              premiumWCredit,
              deductible: pickDeductible(p),
              moop,
              hsaEligible: !!p.hsa_eligible,
              primaryCare: pickBenefit(p, 'PRIMARY_CARE_VISIT_TO_TREAT_AN_INJURY_OR_ILLNESS'),
              specialist: pickBenefit(p, 'SPECIALIST_VISIT'),
              urgentCare: pickBenefit(p, 'URGENT_CARE_CENTERS_OR_FACILITIES'),
              emergencyRoom: pickBenefit(p, 'EMERGENCY_ROOM_SERVICES'),
              genericDrugs: pickBenefit(p, 'GENERIC_DRUGS'),
              worstCaseAnnual: Math.round((premiumWCredit * 12 + (moop ?? 0)) * 100) / 100,
            }
          })
          .sort((a, b) => rankMode === 'cheapest'
            ? a.premiumWCredit - b.premiumWCredit
            : a.worstCaseAnnual - b.worstCaseAnnual)
          .slice(0, 5)
      }
    } catch (err) {
      const msg = (err as Error).message
      if (msg.includes('timeout') || msg.includes('abort')) {
        cmsError = 'La API de CMS tardó demasiado. Intenta de nuevo.'
      } else {
        cmsError = `Error de conexión: ${msg.slice(0, 100)}`
      }
    }
  }
  // Sin CMS API Key el cálculo cae a estimados nacionales; no se muestra ningún
  // aviso para "agregar la key" porque es de plataforma (solo el dueño la define).

  // ── Subsidy calculation ───────────────────────────────────────────────────────
  // Use SLCSP from CMS if available, otherwise fall back to national average estimate
  const NATIONAL_AVG_SILVER: Record<number, number> = {
    21: 380, 25: 395, 30: 430, 35: 490, 40: 552, 45: 630,
    50: 745, 55: 895, 60: 1090, 64: 1250,
  }
  function avgSilver(a: number) {
    const keys = Object.keys(NATIONAL_AVG_SILVER).map(Number).sort((x, y) => x - y)
    let c = keys[0]
    for (const k of keys) { if (k <= a) c = k }
    return NATIONAL_AVG_SILVER[c]
  }

  const benchmarkMonthly = slcspMonthly ?? avgSilver(clientAge)

  // Prefer CMS's own post-credit price (premium_w_credit) — it's computed with
  // CMS's exact area-specific rules and matches what cuidadodesalud.gov shows.
  // Our own FPL-table math is only a fallback for the "estimated" (no exact CMS data) case.
  let subsidyMonth: number
  let clientPaysMonth: number
  if (slcspPremiumWCredit !== null && qualifiesAPTC) {
    clientPaysMonth = slcspPremiumWCredit
    subsidyMonth = Math.max(0, benchmarkMonthly - clientPaysMonth)
  } else {
    subsidyMonth = qualifiesAPTC ? Math.max(0, benchmarkMonthly - maxClientPayMonth) : 0
    clientPaysMonth = Math.max(0, benchmarkMonthly - subsidyMonth)
  }

  // ── Plan recommendation ───────────────────────────────────────────────────────
  let planRec = ''
  let planRecReason = ''
  if (fplPct >= 100 && fplPct < 150) {
    planRec = 'Gold o Platinum'
    planRecReason = 'Con subsidio máximo, el plan más completo puede ser muy económico. El costo mensual bajo compensa el mejor acceso médico.'
  } else if (fplPct >= 150 && fplPct < 250) {
    planRec = 'Silver con CSR ⭐'
    planRecReason = 'Califica para Cost-Sharing Reduction (CSR). Con Silver, el gobierno también reduce deducibles y copays — mejor valor real que Bronze o Gold.'
  } else if (fplPct >= 250 && fplPct < 300) {
    planRec = 'Silver o Gold'
    planRecReason = 'Aún tiene buen subsidio. Compara el costo total anual (primas + deducible esperado) entre Silver y Gold.'
  } else if (fplPct >= 300 && fplPct < 400) {
    planRec = 'Silver o Bronze'
    planRecReason = 'Subsidio moderado. Si el cliente es saludable y rara vez usa servicios médicos, Bronze puede ser más económico.'
  } else {
    planRec = 'Bronze'
    planRecReason = 'Con subsido limitado o nulo, Bronze tiene la prima más baja. Útil como cobertura catastrófica.'
  }

  return NextResponse.json({
    // Inputs echoed back
    zipcode, income: annualIncome, householdSize: size, age: clientAge, year: planYear, state,
    // FPL
    fplThreshold, fplPct: Math.round(fplPct * 10) / 10,
    // Eligibility
    qualifiesMedicaid, qualifiesAPTC, qualifiesCSR,
    applicablePct,
    maxClientPayMonth: Math.round(maxClientPayMonth * 100) / 100,
    // SLCSP
    slcspMonthly: slcspMonthly ? Math.round(slcspMonthly * 100) / 100 : null,
    slcspPlanName,
    benchmarkMonthly: Math.round(benchmarkMonthly * 100) / 100,
    dataSource,          // 'cms_exact' | 'cms_single' | 'estimated'
    // Subsidy
    subsidyMonth: Math.round(subsidyMonth * 100) / 100,
    clientPaysMonth: Math.round(clientPaysMonth * 100) / 100,
    subsidyYear: Math.round(subsidyMonth * 12 * 100) / 100,
    // Best real plans available (ranking depends on agent's preferred mode)
    bestPlans,
    bestPlansRankMode: rankMode,
    // Meta
    planRec, planRecReason, cmsError,
  })
}
