'use client'

import { useEffect, useState, useCallback } from 'react'
import { formatCurrency } from '@/lib/utils'
import { useRole } from '@/hooks/useRole'
import AccessDenied from '@/components/AccessDenied'
import StatementImport from '@/components/StatementImport'

interface InsurerSummary {
  insurer: string
  lives: number
  pmpm: number
  paymentDay: number | null
  monthly: number
  annual: number
}

interface WnClientRow {
  id: string
  fullName: string
  insurer: string
  status: string
  wnMonthly: number
  annualized: number
  totalCommission: number
  firstPayment: number
  secondPayment: number
  wnStartDate: string | null
  cancellationDate: string | null
  monthsActive: number | null
  clawbackSafeDate: string | null
  secondPaymentDate: string | null
  secondPaymentReceived: boolean
  secondPaymentForfeited: boolean
  wnSecondPaymentReceivedManual: boolean
  wnClawbackReturned: boolean
  riskStatus: 'safe' | 'at_risk' | 'needs_review'
}

interface WnSummary {
  note: string
  pendingSecondPayments: number
  atRiskAmount: number
  clients: WnClientRow[]
}

interface PaymentItem {
  id: string
  insurer: string
  amount: number
  expected: number
  receivedDate: string
  notes: string | null
}

interface PaymentsSummary {
  totalReceived: number
  byPeriod: { period: string; total: number; items: PaymentItem[] }[]
}

interface ReconciliationClient {
  id: string
  fullName: string
  lives: number
  pmpm: number
  expected: number
  received: boolean
}

interface ReconciliationInsurer {
  insurer: string
  expectedTotal: number
  confirmedTotal: number
  missingTotal: number
  paymentReceived: number
  clients: ReconciliationClient[]
}

interface Reconciliation {
  period: string
  insurers: ReconciliationInsurer[]
  totalExpected: number
  totalConfirmed: number
  totalMissing: number
  totalPaymentReceived: number
}

interface ClientRow {
  id: string
  fullName: string
  insurer: string
  lives: number
  pmpm: number
  acaMonthly: number
  wnMonthly: number
  totalMonthly: number
  acaCommission: number
  totalCommission: number
  contractDate: string | null
  activationDate: string | null
  firstPaymentDate: string | null
  commissionStatus: 'active' | 'pending' | 'unknown'
  daysUntilPayment: number | null
  dependentNames?: string[]
}

interface CommissionData {
  summary: {
    totalMonthlyCommission: number
    totalAnnualCommission: number
    totalPendingMonthly: number
    totalLives: number
    activeCount: number
    pendingCount: number
    byInsurer: InsurerSummary[]
    wn: WnSummary
    payments: PaymentsSummary
    reconciliation: Reconciliation
  }
  clients: ClientRow[]
}

interface RateRow {
  insurer: string
  pmpm: number
  paymentDay?: number | null
  monthsToFirstPayment?: number | null
}

