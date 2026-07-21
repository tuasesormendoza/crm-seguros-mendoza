'use client'

import { useState, useEffect, Suspense } from 'react'
import { useSearchParams } from 'next/navigation'
import Link from 'next/link'

// ─── Types ────────────────────────────────────────────────────────────────────

interface APTCResult {
  zipcode: string; income: number; householdSize: number; age: number; year: string; state: string
  fplThreshold: number; fplPct: number
  qualifiesMedicaid: boolean; qualifiesAPTC: boolean; qualifiesCSR: boolean
  applicablePct: number; maxClientPayMonth: number
  slcspMonthly: number | null; slcspPlanName: string | null
  benchmarkMonthly: number; dataSource: 'cms_exact' | 'cms_single' | 'estimated'
  subsidyMonth: number; clientPaysMonth: number; subsidyYear: number
  bestPlans: {
    id: string; name: string; issuer: string | null; metalLevel: string; type: string
    premium: number; premiumWCredit: number; deductible: number | null; moop: number | null
    hsaEligible: boolean
    primaryCare: string | null; specialist: string | null; urgentCare: string | null
    emergencyRoom: string | null; genericDrugs: string | null
    worstCaseAnnual: number
  }[]
  bestPlansRankMode: 'protection' | 'cheapest'
  planRec: string; planRecReason: string; cmsError: string | null
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

const fmt$ = (n: number) =>
  new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(n)

const fmt$c = (n: number) =>
  new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(n)

// ─── Sub-components ───────────────────────────────────────────────────────────

function DataSourceBadge({ source }: { source: APTCResult['dataSource'] }) {
  if (source === 'cms_exact') return (
    <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold"
      style={{ background: '#d1fae5', color: '#065f46' }}>
      ✅ Dato exacto — CMS Marketplace API
    </span>
  )
  if (source === 'cms_single') return (
    <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold"
      style={{ background: '#dbeafe', color: '#1e40af' }}>
      ℹ️ Un solo plan Silver en área — CMS API
    </span>
  )
  return (
    <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold"
      style={{ background: '#fef3c7', color: '#92400e' }}>
      ⚠️ Estimación (promedio nacional)
    </span>
  )
}

function InputField({ label, children, hint }: { label: string; children: React.ReactNode; hint?: string }) {
  return (
    <div>
      <label className="block text-xs font-semibold text-gray-600 mb-1.5">{label}</label>
      {children}
      {hint && <p className="text-xs text-gray-400 mt-1">{hint}</p>}
    </div>
  )
}

// ─── Main inner ───────────────────────────────────────────────────────────────

// Edad actual a partir de una fecha de nacimiento (ISO). Usa getters UTC porque
// las fechas se guardan como medianoche UTC (evita un desfase de un día).
function ageFromBirth(birth?: string | null): number | null {
  if (!birth) return null
  const d = new Date(birth)
  if (isNaN(d.getTime())) return null
  const today = new Date()
  let age = today.getFullYear() - d.getUTCFullYear()
  const m = today.getMonth() - d.getUTCMonth()
  if (m < 0 || (m === 0 && today.getDate() < d.getUTCDate())) age--
  return age >= 0 && age < 130 ? age : null
}

function APTCInner() {
  const searchParams = useSearchParams()
  const clientId = searchParams.get('clientId')

  const [fplYear, setFplYear] = useState('2026')
  const [fpl1, setFpl1] = useState(15650)
  const [fplPer, setFplPer] = useState(5500)
  const [hasCmsKey, setHasCmsKey] = useState(false)
  // Solo el DUEÑO del CRM configura el CMS API Key; a las agencias cliente no se
  // les pide (lo heredan). Sin esto verían avisos para configurar algo que no pueden.
  const [isOwner, setIsOwner] = useState(false)

  // Form
  const [income, setIncome] = useState('')
  const [household, setHousehold] = useState('1')
  const [age, setAge] = useState('')
  const [otherAges, setOtherAges] = useState<string[]>([])
  const [zipcode, setZipcode] = useState('')
  const [state, setState] = useState('')
  const [clientName, setClientName] = useState('')

  // Result
  const [result, setResult] = useState<APTCResult | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)
  const [savedMsg, setSavedMsg] = useState('')

