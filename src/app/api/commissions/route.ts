import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

const DEFAULT_RATES: Record<string, number> = {
  'Blue Cross Blue Shield': 25, 'UnitedHealthcare': 18, 'Oscar': 18, 'Ambetter': 18,
  'Cigna': 20, 'Aetna': 18, 'CareSource': 19, 'AmeriHealth': 20, 'Molina': 18,
  'Anthem': 20, 'Kaiser': 18, 'Alliant': 18, 'AvMed': 18, 'Health Spring': 18,
  'Health First': 18, 'Florida Blue': 18,
}

/**
 * Commission payment logic:
 *   - Policy activation = 1st day of month AFTER contractDate
 *     e.g. contracted 06/15 → activates 07/01
 *   - First commission payment = activation + N months, donde N
 *     ("monthsToFirstPayment") es configurable por aseguradora (por defecto 2).
 *     e.g. activates 07/01 → first payment 09/01 (N=2)
 *
 *   - Si un cliente cambió de aseguradora a mitad de póliza (ver
 *     InsurerHistory), cada "tramo" (stint) con una aseguradora se trata
 *     igual: el reloj de "primera comisión" se reinicia desde el inicio del
 *     tramo, usando el N configurado para esa aseguradora.
 */
function getActivationDate(contractDate: Date | null): Date | null {
  if (!contractDate) return null
  const d = new Date(contractDate)
  // 1st day of the following month
  return new Date(d.getUTCFullYear(), d.getUTCMonth() + 1, 1)
}

// Un "tramo" (stint) representa un período continuo durante el cual un
// cliente estuvo con una aseguradora específica. endDate === null significa
// "aseguradora actual" (sin fecha de fin todavía).
type Stint = { insurer: string; startDate: Date; endDate: Date | null }

function buildStints(
  insurer: string,
  contractDate: Date | null,
  history: { insurer: string; startDate: Date; endDate: Date | null }[]
): Stint[] {
  if (history.length === 0) {
    const activation = getActivationDate(contractDate)
    if (!activation) return []
    return [{ insurer, startDate: activation, endDate: null }]
  }
  const sorted = [...history]
    .sort((a, b) => a.startDate.getTime() - b.startDate.getTime())
    .map(h => ({ insurer: h.insurer, startDate: new Date(h.startDate), endDate: h.endDate ? new Date(h.endDate) : null }))

  // Si el último tramo registrado ya terminó, completar el resto del
  // historial con la aseguradora ACTUAL del cliente (client.insurer) a
  // partir del mes siguiente — así el agente solo necesita registrar el(los)
  // tramo(s) anterior(es) y no uno "actual" cada vez.
  const last = sorted[sorted.length - 1]
  if (last.endDate) {
    const nextStart = new Date(last.endDate.getFullYear(), last.endDate.getMonth() + 1, 1)
    sorted.push({ insurer, startDate: nextStart, endDate: null })
  }
  return sorted
}

// ¿Este tramo cubre el mes que empieza en `periodStart` (1ro del mes)?
function stintCovers(stint: Stint, periodStart: Date): boolean {
  if (stint.startDate > periodStart) return false
  if (stint.endDate && stint.endDate < periodStart) return false
  return true
}

function getStintFirstPaymentDate(stint: Stint, monthsMap: Record<string, number>): Date {
  const months = monthsMap[stint.insurer] ?? 2
  return new Date(stint.startDate.getFullYear(), stint.startDate.getMonth() + months, 1)
}

/**
 * Washington National (WN) ancillary-policy commission logic — completely
 * separate from the ACA/PMPM commission tracking above:
 *   - Commission = 30% of the policy's ANNUALIZED monthly premium, paid ONCE
 *     (not per renewal). e.g. $100/mo → $1,200/yr → $360 commission.
 *   - 75% of that ($270) is paid up front, right when the policy is submitted.
 *   - The remaining 25% ($90) is paid after the client has had the policy
 *     active for 8 months.
 *   - Clawback: if the client cancels BEFORE completing 7 months active, the
 *     agent must return the 75% already received and forfeits the 25%.
 *     Reaching month 7 makes the 75% safe (no clawback risk anymore).
 */
function monthsBetween(start: Date, end: Date): number {
  let months = (end.getFullYear() - start.getFullYear()) * 12 + (end.getMonth() - start.getMonth())
  if (end.getDate() < start.getDate()) months -= 1
  return Math.max(months, 0)
}