export default function CommissionsPage() {
  const [data, setData] = useState<CommissionData | null>(null)
  const [rates, setRates] = useState<RateRow[]>([])
  const [tab, setTab] = useState<'resumen' | 'clientes' | 'conciliacion' | 'importar'>('resumen')
  const [showRates, setShowRates] = useState(false)
  const [savingRates, setSavingRates] = useState(false)
  const [sortDesc, setSortDesc] = useState(true)

  const [wnSaving, setWnSaving] = useState<string | null>(null)

  // ── Pagos de comisión recibidos ──────────────────────────────────────────
  const currentPeriod = new Date().toISOString().slice(0, 7) // "YYYY-MM"
  const [showPayments, setShowPayments] = useState(false)
  const [payInsurer, setPayInsurer] = useState('')
  const [payPeriod, setPayPeriod] = useState(currentPeriod)
  const [payAmount, setPayAmount] = useState('')
  const [payDate, setPayDate] = useState(() => new Date().toISOString().slice(0, 10))
  const [payNotes, setPayNotes] = useState('')
  const [savingPayment, setSavingPayment] = useState(false)
  const [payError, setPayError] = useState('')
  const [deletingPayment, setDeletingPayment] = useState<string | null>(null)

  // ── Conciliación de comisiones ───────────────────────────────────────────
  const [reconPeriod, setReconPeriod] = useState(currentPeriod)
  const [checkSaving, setCheckSaving] = useState<string | null>(null)
  const [bulkSaving, setBulkSaving] = useState<string | null>(null)

  const load = useCallback(async (period?: string) => {
    const [commRes, ratesRes] = await Promise.all([
      fetch(`/api/commissions?period=${period || reconPeriod}`),
      fetch('/api/commission-rates'),
    ])
    setData(await commRes.json())
    setRates(await ratesRes.json())
  }, [reconPeriod])

  useEffect(() => { load() }, [load])

  const toggleCheck = useCallback(async (clientId: string, received: boolean) => {
    setCheckSaving(clientId)
    await fetch('/api/commission-checks', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ clientId, period: reconPeriod, received }),
    })
    setCheckSaving(null)
    load()
  }, [load, reconPeriod])

  const bulkMarkInsurer = useCallback(async (insurer: string, clientIds: string[], received: boolean) => {
    setBulkSaving(insurer)
    await fetch('/api/commission-checks/bulk', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ clientIds, period: reconPeriod, received }),
    })
    setBulkSaving(null)
    load()
  }, [load, reconPeriod])

  const toggleWnFlag = useCallback(async (clientId: string, field: 'wnSecondPaymentReceived' | 'wnClawbackReturned', current: boolean) => {
    setWnSaving(`${clientId}-${field}`)
    await fetch(`/api/clients/${clientId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ [field]: !current }),
    })
    setWnSaving(null)
    load()
  }, [load])

  const handleSaveRates = async () => {
    setSavingRates(true)
    await fetch('/api/commission-rates', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(rates),
    })
    setSavingRates(false)
    load()
  }

  const handleAddPayment = async (e: React.FormEvent) => {
    e.preventDefault()
    setPayError('')
    if (!payInsurer || !payPeriod || !payAmount || !payDate) {
      setPayError('Completa aseguradora, período, monto y fecha.')
      return
    }
    setSavingPayment(true)
    const res = await fetch('/api/commission-payments', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        insurer: payInsurer,
        period: payPeriod,
        amount: parseFloat(payAmount),
        receivedDate: payDate,
        notes: payNotes || undefined,
      }),
    })
    setSavingPayment(false)
    if (!res.ok) {
      const body = await res.json().catch(() => ({}))
      setPayError(body.error || 'No se pudo guardar el pago.')
      return
    }
    setPayAmount('')
    setPayNotes('')
    load()
  }

  const handleDeletePayment = async (id: string) => {
    setDeletingPayment(id)
    await fetch(`/api/commission-payments/${id}`, { method: 'DELETE' })
    setDeletingPayment(null)
    load()
  }

  const role = useRole()
  if (role === null) return (
    <div className="flex items-center justify-center h-64">
      <div className="text-gray-400">Cargando comisiones...</div>
    </div>
  )
  if (role === 'assistant') return <AccessDenied />

  if (!data) return (
    <div className="flex items-center justify-center h-64">
      <div className="text-gray-400">Cargando comisiones...</div>
    </div>
  )

  const { summary, clients } = data
  const avgPerClient = clients.length > 0 ? summary.totalMonthlyCommission / clients.length : 0
  const maxMonthly = summary.byInsurer.reduce((m, r) => Math.max(m, r.monthly), 0)

  const sortedClients = [...clients].sort((a, b) =>
    sortDesc ? b.totalCommission - a.totalCommission : a.totalCommission - b.totalCommission
  )
  const totalRow = {
    totalCommission: summary.totalMonthlyCommission,
  }

  const CARD = 'bg-white rounded-xl border border-gray-200 p-5'
  const TAB_BASE = 'px-5 py-2 text-sm font-semibold rounded-lg transition-colors'
  const TAB_ACTIVE = TAB_BASE + ' text-white'
  const TAB_INACTIVE = TAB_BASE + ' text-gray-600 hover:bg-gray-100'
  const TH = 'text-xs font-semibold uppercase tracking-wide py-2 px-3 text-left'
  const TD = 'py-2 px-3 text-sm text-gray-800'

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <h1 className="text-2xl font-bold" style={{ color: '#10253f' }}>💰 Seguimiento de Comisiones</h1>
        <p className="text-sm text-gray-500">Clientes Activos · {clients.length} total</p>
      </div>

      {/* Payment logic explanation */}
      <div className="flex items-start gap-3 px-4 py-3 rounded-xl text-sm" style={{ background: '#f0f7fb', border: '1px solid #b8d4e8' }}>
        <span className="text-base shrink-0">ℹ️</span>
        <div style={{ color: '#1e4a6e' }}>
          <strong>Lógica de pagos:</strong> Contratación → Activación el 1° del mes siguiente → Primera comisión N meses después (por defecto 2, configurable por aseguradora abajo en &quot;Configuración de Tasas PMPM&quot;).
          <span className="ml-2 opacity-70">Ej: contrata el 06/15 → activa el 07/01 → primera comisión el 09/01 (N=2)</span>
          <span className="block mt-1 opacity-70">Si un cliente cambió de aseguradora a mitad de póliza, el conteo se reinicia desde el mes del cambio — regístralo en su perfil, sección &quot;Historial de Aseguradoras&quot;.</span>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="rounded-xl p-4 border" style={{ background: '#dcfce7', borderColor: '#dcfce7' }}>
          <p className="text-xs font-medium text-gray-600 mb-1">✅ Comisión Activa/mes</p>
          <p className="text-2xl font-bold" style={{ color: '#166534' }}>{formatCurrency(summary.totalMonthlyCommission)}</p>
          <p className="text-xs mt-1" style={{ color: '#166534', opacity: 0.8 }}>{summary.activeCount} clientes pagando</p>
        </div>
        <div className="rounded-xl p-4 border" style={{ background: '#fef3c7', borderColor: '#fef3c7' }}>
          <p className="text-xs font-medium text-gray-600 mb-1">⏳ Comisión Pendiente/mes</p>
          <p className="text-2xl font-bold" style={{ color: '#d97706' }}>{formatCurrency(summary.totalPendingMonthly)}</p>
          <p className="text-xs mt-1" style={{ color: '#d97706', opacity: 0.8 }}>{summary.pendingCount} clientes en espera</p>
        </div>
        <div className="rounded-xl p-4 border" style={{ background: '#dbeafe', borderColor: '#dbeafe' }}>
          <p className="text-xs font-medium text-gray-600 mb-1">Comisión Anual Activa</p>
          <p className="text-2xl font-bold" style={{ color: '#1e40af' }}>{formatCurrency(summary.totalAnnualCommission)}</p>
        </div>
        <div className="rounded-xl p-4 border" style={{ background: '#f3e8ff', borderColor: '#f3e8ff' }}>
          <p className="text-xs font-medium text-gray-600 mb-1">Promedio por Cliente/mes</p>
          <p className="text-2xl font-bold" style={{ color: '#6b21a8' }}>{formatCurrency(avgPerClient)}</p>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-2">
        <button className={tab === 'resumen' ? TAB_ACTIVE : TAB_INACTIVE}
          style={tab === 'resumen' ? { background: '#10253f' } : {}}
          onClick={() => setTab('resumen')}>
          Resumen
        </button>
        <button className={tab === 'clientes' ? TAB_ACTIVE : TAB_INACTIVE}
          style={tab === 'clientes' ? { background: '#10253f' } : {}}
          onClick={() => setTab('clientes')}>
          Por Cliente
        </button>
        <button className={tab === 'conciliacion' ? TAB_ACTIVE : TAB_INACTIVE}
          style={tab === 'conciliacion' ? { background: '#10253f' } : {}}
          onClick={() => setTab('conciliacion')}>
          Conciliación
        </button>
        <button className={tab === 'importar' ? TAB_ACTIVE : TAB_INACTIVE}
          style={tab === 'importar' ? { background: '#10253f' } : {}}
          onClick={() => setTab('importar')}>
          📥 Importar estado de cuenta
        </button>
      </div>

      {tab === 'resumen' && (
        <div className="space-y-6">
          {/* Bar Chart */}
          <div className={CARD}>
            <h2 className="font-semibold text-base mb-1" style={{ color: '#10253f' }}>Comisión por Aseguradora (mensual)</h2>
            <p className="text-xs text-gray-400 mb-4">Comisión ACA = vidas × tasa PMPM negociada con cada aseguradora. (No incluye WN — ver nota abajo).</p>
            <div className="space-y-3">
              {summary.byInsurer.map(row => (
                <div key={row.insurer} className="flex items-center gap-3">
                  <div className="w-36 text-xs font-medium text-gray-700 truncate shrink-0">{row.insurer}</div>
                  <div className="flex-1 h-7 bg-gray-100 rounded-lg overflow-hidden">
                    <div
                      className="h-full rounded-lg flex items-center px-2 transition-all"
                      style={{
                        width: maxMonthly > 0 ? `${(row.monthly / maxMonthly) * 100}%` : '0%',
                        background: 'linear-gradient(90deg, #305a72, #507b88)',
                        minWidth: row.monthly > 0 ? '4rem' : '0',
                      }}
                    >
                      <span className="text-white text-xs font-semibold truncate">{formatCurrency(row.monthly)}</span>
                    </div>
                  </div>
                  <div className="w-12 text-xs text-gray-500 text-right shrink-0">{row.lives}v</div>
                </div>
              ))}
            </div>
          </div>

          {/* Summary table */}
          <div className={CARD}>
            <h2 className="font-semibold text-base mb-3" style={{ color: '#10253f' }}>Tabla por Aseguradora</h2>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr style={{ borderBottom: '2px solid #e5e7eb' }}>
                    <th className={TH} style={{ color: '#507b88' }}>Aseguradora</th>
                    <th className={TH} style={{ color: '#507b88' }}>Paga el día</th>
                    <th className={TH} style={{ color: '#507b88' }}>Vidas</th>
                    <th className={TH} style={{ color: '#507b88' }}>PMPM</th>
                    <th className={TH} style={{ color: '#507b88' }}>Mensual</th>
                    <th className={TH} style={{ color: '#507b88' }}>Anual</th>
                  </tr>
                </thead>
                <tbody>
                  {summary.byInsurer.map(row => (
                    <tr key={row.insurer} className="border-b border-gray-50 hover:bg-gray-50">
                      <td className={TD + ' font-medium'}>{row.insurer}</td>
                      <td className={TD}>{row.paymentDay ? `Día ${row.paymentDay}` : '—'}</td>
                      <td className={TD}>{row.lives}</td>
                      <td className={TD}>{formatCurrency(row.pmpm)}</td>
                      <td className={TD + ' font-semibold'} style={{ color: '#166534' }}>{formatCurrency(row.monthly)}</td>
                      <td className={TD + ' font-semibold'} style={{ color: '#1e40af' }}>{formatCurrency(row.annual)}</td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr style={{ borderTop: '2px solid #305a72' }}>
                    <td className="py-2 px-3 text-sm font-bold" style={{ color: '#10253f' }}>Total</td>
                    <td></td>
                    <td className="py-2 px-3 text-sm font-bold">{summary.totalLives}</td>
                    <td></td>
                    <td className="py-2 px-3 text-sm font-bold" style={{ color: '#166534' }}>{formatCurrency(summary.totalMonthlyCommission)}</td>
                    <td className="py-2 px-3 text-sm font-bold" style={{ color: '#1e40af' }}>{formatCurrency(summary.totalAnnualCommission)}</td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </div>

          {/* Washington National (WN) — pago único 30% anualizado, 75/25, con riesgo de devolución */}
          {summary.wn.clients.length > 0 && (
            <div className={CARD} style={{ background: '#fafaf9', borderColor: '#e7e5e4' }}>
              <div className="flex items-center justify-between mb-1 flex-wrap gap-2">
                <h2 className="font-semibold text-base" style={{ color: '#78716c' }}>🏥 Comisiones Washington National — pago único (30% anualizado)</h2>
                <div className="flex items-center gap-3">
                  <span className="text-xs px-2 py-1 rounded-full font-semibold" style={{ background: '#fef3c7', color: '#92400e' }}>
                    Pendiente 2do pago: {formatCurrency(summary.wn.pendingSecondPayments)}
                  </span>
                  {summary.wn.atRiskAmount > 0 && (
                    <span className="text-xs px-2 py-1 rounded-full font-semibold" style={{ background: '#fee2e2', color: '#991b1b' }}>
                      ⚠️ En riesgo de devolución: {formatCurrency(summary.wn.atRiskAmount)}
                    </span>
                  )}
                </div>
              </div>
              <p className="text-xs text-gray-400 mb-3">{summary.wn.note}</p>
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr style={{ borderBottom: '1px solid #e7e5e4' }}>
                      <th className={TH} style={{ color: '#a8a29e' }}>Cliente</th>
                      <th className={TH} style={{ color: '#a8a29e' }}>Estado</th>
                      <th className={TH} style={{ color: '#a8a29e' }}>Prima WN/mes</th>
                      <th className={TH} style={{ color: '#a8a29e' }}>Anualizada</th>
                      <th className={TH} style={{ color: '#a8a29e' }}>Comisión total (30%)</th>
                      <th className={TH} style={{ color: '#a8a29e' }}>Pago 1 (75%)</th>
                      <th className={TH} style={{ color: '#a8a29e' }}>Pago 2 (25%)</th>
                      <th className={TH} style={{ color: '#a8a29e' }}>Meses activo</th>
                      <th className={TH} style={{ color: '#a8a29e' }}>Riesgo</th>
                    </tr>
                  </thead>
                  <tbody>
                    {summary.wn.clients.map(c => {
                      const fmtDateWn = (iso: string | null) => {
                        if (!iso) return '—'
                        // Avoid UTC-midnight dates shifting back a day in local time zones
                        const d = /^\d{4}-\d{2}-\d{2}T00:00:00/.test(iso)
                          ? (() => { const u = new Date(iso); return new Date(u.getUTCFullYear(), u.getUTCMonth(), u.getUTCDate()) })()
                          : new Date(iso)
                        return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: '2-digit' })
                      }
                      let riskBadge
                      if (c.riskStatus === 'safe') {
                        riskBadge = <span className="px-2 py-1 rounded-full text-xs font-bold whitespace-nowrap" style={{ background: '#dcfce7', color: '#166534' }}>✅ Seguro{c.wnClawbackReturned ? ' (devuelto)' : ''}</span>
                      } else if (c.riskStatus === 'at_risk') {
                        riskBadge = <span className="px-2 py-1 rounded-full text-xs font-bold whitespace-nowrap" style={{ background: '#fee2e2', color: '#991b1b' }}>⚠️ Riesgo hasta {fmtDateWn(c.clawbackSafeDate)}</span>
                      } else {
                        riskBadge = <span className="px-2 py-1 rounded-full text-xs font-bold whitespace-nowrap" style={{ background: '#f3e8ff', color: '#6b21a8' }}>🔴 Revisar — debe regresar 75%</span>
                      }
                      const savingSecond = wnSaving === `${c.id}-wnSecondPaymentReceived`
                      const savingClawback = wnSaving === `${c.id}-wnClawbackReturned`
                      return (
                        <tr key={c.id} className="border-b border-gray-100">
                          <td className={TD}><a href={`/clients/${c.id}`} className="hover:underline" style={{ color: '#57534e' }}>{c.fullName}</a></td>
                          <td className={TD} style={{ color: c.status === 'Cancelado' ? '#dc2626' : '#78716c' }}>
                            {c.status}
                            {c.status === 'Cancelado' && c.cancellationDate && (
                              <div className="text-[11px] text-gray-400">canceló {fmtDateWn(c.cancellationDate)}</div>
                            )}
                          </td>
                          <td className={TD} style={{ color: '#78716c' }}>
                            {formatCurrency(c.wnMonthly)}
                            <div className="text-[11px] text-gray-400">inicio WN {fmtDateWn(c.wnStartDate)}</div>
                          </td>
                          <td className={TD} style={{ color: '#78716c' }}>{formatCurrency(c.annualized)}</td>
                          <td className={TD + ' font-semibold'} style={{ color: '#78716c' }}>{formatCurrency(c.totalCommission)}</td>
                          <td className={TD} style={{ color: '#166534' }}>{formatCurrency(c.firstPayment)} <span className="text-xs text-gray-400">(recibido al someter)</span></td>
                          <td className={TD}>
                            {c.secondPaymentReceived ? (
                              <span style={{ color: '#166534' }} className="font-semibold">{formatCurrency(c.secondPayment)} ✓ recibido</span>
                            ) : c.secondPaymentForfeited ? (
                              <span style={{ color: '#9ca3af' }}>{formatCurrency(c.secondPayment)} (perdido — canceló antes del mes 8)</span>
                            ) : (
                              <span style={{ color: '#d97706' }}>{formatCurrency(c.secondPayment)} — esperado {fmtDateWn(c.secondPaymentDate)}</span>
                            )}
                            {!c.secondPaymentForfeited && (
                              <button
                                type="button"
                                disabled={savingSecond}
                                onClick={() => toggleWnFlag(c.id, 'wnSecondPaymentReceived', c.wnSecondPaymentReceivedManual)}
                                className="ml-2 text-[11px] px-1.5 py-0.5 rounded border whitespace-nowrap"
                                style={{ borderColor: '#d6d3d1', color: '#78716c', opacity: savingSecond ? 0.5 : 1 }}
                              >
                                {savingSecond ? '…' : (c.wnSecondPaymentReceivedManual ? '↩ desmarcar recibido' : '✓ marcar recibido')}
                              </button>
                            )}
                          </td>
                          <td className={TD} style={{ color: '#78716c' }}>{c.monthsActive ?? '—'}</td>
                          <td className={TD}>
                            {riskBadge}
                            {c.riskStatus === 'needs_review' && (
                              <button
                                type="button"
                                disabled={savingClawback}
                                onClick={() => toggleWnFlag(c.id, 'wnClawbackReturned', c.wnClawbackReturned)}
                                className="block mt-1 text-[11px] px-1.5 py-0.5 rounded border whitespace-nowrap"
                                style={{ borderColor: '#d6d3d1', color: '#78716c', opacity: savingClawback ? 0.5 : 1 }}
                              >
                                {savingClawback ? '…' : '✓ marcar 75% ya devuelto'}
                              </button>
                            )}
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}

      {tab === 'clientes' && (
        <div className={CARD}>
          <div className="flex items-center justify-between mb-3">
            <h2 className="font-semibold text-base" style={{ color: '#10253f' }}>Comisión por Cliente</h2>
            <button
              onClick={() => setSortDesc(v => !v)}
              className="text-xs font-medium px-3 py-1.5 rounded-lg border border-gray-300 text-gray-600 hover:bg-gray-50"
            >
              Ordenar {sortDesc ? '↑ menor' : '↓ mayor'}
            </button>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[700px]">
              <thead>
                <tr style={{ borderBottom: '2px solid #e5e7eb' }}>
                  {['Estado', 'Cliente', 'Aseguradora', 'Vidas', 'PMPM', 'Comisión/mes', 'Comisión/año', 'Primer pago'].map(h => (
                    <th key={h} className={TH} style={{ color: '#507b88' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {sortedClients.map(c => {
                  const isActive = c.commissionStatus === 'active'
                  const isPending = c.commissionStatus === 'pending'
                  const fmtDate = (iso: string | null) => iso
                    ? new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: '2-digit' })
                    : '—'
                  return (
                  <tr key={c.id} className="border-b border-gray-50 hover:bg-gray-50">
                    <td className={TD}>
                      {isActive ? (
                        <span className="px-2 py-1 rounded-full text-xs font-bold whitespace-nowrap" style={{ background: '#dcfce7', color: '#166534' }}>✅ Activa</span>
                      ) : isPending ? (
                        <span className="px-2 py-1 rounded-full text-xs font-bold whitespace-nowrap" style={{ background: '#fef3c7', color: '#d97706' }}>⏳ en {c.daysUntilPayment}d</span>
                      ) : (
                        <span className="text-xs text-gray-400">—</span>
                      )}
                    </td>
                    <td className={TD}>
                      <a href={`/clients/${c.id}`} className="font-medium hover:underline" style={{ color: '#10253f' }}>{c.fullName}</a>
                    </td>
                    <td className={TD}>{c.insurer}</td>
                    <td className={TD}>{c.lives}</td>
                    <td className={TD}>{formatCurrency(c.pmpm)}</td>
                    <td className={TD + ' font-bold'} style={{ color: isActive ? '#166534' : '#d97706' }}>{formatCurrency(c.totalCommission)}</td>
                    <td className={TD + ' font-bold'} style={{ color: isActive ? '#1e40af' : '#94a3b8' }}>{formatCurrency(c.totalCommission * 12)}</td>
                    <td className={TD + ' text-xs whitespace-nowrap'} style={{ color: isPending ? '#d97706' : '#94a3b8' }}>
                      {fmtDate(c.firstPaymentDate)}
                    </td>
                  </tr>
                  )
                })}
              </tbody>
              <tfoot>
                <tr style={{ borderTop: '2px solid #305a72', background: '#f8fafc' }}>
                  <td className="py-2 px-3 text-sm font-bold" style={{ color: '#10253f' }} colSpan={5}>Total</td>
                  <td className="py-2 px-3 text-sm font-bold" style={{ color: '#166534' }}>{formatCurrency(totalRow.totalCommission)}</td>
                  <td className="py-2 px-3 text-sm font-bold" style={{ color: '#1e40af' }}>{formatCurrency(totalRow.totalCommission * 12)}</td>
                </tr>
              </tfoot>
            </table>
          </div>
        </div>
      )}

      {tab === 'conciliacion' && (
        <div className="space-y-6">
          <div className={CARD}>
            <div className="flex items-center justify-between flex-wrap gap-3 mb-1">
              <div>
                <h2 className="font-semibold text-base" style={{ color: '#10253f' }}>🔎 Conciliación de Comisiones</h2>
                <p className="text-xs text-gray-500 mt-1">
                  Marca cada cliente cuya comisión confirmas que recibiste para el mes seleccionado. Los que queden sin marcar son los que probablemente faltan por pagarte.
                </p>
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Mes a conciliar</label>
                <input
                  type="month"
                  value={reconPeriod}
                  onChange={e => setReconPeriod(e.target.value)}
                  className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#507b88] bg-white"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mt-4">
              <div className="rounded-xl p-4 border" style={{ background: '#dbeafe', borderColor: '#dbeafe' }}>
                <p className="text-xs font-medium text-gray-600 mb-1">Esperado del mes</p>
                <p className="text-2xl font-bold" style={{ color: '#1e40af' }}>{formatCurrency(data.summary.reconciliation.totalExpected)}</p>
              </div>
              <div className="rounded-xl p-4 border" style={{ background: '#dcfce7', borderColor: '#dcfce7' }}>
                <p className="text-xs font-medium text-gray-600 mb-1">✅ Confirmado recibido</p>
                <p className="text-2xl font-bold" style={{ color: '#166534' }}>{formatCurrency(data.summary.reconciliation.totalConfirmed)}</p>
              </div>
              <div className="rounded-xl p-4 border" style={{ background: '#fee2e2', borderColor: '#fee2e2' }}>
                <p className="text-xs font-medium text-gray-600 mb-1">⚠️ Falta por confirmar</p>
                <p className="text-2xl font-bold" style={{ color: '#991b1b' }}>{formatCurrency(data.summary.reconciliation.totalMissing)}</p>
              </div>
              <div className="rounded-xl p-4 border" style={{ background: '#f3e8ff', borderColor: '#f3e8ff' }}>
                <p className="text-xs font-medium text-gray-600 mb-1">💵 Pagos registrados (mes)</p>
                <p className="text-2xl font-bold" style={{ color: '#6b21a8' }}>{formatCurrency(data.summary.reconciliation.totalPaymentReceived)}</p>
              </div>
            </div>
          </div>

          {data.summary.reconciliation.insurers.length === 0 ? (
            <div className={CARD}>
              <p className="text-sm text-gray-400 text-center py-4">No hay clientes con comisión esperada para este mes.</p>
            </div>
          ) : (
            data.summary.reconciliation.insurers.map(row => (
              <div key={row.insurer} className={CARD}>
                <div className="flex items-center justify-between flex-wrap gap-2 mb-3">
                  <h3 className="font-semibold text-base" style={{ color: '#10253f' }}>{row.insurer}</h3>
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-xs px-2 py-1 rounded-full font-semibold" style={{ background: '#dbeafe', color: '#1e40af' }}>
                      Esperado: {formatCurrency(row.expectedTotal)}
                    </span>
                    <span className="text-xs px-2 py-1 rounded-full font-semibold" style={{ background: '#dcfce7', color: '#166534' }}>
                      Confirmado: {formatCurrency(row.confirmedTotal)}
                    </span>
                    {row.missingTotal > 0 && (
                      <span className="text-xs px-2 py-1 rounded-full font-semibold" style={{ background: '#fee2e2', color: '#991b1b' }}>
                        Falta: {formatCurrency(row.missingTotal)}
                      </span>
                    )}
                    <span className="text-xs px-2 py-1 rounded-full font-semibold" style={{ background: '#f3e8ff', color: '#6b21a8' }}>
                      Pago registrado: {formatCurrency(row.paymentReceived)}
                    </span>
                    <button
                      type="button"
                      disabled={bulkSaving === row.insurer}
                      onClick={() => bulkMarkInsurer(row.insurer, row.clients.map(c => c.id), true)}
                      className="text-xs px-2 py-1 rounded-full font-semibold border whitespace-nowrap disabled:opacity-50"
                      style={{ borderColor: '#bbf7d0', color: '#166534' }}
                    >
                      {bulkSaving === row.insurer ? '…' : '✅ Marcar todos recibido'}
                    </button>
                    <button
                      type="button"
                      disabled={bulkSaving === row.insurer}
                      onClick={() => bulkMarkInsurer(row.insurer, row.clients.map(c => c.id), false)}
                      className="text-xs px-2 py-1 rounded-full font-semibold border whitespace-nowrap disabled:opacity-50"
                      style={{ borderColor: '#e5e7eb', color: '#6b7280' }}
                    >
                      {bulkSaving === row.insurer ? '…' : '↩ Desmarcar todos'}
                    </button>
                  </div>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead>
                      <tr style={{ borderBottom: '1px solid #e5e7eb' }}>
                        <th className={TH} style={{ color: '#507b88' }}>Cliente</th>
                        <th className={TH} style={{ color: '#507b88' }}>Vidas</th>
                        <th className={TH} style={{ color: '#507b88' }}>PMPM</th>
                        <th className={TH} style={{ color: '#507b88' }}>Esperado</th>
                        <th className={TH} style={{ color: '#507b88' }}>¿Recibido?</th>
                      </tr>
                    </thead>
                    <tbody>
                      {row.clients.map(c => (
                        <tr key={c.id} className="border-b border-gray-50 hover:bg-gray-50" style={!c.received ? { background: '#fef2f2' } : {}}>
                          <td className={TD}>
                            <a href={`/clients/${c.id}`} className="font-medium hover:underline" style={{ color: '#10253f' }}>{c.fullName}</a>
                          </td>
                          <td className={TD}>{c.lives}</td>
                          <td className={TD}>{formatCurrency(c.pmpm)}</td>
                          <td className={TD + ' font-semibold'} style={{ color: '#166534' }}>{formatCurrency(c.expected)}</td>
                          <td className={TD}>
                            <label className="inline-flex items-center gap-2 cursor-pointer">
                              <input
                                type="checkbox"
                                checked={c.received}
                                disabled={checkSaving === c.id}
                                onChange={() => toggleCheck(c.id, !c.received)}
                                className="w-4 h-4"
                              />
                              {c.received ? (
                                <span className="text-xs font-semibold" style={{ color: '#166534' }}>✅ Recibido</span>
                              ) : (
                                <span className="text-xs font-semibold" style={{ color: '#991b1b' }}>⚠️ Falta</span>
                              )}
                            </label>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            ))
          )}
        </div>
      )}

      {tab === 'importar' && (
        <StatementImport
          period={reconPeriod}
          clients={data.clients}
          onApplied={() => load()}
          onPeriodChange={setReconPeriod}
        />
      )}

      {/* Pagos recibidos */}
      <div className={CARD}>
        <button
          onClick={() => setShowPayments(v => !v)}
          className="flex items-center justify-between w-full text-left"
        >
          <span className="font-semibold text-base" style={{ color: '#10253f' }}>
            💵 Pagos de Comisión Recibidos
          </span>
          <div className="flex items-center gap-3">
            <span className="text-xs px-2 py-1 rounded-full font-semibold" style={{ background: '#dcfce7', color: '#166534' }}>
              Total registrado: {formatCurrency(summary.payments.totalReceived)}
            </span>
            <span className="text-gray-400 text-sm">{showPayments ? '▲ Cerrar' : '▼ Expandir'}</span>
          </div>
        </button>

        {showPayments && (
          <div className="mt-4 space-y-4">
            <p className="text-xs text-gray-500">
              Registra aquí cada pago de comisión que efectivamente recibas (por aseguradora y mes que cubre), para comparar lo cobrado contra lo proyectado y llevar un control real de tus ingresos.
            </p>

            {/* Form */}
            <form onSubmit={handleAddPayment} className="grid grid-cols-1 md:grid-cols-5 gap-3 p-4 rounded-xl" style={{ background: '#f8fafc', border: '1px solid #e2e8f0' }}>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Aseguradora</label>
                <select
                  value={payInsurer}
                  onChange={e => setPayInsurer(e.target.value)}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#507b88] bg-white"
                >
                  <option value="">Seleccionar...</option>
                  {rates.map(r => <option key={r.insurer} value={r.insurer}>{r.insurer}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Mes que cubre</label>
                <input
                  type="month"
                  value={payPeriod}
                  onChange={e => setPayPeriod(e.target.value)}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#507b88] bg-white"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Monto recibido</label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-gray-400 pointer-events-none">$</span>
                  <input
                    type="number" min="0" step="0.01" placeholder="0.00"
                    value={payAmount}
                    onChange={e => setPayAmount(e.target.value)}
                    className="w-full border border-gray-300 rounded-lg pl-6 pr-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#507b88] bg-white"
                  />
                </div>
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Fecha recibido</label>
                <input
                  type="date"
                  value={payDate}
                  onChange={e => setPayDate(e.target.value)}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#507b88] bg-white"
                />
              </div>
              <div className="flex flex-col">
                <label className="block text-xs font-medium text-gray-600 mb-1">Notas (opcional)</label>
                <div className="flex gap-2 flex-1">
                  <input
                    type="text" placeholder="Ej. depósito directo"
                    value={payNotes}
                    onChange={e => setPayNotes(e.target.value)}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#507b88] bg-white"
                  />
                  <button
                    type="submit"
                    disabled={savingPayment}
                    className="px-4 py-2 rounded-lg text-sm font-semibold text-white disabled:opacity-50 whitespace-nowrap"
                    style={{ background: '#305a72' }}
                  >
                    {savingPayment ? '...' : '+ Agregar'}
                  </button>
                </div>
              </div>
              {payError && <p className="md:col-span-5 text-xs text-red-600">{payError}</p>}
            </form>

            {/* Payments by period */}
            {summary.payments.byPeriod.length === 0 ? (
              <p className="text-sm text-gray-400 text-center py-4">Aún no has registrado ningún pago.</p>
            ) : (
              <div className="space-y-4">
                {summary.payments.byPeriod.map(periodGroup => {
                  const [year, month] = periodGroup.period.split('-')
                  const periodLabel = new Date(Number(year), Number(month) - 1, 1)
                    .toLocaleDateString('es-ES', { month: 'long', year: 'numeric' })
                  return (
                    <div key={periodGroup.period} className="border border-gray-100 rounded-xl overflow-hidden">
                      <div className="flex items-center justify-between px-4 py-2" style={{ background: '#f0f7fb' }}>
                        <span className="text-sm font-semibold capitalize" style={{ color: '#10253f' }}>{periodLabel}</span>
                        <span className="text-sm font-bold" style={{ color: '#166534' }}>{formatCurrency(periodGroup.total)}</span>
                      </div>
                      <table className="w-full">
                        <thead>
                          <tr style={{ borderBottom: '1px solid #e5e7eb' }}>
                            <th className={TH} style={{ color: '#507b88' }}>Aseguradora</th>
                            <th className={TH} style={{ color: '#507b88' }}>Recibido</th>
                            <th className={TH} style={{ color: '#507b88' }}>Proyectado actual</th>
                            <th className={TH} style={{ color: '#507b88' }}>Diferencia</th>
                            <th className={TH} style={{ color: '#507b88' }}>Fecha</th>
                            <th className={TH} style={{ color: '#507b88' }}>Notas</th>
                            <th className={TH}></th>
                          </tr>
                        </thead>
                        <tbody>
                          {periodGroup.items.map(item => {
                            const diff = item.amount - item.expected
                            return (
                              <tr key={item.id} className="border-b border-gray-50 hover:bg-gray-50">
                                <td className={TD + ' font-medium'}>{item.insurer}</td>
                                <td className={TD + ' font-semibold'} style={{ color: '#166534' }}>{formatCurrency(item.amount)}</td>
                                <td className={TD} style={{ color: '#94a3b8' }}>{formatCurrency(item.expected)}</td>
                                <td className={TD} style={{ color: diff === 0 ? '#94a3b8' : diff > 0 ? '#166534' : '#dc2626' }}>
                                  {diff > 0 ? '+' : ''}{formatCurrency(diff)}
                                </td>
                                <td className={TD + ' text-xs whitespace-nowrap'} style={{ color: '#94a3b8' }}>
                                  {new Date(item.receivedDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: '2-digit' })}
                                </td>
                                <td className={TD + ' text-xs'} style={{ color: '#94a3b8' }}>{item.notes || '—'}</td>
                                <td className={TD}>
                                  <button
                                    type="button"
                                    disabled={deletingPayment === item.id}
                                    onClick={() => handleDeletePayment(item.id)}
                                    className="text-xs px-2 py-1 rounded border whitespace-nowrap"
                                    style={{ borderColor: '#fca5a5', color: '#dc2626', opacity: deletingPayment === item.id ? 0.5 : 1 }}
                                  >
                                    {deletingPayment === item.id ? '…' : '🗑 Eliminar'}
                                  </button>
                                </td>
                              </tr>
                            )
                          })}
                        </tbody>
                      </table>
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Rates config */}
      <div className={CARD}>
        <button
          onClick={() => setShowRates(v => !v)}
          className="flex items-center justify-between w-full text-left"
        >
          <span className="font-semibold text-base" style={{ color: '#10253f' }}>
            ⚙️ Configuración de Tasas PMPM
          </span>
          <span className="text-gray-400 text-sm">{showRates ? '▲ Cerrar' : '▼ Expandir'}</span>
        </button>

        {showRates && (
          <div className="mt-4 space-y-3">
            <p className="text-xs text-gray-500">PMPM = Dólares por miembro por mes (comisión ACA). WN siempre es 25% del total mensual de pólizas WN. &quot;Paga el día&quot; es opcional — el día del mes en que esa aseguradora deposita la comisión (ej. Oscar el 16, Ambetter el 2). &quot;Meses hasta 1ra comisión&quot; es lo que tarda esa aseguradora en pagar la primera comisión después de la activación (por defecto 2 — algunas, como Oscar, pagan desde el mes siguiente, es decir 1).</p>
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
              {rates.map((r, i) => (
                <div key={r.insurer}>
                  <label className="block text-xs font-medium text-gray-600 mb-1">{r.insurer}</label>
                  <div className="flex gap-2">
                    <div className="relative flex-1">
                      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-gray-400 pointer-events-none">$</span>
                      <input
                        type="number"
                        min="0"
                        step="0.01"
                        value={r.pmpm}
                        onChange={e => {
                          const newRates = [...rates]
                          newRates[i] = { ...r, pmpm: parseFloat(e.target.value) || 0 }
                          setRates(newRates)
                        }}
                        className="w-full border border-gray-300 rounded-lg pl-6 pr-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#507b88] bg-white"
                      />
                    </div>
                    <div className="relative w-20">
                      <input
                        type="number"
                        min="1"
                        max="31"
                        placeholder="Día"
                        value={r.paymentDay ?? ''}
                        onChange={e => {
                          const newRates = [...rates]
                          const v = e.target.value
                          newRates[i] = { ...r, paymentDay: v === '' ? null : (parseInt(v, 10) || null) }
                          setRates(newRates)
                        }}
                        title="Día del mes en que paga la comisión"
                        className="w-full border border-gray-300 rounded-lg pl-3 pr-2 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#507b88] bg-white"
                      />
                    </div>
                    <div className="relative w-16">
                      <input
                        type="number"
                        min="0"
                        max="12"
                        placeholder="Meses"
                        value={r.monthsToFirstPayment ?? 2}
                        onChange={e => {
                          const newRates = [...rates]
                          const v = e.target.value
                          newRates[i] = { ...r, monthsToFirstPayment: v === '' ? 2 : (parseInt(v, 10) || 0) }
                          setRates(newRates)
                        }}
                        title="Meses hasta la 1ra comisión (después de la activación)"
                        className="w-full border border-gray-300 rounded-lg pl-3 pr-2 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#507b88] bg-white"
                      />
                    </div>
                  </div>
                </div>
              ))}
            </div>
            <div className="flex justify-end pt-2">
              <button
                onClick={handleSaveRates}
                disabled={savingRates}
                className="px-6 py-2 rounded-lg text-sm font-semibold text-white disabled:opacity-50"
                style={{ background: '#305a72' }}
              >
                {savingRates ? 'Guardando...' : 'Guardar tasas'}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