  useEffect(() => {
    fetch('/api/settings').then(r => r.json()).then(s => {
      if (s.fplYear)      setFplYear(s.fplYear)
      if (s.fpl1Person)   setFpl1(Number(s.fpl1Person))
      if (s.fplPerPerson) setFplPer(Number(s.fplPerPerson))
      setHasCmsKey(!!(s.cmsApiKey && s.cmsApiKey.length > 5))
      setIsOwner(s.__isOwner === 'true')
    })
    // Respaldo: en una recarga dura useSearchParams puede llegar vacío; tomamos
    // el clientId directamente de la URL para que el pre-llenado no se pierda.
    const cid = clientId || (typeof window !== 'undefined' ? new URLSearchParams(window.location.search).get('clientId') : null)
    if (cid) {
      fetch(`/api/clients/${cid}`).then(r => r.json()).then(c => {
        setClientName(c.fullName || '')
        if (c.annualIncome) setIncome(String(c.annualIncome))
        if (c.state) setState(c.state)
        if (c.zipCode) setZipcode(c.zipCode)
        // Edad actual del solicitante (a partir de su fecha de nacimiento).
        const mainAge = ageFromBirth(c.birthDate)
        if (mainAge != null) setAge(String(mainAge))
        // Dependientes → personas en el hogar + sus edades actuales.
        const deps: { birthDate?: string | null }[] = Array.isArray(c.dependents) ? c.dependents : []
        const size = Math.min(1 + deps.length, 8)              // el selector llega hasta 8
        setHousehold(String(size))
        setOtherAges(deps.slice(0, size - 1).map(d => {
          const a = ageFromBirth(d.birthDate)
          return a != null ? String(a) : ''
        }))
      })
    }
  }, [clientId])

  async function calculate(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    setResult(null)
    setLoading(true)
    try {
      const res = await fetch('/api/aptc', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          zipcode, income: parseFloat(income.replace(/[^0-9.]/g, '')),
          householdSize: parseInt(household), age: parseInt(age),
          ages: [parseInt(age), ...otherAges.map(a => parseInt(a) || 18)],
          year: fplYear, state,
        }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Error calculando')
      setResult(data)
    } catch (err) { setError((err as Error).message) }
    setLoading(false)
  }

