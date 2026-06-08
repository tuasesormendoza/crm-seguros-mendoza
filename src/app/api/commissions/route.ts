import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

const DEFAULT_RATES: Record<string, number> = {
  'Oscar': 18, 'Ambetter': 18, 'Cigna': 20, 'Kaiser': 18,
  'Blue Cross Blue Shield': 25, 'UnitedHealthcare': 18, 'Molina': 18,
  'CareSource': 19, 'Anthem': 20, 'Alliant': 18, 'AmeriHealth': 20,
  'Health Spring': 18, 'Florida Blue': 18,
}

/**
 * Commission payment logic:
 *   - Policy activation = 1st day of month AFTER contractDate
 *     e.g. contracted 06/15 → activates 07/01
 *   - First commission payment = activation + 2 months
 *     e.g. activates 07/01 → first payment 09/01
 */
function getActivationDate(contractDate: Date | null): Date | null {
  if (!contractDate) return null
  const d = new Date(contractDate)
  // 1st day of the following month
  return new Date(d.getUTCFullYear(), d.getUTCMonth() + 1, 1)
}

function getFirstPaymentDate(contractDate: Date | null): Date | null {
  const activation = getActivationDate(contractDate)
  if (!activation) return null
  // 2 months after activation
  return new Date(activation.getFullYear(), activation.getMonth() + 2, 1)
}

function commissionStatus(contractDate: Date | null): 'active' | 'pending' | 'unknown' {
  const firstPayment = getFirstPaymentDate(contractDate)
  if (!firstPayment) return 'unknown'
  return new Date() >= firstPayment ? 'active' : 'pending'
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

export async function GET() {
  const today = new Date()

  const [clients, wnClientsRaw, storedRates] = await Promise.all([
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
  ])

  // Build rates map
  const ratesMap: Record<string, number> = { ...DEFAULT_RATES }
  const paymentDayMap: Record<string, number | null> = {}
  for (const r of storedRates) {
    ratesMap[r.insurer] = r.pmpm
    paymentDayMap[r.insurer] = r.paymentDay ?? null
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

    // Payment dates
    const contractDate = c.contractDate ? new Date(c.contractDate) : null
    const activationDate = getActivationDate(contractDate)
    const firstPaymentDate = getFirstPaymentDate(contractDate)
    const status = commissionStatus(contractDate)

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
    },
    clients: clientRows.sort((a, b) => {
      // Active first, then pending sorted by days until payment
      if (a.commissionStatus === 'active' && b.commissionStatus !== 'active') return -1
      if (b.commissionStatus === 'active' && a.commissionStatus !== 'active') return 1
      return (a.daysUntilPayment ?? 0) - (b.daysUntilPayment ?? 0)
    }),
  })
}
