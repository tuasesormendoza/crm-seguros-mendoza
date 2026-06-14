import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireRole, COMMISSIONS_ROLES } from '@/lib/auth'
// Lógica pura extraída a un módulo testeable (ver src/lib/commissions.test.ts).
import {
  DEFAULT_RATES,
  getActivationDate,
  buildStints,
  stintCovers,
  getStintFirstPaymentDate,
  normalizeMonthDate,
  monthsBetween,
  addMonths,
  type Stint,
} from '@/lib/commissions'

export async function GET(request: NextRequest) {
  const auth = await requireRole(COMMISSIONS_ROLES)
  if (auth instanceof NextResponse) return auth
  const agencyId = auth.agencyId

  const today = new Date()
  const { searchParams } = new URL(request.url)
  const period = searchParams.get('period') || today.toISOString().slice(0, 7) // "YYYY-MM"
  const [pYear, pMon] = period.split('-').map(Number)
  const periodStart = new Date(pYear, pMon - 1, 1)
  const periodEnd = new Date(pYear, pMon, 0, 23, 59, 59)

  const [clients, wnClientsRaw, storedRates, payments, checks, insurerHistoryRows] = await Promise.all([
    prisma.client.findMany({
      where: { agencyId, status: 'Activo' },
      select: {
        id: true, fullName: true, insurer: true,
        affiliatesCount: true, applicantInPolicy: true,
        acaPrice: true, wnPolicies: true, totalMonthly: true,
        contractDate: true,
        dependents: { select: { name: true } },
      },
    }),
    // Washington National tracking needs to see cancelled clients too (clawback risk)
    prisma.client.findMany({
      where: { agencyId, wnPolicies: { not: null } },
      select: {
        id: true, fullName: true, insurer: true, status: true,
        wnPolicies: true, contractDate: true, wnContractDate: true,
        cancellationDate: true, wnSecondPaymentReceived: true, wnClawbackReturned: true,
      },
    }),
    prisma.commissionRate.findMany({ where: { agencyId } }),
    prisma.commissionPayment.findMany({ where: { agencyId }, orderBy: [{ period: 'desc' }, { receivedDate: 'desc' }] }),
    prisma.commissionCheck.findMany({ where: { agencyId, period } }),
    prisma.insurerHistory.findMany({ where: { agencyId } }),
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
    historyByClient[h.clientId].push({ insurer: h.insurer, startDate: normalizeMonthDate(new Date(h.startDate)), endDate: h.endDate ? normalizeMonthDate(new Date(h.endDate)) : null })
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

    // Comisión esperada para el PERÍODO que se está conciliando — usa la
    // aseguradora que aplicaba ESE mes (tramo/stint), no necesariamente la
    // actual del cliente. Así, al conciliar un estado de cuenta de Oscar de un
    // mes en que el cliente todavía estaba con Oscar (aunque hoy ya esté en
    // Ambetter), "Esperado" usa el pmpm de Oscar y no el de Ambetter.
    const periodStint = (stintsByClient[c.id] || []).find(s => stintCovers(s, periodStart))
    const periodPmpm = periodStint ? (ratesMap[periodStint.insurer] ?? 18) : pmpm
    const expectedForPeriod = periodPmpm * lives

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
      expectedForPeriod,
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
      // Nombres de dependientes — usados como alias al importar estados de cuenta
      // (el mercado a veces lista a un dependiente en una línea aparte).
      dependentNames: (c.dependents ?? []).map(d => d.name).filter((n): n is string => !!n),
      // TODAS las aseguradoras que ha tenido el cliente (actual + historial), para
      // que al importar el estado de cuenta de una aseguradora también aparezcan
      // los clientes que se cambiaron de aseguradora a mitad de póliza.
      insurers: stints.length ? [...new Set(stints.map(s => s.insurer))] : [insurer],
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
  // Compara lo efectivamente cobrado contra lo proyectado por aseguradora,
  // agrupado por período (mes que cubre el pago).
  //
  // El "proyectado" de cada pago se calcula usando el tramo (stint) del
  // Historial de Aseguradoras vigente para EL MES QUE CUBRE ESE PAGO — no la
  // aseguradora actual del cliente. Así, si un cliente luego cambió de
  // aseguradora, el pago histórico sigue comparándose contra lo que
  // correspondía cobrar de la aseguradora que lo cubría en ese momento.
  function expectedTotalsForPeriod(pStart: Date): Record<string, number> {
    const totals: Record<string, number> = {}
    for (const c of clientRows) {
      const stints = stintsByClient[c.id] || []
      const stint = stints.find(s => stintCovers(s, pStart))
      if (!stint) continue
      const stintPmpm = ratesMap[stint.insurer] ?? 18
      totals[stint.insurer] = (totals[stint.insurer] ?? 0) + stintPmpm * c.lives
    }
    return totals
  }

  const expectedTotalsByPeriod: Record<string, Record<string, number>> = {}

  type PaymentClientItem = { clientId: string | null; name: string; amount: number }
  type PaymentItem = { id: string; insurer: string; amount: number; expected: number; receivedDate: string; notes: string | null; clients: PaymentClientItem[] }
  const periodMap: Record<string, { period: string; total: number; items: PaymentItem[] }> = {}
  for (const p of payments) {
    if (!periodMap[p.period]) periodMap[p.period] = { period: p.period, total: 0, items: [] }
    periodMap[p.period].total += p.amount
    let clientItems: PaymentClientItem[] = []
    if (p.items) {
      try { const parsed = JSON.parse(p.items); if (Array.isArray(parsed)) clientItems = parsed } catch { /* ignore */ }
    }
    if (!expectedTotalsByPeriod[p.period]) {
      const [py, pm] = p.period.split('-').map(Number)
      const pStart = new Date(py, pm - 1, 1)
      expectedTotalsByPeriod[p.period] = expectedTotalsForPeriod(pStart)
    }
    periodMap[p.period].items.push({
      id: p.id,
      insurer: p.insurer,
      amount: p.amount,
      expected: expectedTotalsByPeriod[p.period][p.insurer] ?? 0,
      receivedDate: p.receivedDate.toISOString(),
      notes: p.notes,
      clients: clientItems,
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
  const checkedSet = new Set(checks.filter(c => c.received).map(c => c.clientId))
  // Motivo del faltante por cliente (cuando se registró que NO está en el pago).
  const gapReasonByClient = new Map<string, string>()
  for (const c of checks) { if (!c.received && c.gapReason) gapReasonByClient.set(c.clientId, c.gapReason) }

  const paymentsForPeriodByInsurer: Record<string, number> = {}
  for (const p of payments) {
    if (p.period !== period) continue
    paymentsForPeriodByInsurer[p.insurer] = (paymentsForPeriodByInsurer[p.insurer] ?? 0) + p.amount
  }

  type ReconciliationClient = { id: string; fullName: string; lives: number; pmpm: number; expected: number; received: boolean; gapReason: string | null }
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
    row.clients.push({ id: c.id, fullName: c.fullName, lives: c.lives, pmpm: stintPmpm, expected, received, gapReason: gapReasonByClient.get(c.id) ?? null })
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