function addMonths(d: Date, n: number): Date {
  return new Date(d.getFullYear(), d.getMonth() + n, d.getDate())
}

export async function GET(request: NextRequest) {
  const today = new Date()
  const { searchParams } = new URL(request.url)
  const period = searchParams.get('period') || today.toISOString().slice(0, 7) // "YYYY-MM"

  const [clients, wnClientsRaw, storedRates, payments, checks, insurerHistoryRows] = await Promise.all([
    prisma.client.findMany({
      where: { status: 'Activo' },
      select: {
        id: true, fullName: true, insurer: true,
        affiliatesCount: true, applicantInPolicy: true,
        acaPrice: true, wnPolicies: true, totalMonthly: true,
        contractDate: true,
      },
    }),
    // Washington National tracking needs to see cancelled clients too (clawback risk)
    prisma.client.findMany({
      where: { wnPolicies: { not: null } },
      select: {
        id: true, fullName: true, insurer: true, status: true,
        wnPolicies: true, contractDate: true, wnContractDate: true,
        cancellationDate: true, wnSecondPaymentReceived: true, wnClawbackReturned: true,
      },
    }),
    prisma.commissionRate.findMany(),
    prisma.commissionPayment.findMany({ orderBy: [{ period: 'desc' }, { receivedDate: 'desc' }] }),
    prisma.commissionCheck.findMany({ where: { period } }),
    prisma.insurerHistory.findMany(),
  ])

  // Build rates map
  const ratesMap: Record<string, number> = { ...DEFAULT_RATES }
  const paymentDayMap: Record<string, number | null> = {}
  const monthsMap: Record<string, number> = {}
  for (const r of storedRates) {
    ratesMap[r.insurer] = r.pmpm
    paymentDayMap[r.insurer] = r.paymentDay ?? null
    monthsMap[r.insurer] = r.monthsToFirstPayment ?? 2
  }

  // Group insurer-change history by client and build "stints" — continuous
  // periods with a single insurer (see buildStints / Stint above). Used both
  // for the current commission status and for per-period reconciliation.
  const historyByClient: Record<string, { insurer: string; startDate: Date; endDate: Date | null }[]> = {}
  for (const h of insurerHistoryRows) {
    if (!historyByClient[h.clientId]) historyByClient[h.clientId] = []
    historyByClient[h.clientId].push({ insurer: h.insurer, startDate: new Date(h.startDate), endDate: h.endDate ? new Date(h.endDate) : null })
  }
  const stintsByClient: Record<string, Stint[]> = {}
  for (const c of clients) {
    const insurer = c.insurer || 'Desconocida'
    const contractDate = c.contractDate ? new Date(c.contractDate) : null
    stintsByClient[c.id] = buildStints(insurer, contractDate, historyByClient[c.id] || [])
  }

  const clientRows = clients.map(c => {
    const insurer = c.insurer || 'Desconocida'
    const pmpm = ratesMap[insurer] ?? 18
    const rawCount = c.affiliatesCount ?? 1
    const lives = c.applicantInPolicy === false ? Math.max(rawCount - 1, 0) : rawCount

    // ACA commission
    const acaCommission = pmpm * lives

    // Ancillary (Washington National / WN) monthly premium — shown for reference
    // only here; its commission is computed & tracked separately (see wnSummary)
    // because WN pays a one-time 30%-of-annualized commission on a different
    // schedule, not a recurring monthly amount.
    let wnMonthly = 0
    if (c.wnPolicies) {
      try {
        const policies = JSON.parse(c.wnPolicies)
        if (Array.isArray(policies)) {
          wnMonthly = policies.reduce((sum: number, p: { monthly?: string | number }) => sum + (parseFloat(String(p.monthly)) || 0), 0)
        }
      } catch { /* ignore */ }
    }

    // Payment dates — basados en el tramo (stint) ACTUAL del cliente con su
    // aseguradora actual (ver buildStints). Si el cliente cambió de
    // aseguradora a mitad de póliza, el "reloj" de primera comisión se
    // reinicia desde el inicio de ese tramo, usando el N de meses
    // configurado para esa aseguradora.
    const contractDate = c.contractDate ? new Date(c.contractDate) : null
    const stints = stintsByClient[c.id] || []
    const currentStint = stints.length > 0 ? stints[stints.length - 1] : null
    const activationDate = currentStint ? currentStint.startDate : getActivationDate(contractDate)
    const firstPaymentDate = currentStint ? getStintFirstPaymentDate(currentStint, monthsMap) : null
    const status: 'active' | 'pending' | 'unknown' = !firstPaymentDate ? 'unknown' : (today >= firstPaymentDate ? 'active' : 'pending')

    // Days until first payment
    const daysUntilPayment = firstPaymentDate
      ? Math.ceil((firstPaymentDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24))
      : null

    return {
      id: c.id,
      fullName: c.fullName,
      insurer,
      lives,
      pmpm,
      acaMonthly: c.acaPrice ?? 0,
      wnMonthly,
      totalMonthly: (c.acaPrice ?? 0) + wnMonthly,
      acaCommission,
      // NOTE: Washington National (WN) ancillary commissions are tracked
      // entirely separately (see wnSummary) and intentionally EXCLUDED from
      // "totalCommission" — WN pays a one-time 30%-of-annualized-premium
      // commission on its own schedule, not a recurring PMPM-style amount.
      totalCommission: acaCommission,
      contractDate: contractDate?.toISOString() ?? null,
      activationDate: activationDate?.toISOString() ?? null,
      firstPaymentDate: firstPaymentDate?.toISOString() ?? null,
      commissionStatus: status,
      daysUntilPayment,
    }
  })

  // Separate active vs pending commissions
  const activeRows  = clientRows.filter(c => c.commissionStatus === 'active')
  const pendingRows = clientRows.filter(c => c.commissionStatus === 'pending')

  const totalActiveMonthly  = activeRows.reduce((s, c) => s + c.totalCommission, 0)
  const totalPendingMonthly = pendingRows.reduce((s, c) => s + c.totalCommission, 0)

  // Group by insurer (active only for real totals)
  // NOTE: WN/ancillary commissions are tracked completely separately (see `wn`
  // below) and are intentionally EXCLUDED from these per-insurer figures —
  // Washington National pays on a different schedule/structure (TBD), so mixing it in
  // here would distort the PMPM-based numbers (e.g. Oscar should read
  // lives × $25 only, not lives × $25 + WN extras).
  const insurerMap: Record<string, { insurer: string; lives: number; pmpm: number; paymentDay: number | null; monthly: number; annual: number }> = {}
  for (const c of activeRows) {
    if (!insurerMap[c.insurer]) insurerMap[c.insurer] = { insurer: c.insurer, lives: 0, pmpm: c.pmpm, paymentDay: paymentDayMap[c.insurer] ?? null, monthly: 0, annual: 0 }
    insurerMap[c.insurer].lives += c.lives
    insurerMap[c.insurer].monthly += c.acaCommission
    insurerMap[c.insurer].annual += c.acaCommission * 12
  }

  // ── Washington National (WN) ancillary commissions ──────────────────────────
  // Tracked completely separately — NOT included in any total above. One-time
  // 30%-of-annualized-premium commission, paid 75% up front + 25% after month 8,
  // with clawback risk if the client cancels before month 7. See helpers above.
  const wnClients = wnClientsRaw
    .map(c => {
      let wnMonthly = 0
      if (c.wnPolicies) {
        try {
          const policies = JSON.parse(c.wnPolicies)
          if (Array.isArray(policies)) {
            wnMonthly = policies.reduce((sum: number, p: { monthly?: string | number }) => sum + (parseFloat(String(p.monthly)) || 0), 0)
          }
        } catch { /* ignore */ }
      }
      if (wnMonthly <= 0) return null

      const annualized = wnMonthly * 12
      const totalCommission = annualized * 0.30
      const firstPayment = totalCommission * 0.75
      const secondPayment = totalCommission * 0.25

      // WN's own contract date can differ from the ACA contractDate (the WN
      // ancillary policy is often added later) — prefer wnContractDate when set.
      const wnStartDate = c.wnContractDate ? new Date(c.wnContractDate) : (c.contractDate ? new Date(c.contractDate) : null)
      const cancellationDate = c.cancellationDate ? new Date(c.cancellationDate) : null
      const isCancelled = c.status === 'Cancelado'
      // For cancelled clients, count months up to the cancellation date (when
      // known) instead of "today" — using "today" would overcount and make a
      // genuinely-at-risk cancellation look "safe".
      const monthsActiveEnd = isCancelled ? (cancellationDate ?? today) : today
      const monthsActive = wnStartDate ? monthsBetween(wnStartDate, monthsActiveEnd) : null
      const clawbackSafeDate = wnStartDate ? addMonths(wnStartDate, 7) : null
      const secondPaymentDate = wnStartDate ? addMonths(wnStartDate, 8) : null

      const clawbackSafe = monthsActive !== null && monthsActive >= 7
      // Manual confirmation always wins; otherwise infer from the date-based
      // schedule. Note: monthsActive is computed up to the cancellation date
      // for cancelled clients, so "active >= 8 months before cancelling" is
      // still correctly recognized as having earned the second payment.
      const secondPaymentReceived = c.wnSecondPaymentReceived === true
        || (monthsActive !== null && monthsActive >= 8)
      // If cancelled before reaching month 8 (and not manually marked as
      // received), the 25% second payment is forfeited per WN's rules.
      const secondPaymentForfeited = isCancelled && !secondPaymentReceived

      // Risk flag: only meaningful while the policy is still active and hasn't
      // reached the 7-month safety mark yet — OR if it was already cancelled
      // before reaching that mark (needs manual review: did we already return
      // the 75%? — see wnClawbackReturned).
      let riskStatus: 'safe' | 'at_risk' | 'needs_review'
      if (isCancelled) {
        riskStatus = clawbackSafe ? 'safe' : (c.wnClawbackReturned ? 'safe' : 'needs_review')
      } else {
        riskStatus = clawbackSafe ? 'safe' : 'at_risk'
      }

      return {
        id: c.id,
        fullName: c.fullName,
        insurer: c.insurer || 'Desconocida',
        status: c.status,
        wnMonthly,
        annualized,
        totalCommission,
        firstPayment,
        secondPayment,
        wnStartDate: wnStartDate?.toISOString() ?? null,
        cancellationDate: cancellationDate?.toISOString() ?? null,
        monthsActive,
        clawbackSafeDate: clawbackSafeDate?.toISOString() ?? null,
        secondPaymentDate: secondPaymentDate?.toISOString() ?? null,
        secondPaymentReceived,
        secondPaymentForfeited,
        wnSecondPaymentReceivedManual: c.wnSecondPaymentReceived === true,
        wnClawbackReturned: c.wnClawbackReturned === true,
        riskStatus,
      }
    })
    .filter((c): c is NonNullable<typeof c> => c !== null)

  const wnSummary = {
    note: 'Comisión de Washington National (WN): pago único = 30% de la prima anualizada, 75% al someter la póliza y 25% restante tras el mes 8 de póliza activa. Si el cliente cancela antes del mes 7, se debe regresar el 75% recibido y se pierde el 25% restante. Estos montos NO están incluidos en ninguna cifra de arriba — se calculan y pagan por separado.',
    pendingSecondPayments: wnClients.filter(c => !c.secondPaymentReceived && !c.secondPaymentForfeited && c.riskStatus !== 'needs_review').reduce((s, c) => s + c.secondPayment, 0),
    atRiskAmount: wnClients.filter(c => c.riskStatus === 'at_risk').reduce((s, c) => s + c.firstPayment, 0),
    clients: wnClients,
  }

  // ── Pagos de comisión recibidos (registro manual) ───────────────────────────
  // Compara lo efectivamente cobrado contra lo proyectado (PMPM × vidas actual)
  // por aseguradora, agrupado por período (mes que cubre el pago).
  const expectedByInsurer: Record<string, number> = {}
  for (const r of Object.values(insurerMap)) expectedByInsurer[r.insurer] = r.monthly

  type PaymentItem = { id: string; insurer: string; amount: number; expected: number; receivedDate: string; notes: string | null }
  const periodMap: Record<string, { period: string; total: number; items: PaymentItem[] }> = {}
  for (const p of payments) {
    if (!periodMap[p.period]) periodMap[p.period] = { period: p.period, total: 0, items: [] }
    periodMap[p.period].total += p.amount
    periodMap[p.period].items.push({
      id: p.id,
      insurer: p.insurer,
      amount: p.amount,
      expected: expectedByInsurer[p.insurer] ?? 0,
      receivedDate: p.receivedDate.toISOString(),
      notes: p.notes,
    })
  }

  const paymentsSummary = {
    totalReceived: payments.reduce((s, p) => s + p.amount, 0),
    byPeriod: Object.values(periodMap).sort((a, b) => b.period.localeCompare(a.period)),
  }

  // ── Conciliación de comisiones ──────────────────────────────────────────
  // Para el período seleccionado, determina qué clientes ya deberían estar
  // generando comisión (firstPaymentDate <= fin del período) y compara contra
  // las marcas manuales de "recibido" (CommissionCheck) y los pagos globales
  // registrados por aseguradora (CommissionPayment) para detectar a quién le
  // falta el pago.
  const [pYear, pMon] = period.split('-').map(Number)
  const periodStart = new Date(pYear, pMon - 1, 1)
  const periodEnd = new Date(pYear, pMon, 0, 23, 59, 59)
  const checkedSet = new Set(checks.filter(c => c.received).map(c => c.clientId))

  const paymentsForPeriodByInsurer: Record<string, number> = {}
  for (const p of payments) {
    if (p.period !== period) continue
    paymentsForPeriodByInsurer[p.insurer] = (paymentsForPeriodByInsurer[p.insurer] ?? 0) + p.amount
  }

  type ReconciliationClient = { id: string; fullName: string; lives: number; pmpm: number; expected: number; received: boolean }
  type ReconciliationInsurer = {
    insurer: string
    expectedTotal: number
    confirmedTotal: number
    missingTotal: number
    paymentReceived: number
    clients: ReconciliationClient[]
  }
  const reconciliationMap: Record<string, ReconciliationInsurer> = {}

  // Para cada cliente, se busca el tramo (stint) que cubre el período
  // seleccionado — así, si cambió de aseguradora a mitad de póliza, su
  // comisión de ese mes se atribuye a la aseguradora que aplicaba EN ESE
  // MES, no a la aseguradora actual del cliente.
  for (const c of clientRows) {
    const stints = stintsByClient[c.id] || []
    const stint = stints.find(s => stintCovers(s, periodStart))
    if (!stint) continue
    const firstPay = getStintFirstPaymentDate(stint, monthsMap)
    if (firstPay > periodEnd) continue

    const stintInsurer = stint.insurer
    const stintPmpm = ratesMap[stintInsurer] ?? 18
    const expected = stintPmpm * c.lives

    if (!reconciliationMap[stintInsurer]) {
      reconciliationMap[stintInsurer] = {
        insurer: stintInsurer, expectedTotal: 0, confirmedTotal: 0, missingTotal: 0,
        paymentReceived: paymentsForPeriodByInsurer[stintInsurer] ?? 0, clients: [],
      }
    }
    const received = checkedSet.has(c.id)
    const row = reconciliationMap[stintInsurer]
    row.expectedTotal += expected
    if (received) row.confirmedTotal += expected
    row.clients.push({ id: c.id, fullName: c.fullName, lives: c.lives, pmpm: stintPmpm, expected, received })
  }

  for (const r of Object.values(reconciliationMap)) {
    r.missingTotal = r.expectedTotal - r.confirmedTotal
    r.clients.sort((a, b) => Number(a.received) - Number(b.received) || a.fullName.localeCompare(b.fullName))
  }

  const reconciliationInsurers = Object.values(reconciliationMap).sort((a, b) => b.expectedTotal - a.expectedTotal)
  const reconciliation = {
    period,
    insurers: reconciliationInsurers,
    totalExpected: reconciliationInsurers.reduce((s, r) => s + r.expectedTotal, 0),
    totalConfirmed: reconciliationInsurers.reduce((s, r) => s + r.confirmedTotal, 0),
    totalMissing: reconciliationInsurers.reduce((s, r) => s + r.missingTotal, 0),
    totalPaymentReceived: reconciliationInsurers.reduce((s, r) => s + r.paymentReceived, 0),
  }

  return NextResponse.json({
    summary: {
      totalMonthlyCommission: totalActiveMonthly,
      totalAnnualCommission: totalActiveMonthly * 12,
      totalPendingMonthly,
      totalLives: activeRows.reduce((s, c) => s + c.lives, 0),
      activeCount: activeRows.length,
      pendingCount: pendingRows.length,
      byInsurer: Object.values(insurerMap).sort((a, b) => b.monthly - a.monthly),
      wn: wnSummary,
      payments: paymentsSummary,
      reconciliation,
    },
    clients: clientRows.sort((a, b) => {
      // Active first, then pending sorted by days until payment
      if (a.commissionStatus === 'active' && b.commissionStatus !== 'active') return -1
      if (b.commissionStatus === 'active' && a.commissionStatus !== 'active') return 1
      return (a.daysUntilPayment ?? 0) - (b.daysUntilPayment ?? 0)
    }),
  })
}