  async function saveToClient() {
    if (!clientId || !result) return
    setSaving(true)
    await fetch(`/api/clients/${clientId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ annualIncome: result.income, zipCode: result.zipcode }),
    })
    setSaving(false)
    setSavedMsg('✓ Ingreso y ZIP guardados en la ficha del cliente')
    setTimeout(() => setSavedMsg(''), 4000)
  }

  const SEL = 'w-full border-2 border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-[#2a6496] transition-colors bg-white'
  const fplRef = fpl1 + fplPer * (parseInt(household || '1') - 1)

  return (
    <div className="max-w-5xl mx-auto space-y-5">

      {/* Header */}
      <div className="flex items-start justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold" style={{ color: '#10253f' }}>🧮 Calculadora APTC</h1>
          <p className="text-sm text-gray-500 mt-0.5">
            Crédito Fiscal Anticipado · FPL {fplYear}
            {clientName && <span className="ml-2 font-semibold" style={{ color: '#2a6496' }}>· {clientName}</span>}
          </p>
        </div>
        <div className="flex gap-2">
          {!hasCmsKey && isOwner && (
            <Link href="/settings"
              className="text-xs px-3 py-2 rounded-lg font-semibold border"
              style={{ color: '#d97706', borderColor: '#fde68a', background: '#fef9c3' }}>
              ⚙️ Configura tu CMS API Key para datos exactos
            </Link>
          )}
          {clientId && (
            <Link href={`/clients/${clientId}`}
              className="text-sm px-4 py-2 rounded-lg border border-gray-200 text-gray-600 hover:bg-gray-50">
              ← Cliente
            </Link>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">

        {/* ── Inputs ── */}
        <form onSubmit={calculate} className="lg:col-span-2 space-y-4">
          <div className="bg-white rounded-2xl border border-gray-200 p-6 shadow-sm space-y-4">
            <h2 className="font-bold text-xs uppercase tracking-widest text-gray-400">Datos del solicitante</h2>

            <InputField label="ZIP Code *"
              hint={hasCmsKey ? '✅ Se usará para buscar planes reales en tu área' : (isOwner ? '⚠️ Agrega CMS API Key para datos exactos por ZIP' : 'Se usará para estimar los planes de tu área')}>
              <input type="text" value={zipcode} onChange={e => setZipcode(e.target.value.replace(/\D/g,'').slice(0,5))}
                placeholder="32822" maxLength={5} required className={SEL} />
            </InputField>

            <InputField label="Ingreso Anual del Hogar *" hint="Ingreso bruto de todas las personas en el hogar">
              <div className="relative">
                <span className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 font-semibold text-sm">$</span>
                <input type="number" value={income} onChange={e => setIncome(e.target.value)}
                  placeholder="25,000" required className={SEL + ' pl-8'} />
              </div>
            </InputField>

            <InputField label="Personas en el hogar *">
              <select value={household} onChange={e => {
                  const n = parseInt(e.target.value)
                  setHousehold(e.target.value)
                  setOtherAges(prev => {
                    const needed = Math.max(0, n - 1)
                    const next = prev.slice(0, needed)
                    while (next.length < needed) next.push('')
                    return next
                  })
                }} className={SEL}>
                {[1,2,3,4,5,6,7,8].map(n => (
                  <option key={n} value={n}>{n} {n===1?'persona':'personas'}</option>
                ))}
              </select>
              <p className="text-xs text-gray-400 mt-1">FPL {fplYear} para {household} {parseInt(household)===1?'persona':'personas'}: <strong>{fmt$(fplRef)}/año</strong></p>
            </InputField>

            <InputField label="Edad del solicitante principal *" hint="Afecta el costo del plan Silver de referencia">
              <input type="number" value={age} onChange={e => setAge(e.target.value)}
                placeholder="40" min="18" max="64" required className={SEL} />
            </InputField>

            {otherAges.map((a, i) => (
              <InputField key={i} label={`Edad de la persona ${i + 2} *`} hint="La edad de cada persona afecta el costo real del plan">
                <input type="number" value={a}
                  onChange={e => setOtherAges(prev => prev.map((v, idx) => idx === i ? e.target.value : v))}
                  placeholder="40" min="0" max="64" required className={SEL} />
              </InputField>
            ))}

            <InputField label="Estado">
              <input type="text" value={state} onChange={e => setState(e.target.value)}
                placeholder="FL" className={SEL} />
            </InputField>

            {error && (
              <div className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-xl px-4 py-3">
                ⚠️ {error}
              </div>
            )}

            <button type="submit" disabled={loading}
              className="w-full py-3 rounded-xl font-bold text-sm text-white disabled:opacity-50 transition-all hover:opacity-90"
              style={{ background: loading ? '#64748b' : 'linear-gradient(135deg, #2a6496, #0891b2)' }}>
              {loading ? (
                <span className="flex items-center justify-center gap-2">
                  <svg className="animate-spin w-4 h-4" viewBox="0 0 24 24" fill="none">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4l3-3-3-3V0a12 12 0 100 24v-4l-3 3 3 3v4a12 12 0 010-24z"/>
                  </svg>
                  {hasCmsKey ? 'Consultando CMS Marketplace...' : 'Calculando...'}
                </span>
              ) : 'Calcular elegibilidad →'}
            </button>
          </div>

          {/* FPL quick ref */}
          <div className="bg-white rounded-xl border border-gray-100 p-4">
            <div className="flex items-center justify-between mb-2">
              <p className="text-xs font-bold uppercase tracking-wide text-gray-400">FPL {fplYear}</p>
              {isOwner && <Link href="/settings" className="text-xs" style={{ color: '#2a6496' }}>Actualizar →</Link>}
            </div>
            <div className="space-y-1">
              {[1,2,3,4,5].map(n => (
                <div key={n} className="flex justify-between text-xs">
                  <span className="text-gray-400">{n} {n===1?'persona':'personas'}</span>
                  <span className="font-semibold text-gray-700">{fmt$(fpl1 + fplPer*(n-1))}</span>
                </div>
              ))}
            </div>
          </div>
        </form>

        {/* ── Results ── */}
        <div className="lg:col-span-3 space-y-4">
          {!result ? (
            <div className="bg-white rounded-2xl border border-gray-100 p-12 text-center flex flex-col items-center justify-center min-h-80">
              <div className="text-5xl mb-4">🧮</div>
              <p className="font-medium text-gray-500">Ingresa los datos y calcula</p>
              {hasCmsKey ? (
                <p className="text-xs text-green-600 mt-2 font-semibold">✅ {isOwner ? 'CMS API configurada — resultados exactos por ZIP' : 'Resultados exactos por ZIP'}</p>
              ) : (
                <p className="text-xs text-amber-600 mt-2">{isOwner ? 'Sin CMS API Key → resultados estimados' : 'Resultados estimados'}</p>
              )}
            </div>
          ) : (
            <>
              {/* Data source indicator */}
              <div className="flex justify-end">
                <DataSourceBadge source={result.dataSource} />
              </div>

              {/* CMS API error notice (if any) */}
              {result.cmsError && (
                <div className="bg-amber-50 border border-amber-200 rounded-xl px-4 py-3 text-sm text-amber-800">
                  ⚠️ {result.cmsError}
                  {result.cmsError.includes('API Key') && isOwner && (
                    <Link href="/settings" className="ml-2 underline font-semibold">Configurar →</Link>
                  )}
                </div>
              )}

              {/* Eligibility banner */}
              {result.qualifiesMedicaid && (
                <div className="rounded-2xl p-5" style={{ background: '#fef9c3', border: '2px solid #d97706' }}>
                  <div className="flex items-start gap-3">
                    <span className="text-2xl">⚠️</span>
                    <div>
                      <p className="font-bold text-amber-900">Posible elegibilidad para Medicaid</p>
                      <p className="text-sm text-amber-700 mt-0.5">
                        Ingreso al <strong>{result.fplPct.toFixed(0)}% del FPL</strong> — por debajo del 100%.
                        Verificar Medicaid en {result.state || 'su estado'}.
                      </p>
                    </div>
                  </div>
                </div>
              )}

              {result.qualifiesAPTC && (
                <div className="rounded-2xl p-5" style={{ background: result.subsidyMonth > 0 ? '#d1fae5' : '#dbeafe', border: `2px solid ${result.subsidyMonth>0?'#059669':'#2563eb'}` }}>
                  <div className="flex items-start gap-3">
                    <span className="text-2xl">✅</span>
                    <div>
                      <p className="font-bold" style={{ color: result.subsidyMonth>0?'#065f46':'#1e40af' }}>
                        Califica para subsidio APTC
                      </p>
                      <p className="text-sm mt-0.5" style={{ color: result.subsidyMonth>0?'#047857':'#1d4ed8' }}>
                        Ingreso al <strong>{result.fplPct.toFixed(1)}% del FPL</strong>
                        {result.qualifiesCSR && (
                          <span className="ml-2 px-2 py-0.5 rounded-full text-xs font-bold bg-purple-100 text-purple-700">
                            + Califica para CSR
                          </span>
                        )}
                      </p>
                    </div>
                  </div>
                </div>
              )}

              {/* KPI cards */}
              {result.qualifiesAPTC && (
                <div className="grid grid-cols-3 gap-3">
                  {[
                    { label: '% del FPL', value: `${result.fplPct.toFixed(0)}%`, color: '#10253f', bg: '#f0f7fb' },
                    { label: 'Subsidio APTC/mes', value: fmt$(result.subsidyMonth), color: '#059669', bg: '#d1fae5',
                      sub: result.dataSource === 'cms_exact' ? 'Dato exacto CMS' : 'Estimado' },
                    { label: 'Cliente pagaría/mes', value: fmt$c(result.clientPaysMonth), color: '#2a6496', bg: '#dbeafe',
                      sub: `Por plan Silver` },
                  ].map(card => (
                    <div key={card.label} className="rounded-xl p-4 text-center" style={{ background: card.bg, border: `1.5px solid ${card.color}20` }}>
                      <div className="text-xs font-semibold uppercase tracking-wide mb-1" style={{ color: card.color }}>{card.label}</div>
                      <div className="text-xl font-extrabold" style={{ color: card.color }}>{card.value}</div>
                      {card.sub && <div className="text-xs mt-0.5" style={{ color: card.color, opacity: 0.7 }}>{card.sub}</div>}
                    </div>
                  ))}
                </div>
              )}

              {/* Breakdown */}
              {result.qualifiesAPTC && (
                <div className="bg-white rounded-2xl border border-gray-200 p-5">
                  <h3 className="font-bold text-xs uppercase tracking-widest text-gray-400 mb-4">Desglose del cálculo</h3>
                  <div className="space-y-2.5">
                    {[
                      { label: 'Ingreso anual del hogar', value: fmt$(result.income) },
                      { label: `FPL para ${result.householdSize} personas (${result.year})`, value: fmt$(result.fplThreshold) },
                      { label: '% del FPL', value: `${result.fplPct.toFixed(1)}%` },
                      { label: 'Porcentaje máximo que paga el cliente', value: `${result.applicablePct}% del ingreso` },
                      { label: 'Máximo mensual que paga cliente', value: fmt$c(result.maxClientPayMonth) },
                      {
                        label: result.slcspPlanName
                          ? `SLCSP (${result.slcspPlanName.slice(0, 35)}...)`
                          : 'Plan Silver referencia (SLCSP)',
                        value: `${fmt$c(result.benchmarkMonthly)}/mes`,
                        highlight: result.dataSource === 'cms_exact',
                        note: result.dataSource === 'cms_exact' ? '✅ Dato real CMS' : result.dataSource === 'cms_single' ? 'ℹ️ Único plan Silver' : '⚠️ Estimado',
                      },
                      { label: '🟢 Subsidio APTC mensual', value: fmt$c(result.subsidyMonth), highlight: true },
                      { label: '🔵 Cliente pagaría por plan Silver', value: fmt$c(result.clientPaysMonth), highlight: true },
                      { label: '📅 Subsidio anual estimado', value: fmt$(result.subsidyYear) },
                    ].map(row => (
                      <div key={row.label} className="flex justify-between items-center text-sm py-1.5 border-b border-gray-50 last:border-0">
                        <div>
                          <span style={{ color: row.highlight ? '#10253f' : '#64748b', fontWeight: row.highlight ? 700 : 400 }}>{row.label}</span>
                          {row.note && <span className="ml-2 text-xs" style={{ color: row.highlight ? '#059669' : '#94a3b8' }}>{row.note}</span>}
                        </div>
                        <span className="font-bold ml-4 text-right" style={{ color: row.highlight ? '#10253f' : '#374151' }}>{row.value}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Plan recommendation */}
              {result.planRec && (
                <div className="bg-white rounded-2xl border border-gray-200 p-5">
                  <h3 className="font-bold text-xs uppercase tracking-widest text-gray-400 mb-3">💡 Recomendación de plan</h3>
                  <div className="flex items-start gap-3">
                    <div>
                      <p className="font-bold text-gray-900">
                        Plan recomendado: <span style={{ color: '#2a6496' }}>{result.planRec}</span>
                      </p>
                      <p className="text-sm text-gray-500 mt-1">{result.planRecReason}</p>
                      {result.qualifiesCSR && (
                        <div className="mt-2 text-xs px-3 py-2 rounded-lg inline-block" style={{ background: '#ede9fe', color: '#6d28d9' }}>
                          ⭐ <strong>CSR activo:</strong> Con plan Silver, el gobierno también reduce deducible, copays y máximo de bolsillo. Es el mejor valor real para este cliente.
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              )}

              {/* Best real plans for this client */}
              {result.bestPlans && result.bestPlans.length > 0 && (
                <div className="bg-white rounded-2xl border border-gray-200 p-5">
                  <h3 className="font-bold text-xs uppercase tracking-widest text-gray-400 mb-1">🏆 Mejores planes reales para este cliente</h3>
                  <p className="text-xs text-gray-400 mb-3">
                    {result.bestPlansRankMode === 'cheapest' ? (
                      <>Ordenados por <strong>menor costo mensual</strong> — el plan más barato (incluyendo opciones a $0/mes) aparece primero.</>
                    ) : (
                      <>Ordenados por <strong>protección financiera real</strong>: 12 meses de prima + el máximo de bolsillo
                      (lo más que la familia podría llegar a pagar en un año si alguien se enferma seriamente) — no solo por el costo mensual.</>
                    )}
                    {' '}<Link href="/settings" className="underline" style={{ color: '#2a6496' }}>Cambiar criterio de orden</Link>
                  </p>
                  <div className="space-y-2">
                    {result.bestPlans.map((p, i) => (
                      <div key={p.id} className="rounded-xl border border-gray-100 p-3"
                        style={i === 0 ? { background: '#f0fdf4', borderColor: '#bbf7d0' } : {}}>
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0">
                            <p className="font-semibold text-sm text-gray-900 truncate">
                              {i === 0 && '⭐ '}{p.name}
                            </p>
                            <p className="text-xs text-gray-500 mt-0.5">
                              {p.issuer && `${p.issuer} · `}{p.metalLevel} · {p.type}
                              {p.hsaEligible && ' · Compatible con HSA'}
                            </p>
                          </div>
                          <div className="text-right shrink-0">
                            <p className="font-bold" style={{ color: i === 0 ? '#059669' : '#10253f' }}>{fmt$c(p.premiumWCredit)}/mes</p>
                            <p className="text-xs text-gray-400 line-through">{fmt$c(p.premium)}</p>
                          </div>
                        </div>
                        <div className="mt-2 pt-2 border-t border-gray-100 grid grid-cols-2 sm:grid-cols-4 gap-x-3 gap-y-1 text-xs text-gray-600">
                          <p><span className="text-gray-400">Deducible:</span> {p.deductible !== null ? fmt$(p.deductible) : '—'}</p>
                          <p><span className="text-gray-400">Máx. de bolsillo:</span> {p.moop !== null ? fmt$(p.moop) : '—'}</p>
                          <p><span className="text-gray-400">Atención primaria:</span> {p.primaryCare ?? '—'}</p>
                          <p><span className="text-gray-400">Especialista:</span> {p.specialist ?? '—'}</p>
                          <p><span className="text-gray-400">Urgencias:</span> {p.urgentCare ?? '—'}</p>
                          <p><span className="text-gray-400">Sala de emergencias:</span> {p.emergencyRoom ?? '—'}</p>
                          <p><span className="text-gray-400">Medicamentos genéricos:</span> {p.genericDrugs ?? '—'}</p>
                          <p className="font-semibold text-gray-700">
                            <span className="text-gray-400 font-normal">Peor caso anual:</span> {fmt$(p.worstCaseAnnual)}
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Actions */}
              <div className="bg-white rounded-2xl border border-gray-200 p-4">
                <div className="flex items-center justify-between flex-wrap gap-3">
                  <p className="text-xs text-gray-400 flex-1 min-w-48">
                    {result.dataSource === 'cms_exact'
                      ? `✅ Basado en planes reales del Marketplace en ZIP ${result.zipcode}`
                      : (isOwner
                          ? '⚠️ Estimación con promedios nacionales. Agrega CMS API Key para datos exactos por ZIP.'
                          : '⚠️ Estimación con promedios nacionales.')}
                  </p>
                  <div className="flex gap-2 shrink-0 flex-wrap">
                    {clientId && (
                      <button onClick={saveToClient} disabled={saving}
                        className="text-xs px-3 py-2 rounded-lg font-semibold text-white disabled:opacity-50"
                        style={{ background: '#059669' }}>
                        {saving ? '...' : '💾 Guardar en ficha del cliente'}
                      </button>
                    )}
                    <a href={`https://www.healthcare.gov/see-plans/#/`}
                      target="_blank" rel="noopener noreferrer"
                      className="text-xs px-3 py-2 rounded-lg font-semibold border"
                      style={{ color: '#2a6496', borderColor: '#b8d4e8', background: '#f0f7fb' }}>
                      🔗 Ver planes en HealthCare.gov →
                    </a>
                  </div>
                </div>
                {savedMsg && <p className="text-sm text-green-700 font-semibold mt-2 text-center">{savedMsg}</p>}
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  )
}

export default function APTCPage() {
  return (
    <Suspense fallback={<div className="flex items-center justify-center h-64 text-gray-400">Cargando calculadora...</div>}>
      <APTCInner />
    </Suspense>
  )
}
