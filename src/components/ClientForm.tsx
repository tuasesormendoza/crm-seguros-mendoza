'use client'

import { useState, useCallback, memo, useMemo, useRef, useEffect } from 'react'

const INSURERS = [
  'Anthem', 'Cigna', 'Ambetter', 'CareSource', 'Oscar',
  'Alliant', 'UnitedHealthcare', 'Molina', 'AmeriHealth', 'Health Spring',
  'Kaiser', 'Blue Cross Blue Shield',
]

const PREDEFINED_TAGS = [
  { label: 'VIP', color: '#fbbf24' },
  { label: 'Necesita seguimiento', color: '#f97316' },
  { label: 'Problema de pago', color: '#ef4444' },
  { label: 'Renovación próxima', color: '#8b5cf6' },
  { label: 'Cliente referido', color: '#10b981' },
  { label: 'Washington National', color: '#3b82f6' },
  { label: 'Documentos pendientes', color: '#6366f1' },
]

const WN_POLICY_TYPES = [
  'Accidentes',
  'Hospitalización',
  'Cáncer',
  'ACV',
  'Cardiovascular',
  'Combo Critical Illness (Cáncer, ACV, Cardiovascular)',
]

const US_STATES = [
  'Alabama', 'Alaska', 'Arizona', 'Arkansas', 'California', 'Colorado',
  'Connecticut', 'Delaware', 'Florida', 'Georgia', 'Hawaii', 'Idaho',
  'Illinois', 'Indiana', 'Iowa', 'Kansas', 'Kentucky', 'Louisiana',
  'Maine', 'Maryland', 'Massachusetts', 'Michigan', 'Minnesota',
  'Mississippi', 'Missouri', 'Montana', 'Nebraska', 'Nevada',
  'New Hampshire', 'New Jersey', 'New Mexico', 'New York',
  'North Carolina', 'North Dakota', 'Ohio', 'Oklahoma', 'Oregon',
  'Pennsylvania', 'Rhode Island', 'South Carolina', 'South Dakota',
  'Tennessee', 'Texas', 'Utah', 'Vermont', 'Virginia', 'Washington',
  'West Virginia', 'Wisconsin', 'Wyoming',
]

const INPUT_CLASS = 'w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#507b88] bg-white'
const LABEL_CLASS = 'block text-xs font-medium text-gray-600 mb-1'

// ── Masking helpers ──────────────────────────────────────────────────────────

function maskSSN(raw: string): string {
  const digits = raw.replace(/\D/g, '').slice(0, 9)
  if (digits.length <= 3) return digits
  if (digits.length <= 5) return `${digits.slice(0, 3)}-${digits.slice(3)}`
  return `${digits.slice(0, 3)}-${digits.slice(3, 5)}-${digits.slice(5)}`
}

function maskPhone(raw: string): string {
  const digits = raw.replace(/\D/g, '').slice(0, 10)
  if (digits.length <= 3) return digits.length ? `(${digits}` : ''
  if (digits.length <= 6) return `(${digits.slice(0, 3)})-${digits.slice(3)}`
  return `(${digits.slice(0, 3)})-${digits.slice(3, 6)}-${digits.slice(6)}`
}

function calcAge(dateStr: string): number | null {
  if (!dateStr) return null
  // Parse YYYY-MM-DD directly — avoids new Date() UTC-shift issue
  const parts = dateStr.split('-').map(Number)
  if (parts.length !== 3 || parts.some(isNaN)) return null
  const [bYear, bMonth, bDay] = parts  // bMonth is 1-indexed here

  const today = new Date()
  const tYear  = today.getFullYear()
  const tMonth = today.getMonth() + 1  // make 1-indexed to match bMonth
  const tDay   = today.getDate()

  let age = tYear - bYear
  if (tMonth < bMonth || (tMonth === bMonth && tDay < bDay)) age--
  return age >= 0 ? age : null
}

// ── Sub-components (defined outside to prevent remount on each keystroke) ────

const CurrencyField = memo(function CurrencyField({
  label, value, onChange,
}: {
  label: string; value: string; onChange: (v: string) => void
}) {
  const handleBlur = (e: React.FocusEvent<HTMLInputElement>) => {
    const num = parseFloat(e.target.value.replace(/[^0-9.]/g, ''))
    onChange(isNaN(num) ? '0.00' : num.toFixed(2))
  }
  return (
    <div>
      <label className={LABEL_CLASS}>{label}</label>
      <div className="relative">
        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-gray-400 pointer-events-none">$</span>
        <input
          type="number"
          min="0"
          step="0.01"
          value={value}
          onChange={e => onChange(e.target.value)}
          onBlur={handleBlur}
          className={INPUT_CLASS + ' pl-6'}
          placeholder="0.00"
        />
      </div>
    </div>
  )
})

const Field = memo(function Field({
  label, value, onChange, type = 'text', placeholder = '', suffix,
}: {
  label: string; value: string; onChange: (v: string) => void
  type?: string; placeholder?: string; suffix?: React.ReactNode
}) {
  return (
    <div>
      <label className={LABEL_CLASS}>{label}</label>
      <div className="relative">
        <input
          type={type}
          value={value}
          onChange={e => onChange(e.target.value)}
          placeholder={placeholder}
          className={INPUT_CLASS + (suffix ? ' pr-16' : '')}
        />
        {suffix && (
          <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs font-semibold" style={{ color: '#305a72' }}>
            {suffix}
          </span>
        )}
      </div>
    </div>
  )
})

const SelectField = memo(function SelectField({
  label, value, onChange, options,
}: {
  label: string; value: string; onChange: (v: string) => void; options: string[]
}) {
  return (
    <div>
      <label className={LABEL_CLASS}>{label}</label>
      <select value={value} onChange={e => onChange(e.target.value)} className={INPUT_CLASS}>
        <option value="">Seleccionar...</option>
        {options.map(o => <option key={o}>{o}</option>)}
      </select>
    </div>
  )
})

const DepRow = memo(function DepRow({
  label, dep, onChange,
}: {
  label: string
  dep: { name: string; birthDate: string; ssn: string; inPolicy: boolean | null; coverageNote: string }
  onChange: (key: 'name' | 'birthDate' | 'ssn' | 'inPolicy' | 'coverageNote', val: string | boolean | null) => void
}) {
  const [showSSN, setShowSSN] = useState(false)
  const age = calcAge(dep.birthDate)

  function isoToDisplay(iso: string): string {
    if (!iso || iso.length < 10) return ''
    const [y, m, d] = iso.split('-')
    if (!y || !m || !d) return ''
    return `${m}/${d}/${y}`
  }

  function handleDateChange(raw: string) {
    const digits = raw.replace(/\D/g, '').slice(0, 8)
    let display = digits
    if (digits.length > 2) display = `${digits.slice(0, 2)}/${digits.slice(2)}`
    if (digits.length > 4) display = `${digits.slice(0, 2)}/${digits.slice(2, 4)}/${digits.slice(4)}`
    setDateDisplay(display)
    if (digits.length === 8) {
      const mm = digits.slice(0, 2), dd = digits.slice(2, 4), yyyy = digits.slice(4, 8)
      const dt = new Date(`${yyyy}-${mm}-${dd}`)
      if (!isNaN(dt.getTime())) onChange('birthDate', `${yyyy}-${mm}-${dd}`)
    } else {
      onChange('birthDate', '')
    }
  }

  const [dateDisplay, setDateDisplay] = useState(() => isoToDisplay(dep.birthDate))
  useEffect(() => { setDateDisplay(isoToDisplay(dep.birthDate)) }, [dep.birthDate])
  return (
    <div className="p-3 rounded-lg border border-gray-100 bg-gray-50/50">
      <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
        <p className="text-xs font-semibold uppercase tracking-wide" style={{ color: '#305a72' }}>{label}</p>
        {/* ── Aplica en póliza radio buttons ── */}
        <div className="flex items-center gap-3 flex-wrap">
          <span className="text-xs text-gray-500 font-medium">¿Aplica en póliza?</span>
          <label className="flex items-center gap-1 cursor-pointer select-none">
            <input
              type="radio"
              name={`inPolicy-${label}`}
              checked={dep.inPolicy === true}
              onChange={() => { onChange('inPolicy', true); onChange('coverageNote', '') }}
              className="accent-[#305a72]"
            />
            <span className="text-xs font-semibold text-green-700">Sí</span>
          </label>
          <label className="flex items-center gap-1 cursor-pointer select-none">
            <input
              type="radio"
              name={`inPolicy-${label}`}
              checked={dep.inPolicy === false}
              onChange={() => onChange('inPolicy', false)}
              className="accent-red-500"
            />
            <span className="text-xs font-semibold text-red-600">No</span>
          </label>
          {dep.inPolicy === false && (
            <select
              value={dep.coverageNote}
              onChange={e => onChange('coverageNote', e.target.value)}
              className="text-xs border border-gray-300 rounded px-2 py-1 focus:outline-none focus:ring-1 focus:ring-[#507b88] bg-white"
            >
              <option value="">Seleccionar razón...</option>
              <option value="Medicaid">Medicaid</option>
              <option value="Medicare">Medicare</option>
              <option value="CHIP">CHIP</option>
              <option value="Trabajo">Trabajo</option>
              <option value="No tiene documentos">No tiene documentos</option>
              <option value="Otro">Otro</option>
            </select>
          )}
        </div>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        <div>
          <label className={LABEL_CLASS}>Nombre</label>
          <input value={dep.name} onChange={e => onChange('name', e.target.value)} className={INPUT_CLASS} />
        </div>
        <div>
          <label className={LABEL_CLASS}>F. Nacimiento{age !== null ? ` · ${age} años` : ''}</label>
          <input
            type="text"
            value={dateDisplay}
            onChange={e => handleDateChange(e.target.value)}
            placeholder="MM/DD/YYYY"
            maxLength={10}
            className={INPUT_CLASS}
          />
        </div>
        <div>
          <div className="flex items-center justify-between mb-1">
            <label className={LABEL_CLASS + ' mb-0'}>SSN</label>
            {dep.ssn && (
              <button type="button" onClick={() => setShowSSN(v => !v)}
                className="text-xs font-medium" style={{ color: '#507b88' }}>
                {showSSN ? '🙈 Ocultar' : '👁 Ver'}
              </button>
            )}
          </div>
          <input
            value={!dep.ssn || showSSN ? dep.ssn : '***-**-' + dep.ssn.replace(/\D/g, '').slice(-4)}
            onChange={e => {
              if (!dep.ssn || showSSN) onChange('ssn', maskSSN(e.target.value))
            }}
            readOnly={!!dep.ssn && !showSSN}
            placeholder="000-00-0000"
            maxLength={11}
            className={INPUT_CLASS + (dep.ssn && !showSSN ? ' tracking-widest text-gray-500' : '')}
          />
        </div>
      </div>
    </div>
  )
})

const DynamicList = memo(function DynamicList({
  label, items, onAdd, onRemove, onChange,
}: {
  label: string; items: string[]
  onAdd: () => void; onRemove: (i: number) => void; onChange: (i: number, val: string) => void
}) {
  return (
    <div>
      <div className="flex items-center justify-between mb-1">
        <label className={LABEL_CLASS}>{label}</label>
        <button type="button" onClick={onAdd} className="text-xs font-medium" style={{ color: '#305a72' }}>+ Agregar</button>
      </div>
      <div className="space-y-2">
        {items.map((val, i) => (
          <div key={i} className="flex gap-2">
            <input value={val} onChange={e => onChange(i, e.target.value)} className={INPUT_CLASS} />
            {items.length > 1 && (
              <button type="button" onClick={() => onRemove(i)} className="text-red-400 hover:text-red-600 px-2 text-sm">✕</button>
            )}
          </div>
        ))}
      </div>
    </div>
  )
})

interface WnPolicy { type: string; monthly: string }

const WnPolicyRow = memo(function WnPolicyRow({
  policy, index, onChange, onRemove, showRemove,
}: {
  policy: WnPolicy; index: number
  onChange: (i: number, key: keyof WnPolicy, val: string) => void
  onRemove: (i: number) => void; showRemove: boolean
}) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-3 items-end p-3 bg-gray-50 rounded-lg border border-gray-200">
      <div className="md:col-span-2">
        <label className={LABEL_CLASS}>Tipo de Póliza WN</label>
        <select value={policy.type} onChange={e => onChange(index, 'type', e.target.value)} className={INPUT_CLASS}>
          <option value="">Seleccionar...</option>
          {WN_POLICY_TYPES.map(o => <option key={o}>{o}</option>)}
        </select>
      </div>
      <div className="flex gap-2 items-end">
        <div className="flex-1">
          <label className={LABEL_CLASS}>Total Mensual ($)</label>
          <div className="relative">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-gray-400 pointer-events-none">$</span>
            <input
              type="number"
              min="0"
              step="0.01"
              value={policy.monthly}
              onChange={e => onChange(index, 'monthly', e.target.value)}
              onBlur={e => {
                const num = parseFloat(e.target.value)
                onChange(index, 'monthly', isNaN(num) ? '0.00' : num.toFixed(2))
              }}
              placeholder="0.00"
              className={INPUT_CLASS + ' pl-6'}
            />
          </div>
        </div>
        {showRemove && (
          <button type="button" onClick={() => onRemove(index)} className="mb-0.5 text-red-400 hover:text-red-600 px-2 py-2 text-sm">✕</button>
        )}
      </div>
    </div>
  )
})

// ── DateInput — always MM/DD/YYYY, cross-browser ────────────────────────────

const DateInput = memo(function DateInput({
  label, value, onChange,
}: {
  label: string
  value: string        // stored as YYYY-MM-DD
  onChange: (v: string) => void
}) {
  function isoToDisplay(iso: string): string {
    if (!iso || iso.length < 10) return ''
    const [y, m, d] = iso.split('-')
    if (!y || !m || !d) return ''
    return `${m}/${d}/${y}`
  }

  function handleChange(raw: string) {
    const digits = raw.replace(/\D/g, '').slice(0, 8)
    let display = digits
    if (digits.length > 2) display = `${digits.slice(0, 2)}/${digits.slice(2)}`
    if (digits.length > 4) display = `${digits.slice(0, 2)}/${digits.slice(2, 4)}/${digits.slice(4)}`
    setDisplayVal(display)

    if (digits.length === 8) {
      const mm = digits.slice(0, 2), dd = digits.slice(2, 4), yyyy = digits.slice(4, 8)
      const iso = `${yyyy}-${mm}-${dd}`
      const dt = new Date(`${yyyy}-${mm}-${dd}`)
      if (!isNaN(dt.getTime())) onChange(iso)
    } else {
      onChange('')
    }
  }

  const [displayVal, setDisplayVal] = useState(() => isoToDisplay(value))

  useEffect(() => {
    setDisplayVal(isoToDisplay(value))
  }, [value])

  return (
    <div>
      <label className={LABEL_CLASS}>{label}</label>
      <input
        type="text"
        value={displayVal}
        onChange={e => handleChange(e.target.value)}
        placeholder="MM/DD/YYYY"
        maxLength={10}
        className={INPUT_CLASS}
      />
    </div>
  )
})

// ── Types ────────────────────────────────────────────────────────────────────

interface Dependent { type: string; name: string; birthDate: string; ssn: string; inPolicy: boolean | null; coverageNote: string }

export interface FormData {
  fullName: string; ssn: string; birthDate: string; email: string; phone: string
  filesTaxes: string; filingStatus: string; maritalStatus: string; employmentType: string
  address: string; aptSuite: string; city: string; zipCode: string; county: string; state: string
  contractDate: string; policyYear: string; coverageType: string; insurer: string
  affiliatesCount: string; planName: string; planCategory: string; planId: string
  acaPrice: string; wnPolicies: WnPolicy[]; wnContractDate: string; totalMonthly: string
  cancellationDate: string
  annualIncome: string; status: string; activationDate: string; renewalDate: string; policyExpirationDate: string
  preferredDoctors: string[]; specificMedications: string[]
  bankHolder: string; bankName: string; bankRouting: string; bankAccount: string; bankAccountType: string
  portalUser: string; portalPassword: string; sherpaUrl: string; googleReview: string; notes: string
  preferredLanguage: string; dentalInsurer: string; dentalDeductible: string; dentalMaxBenefit: string
  dependents: Dependent[]
  firstPaymentPaid: string
  firstPaymentDate: string
  tags: string[]
  applicantInPolicy: boolean | null
  applicantExclusionReason: string
}

interface InitialData {
  fullName?: string; ssn?: string; birthDate?: string; email?: string; phone?: string
  filesTaxes?: boolean | null; filingStatus?: string; maritalStatus?: string; employmentType?: string
  address?: string; aptSuite?: string; city?: string; zipCode?: string; county?: string; state?: string
  contractDate?: string; policyYear?: number | string; coverageType?: string; insurer?: string
  affiliatesCount?: number | string; planName?: string; planCategory?: string; planId?: string
  acaPrice?: number | string; wnPolicies?: string | WnPolicy[]; wnContractDate?: string | null
  cancellationDate?: string | null
  totalMonthly?: number | string; annualIncome?: number | string; status?: string
  activationDate?: string; renewalDate?: string; policyExpirationDate?: string
  preferredDoctors?: string | string[]; specificMedications?: string | string[]
  bankHolder?: string; bankName?: string; bankRouting?: string; bankAccount?: string; bankAccountType?: string
  portalUser?: string; portalPassword?: string; sherpaUrl?: string; googleReview?: string; notes?: string
  preferredLanguage?: string; dentalInsurer?: string; dentalDeductible?: string; dentalMaxBenefit?: string
  dependents?: { type: string; name?: string; birthDate?: string; ssn?: string; inPolicy?: boolean | null; coverageNote?: string }[]
  firstPaymentPaid?: boolean | string | null
  firstPaymentDate?: string | null
  tags?: string | string[] | null
  applicantInPolicy?: boolean | null
  applicantExclusionReason?: string | null
}

interface DuplicateResult { id: string; fullName: string; reason: string }

interface Props {
  initialData?: InitialData
  onSubmit: (data: Record<string, unknown>) => Promise<void>
  submitLabel?: string
  clientId?: string  // for excluding self when editing
}

function toDateInput(val?: string | null): string {
  if (!val) return ''
  try { return new Date(val).toISOString().split('T')[0] } catch { return '' }
}

function parseJsonArray(val?: string | string[] | null): string[] {
  if (!val) return ['']
  if (Array.isArray(val)) return val.length ? val : ['']
  try { const p = JSON.parse(val); return Array.isArray(p) && p.length ? p : [''] } catch { return val ? [val] : [''] }
}

function parseWnPolicies(val?: string | WnPolicy[] | null): WnPolicy[] {
  if (!val) return [{ type: '', monthly: '' }]
  if (Array.isArray(val)) return val.length ? val.map(p => ({ type: p.type || '', monthly: String(p.monthly || '') })) : [{ type: '', monthly: '' }]
  try { const p = JSON.parse(val); return Array.isArray(p) && p.length ? p : [{ type: '', monthly: '' }] } catch { return [{ type: '', monthly: '' }] }
}

// ── Main component ────────────────────────────────────────────────────────────

export default function ClientForm({ initialData, onSubmit, submitLabel = 'Guardar', clientId }: Props) {
  const [saving, setSaving] = useState(false)
  const [showSSN, setShowSSN] = useState(false)
  const [duplicates, setDuplicates] = useState<DuplicateResult[]>([])
  const dupCheckTimeout = useRef<ReturnType<typeof setTimeout> | null>(null)

  const checkDuplicates = useCallback(async (ssn: string, name: string) => {
    if (dupCheckTimeout.current) clearTimeout(dupCheckTimeout.current)
    dupCheckTimeout.current = setTimeout(async () => {
      if (!ssn && name.length < 3) { setDuplicates([]); return }
      const params = new URLSearchParams()
      if (ssn) params.set('ssn', ssn)
      if (name) params.set('name', name)
      if (clientId) params.set('excludeId', clientId)
      const res = await fetch(`/api/clients/check-duplicate?${params}`)
      const data = await res.json()
      setDuplicates(data)
    }, 500)
  }, [clientId])

  const getD = (type: string) => initialData?.dependents?.find(d => d.type === type)
  const currentYear = new Date().getFullYear()

  const [form, setForm] = useState<FormData>(() => ({
    fullName: initialData?.fullName || '',
    ssn: initialData?.ssn || '',
    birthDate: toDateInput(initialData?.birthDate),
    email: initialData?.email || '',
    phone: initialData?.phone || '',
    filesTaxes: initialData?.filesTaxes != null ? String(initialData.filesTaxes) : '',
    filingStatus: initialData?.filingStatus || '',
    maritalStatus: initialData?.maritalStatus || '',
    employmentType: initialData?.employmentType || '',
    address: initialData?.address || '',
    aptSuite: initialData?.aptSuite || '',
    city: initialData?.city || '',
    zipCode: initialData?.zipCode || '',
    county: initialData?.county || '',
    state: initialData?.state || '',
    contractDate: toDateInput(initialData?.contractDate),
    policyYear: initialData?.policyYear?.toString() || currentYear.toString(),
    coverageType: initialData?.coverageType || '',
    insurer: initialData?.insurer || '',
    affiliatesCount: initialData?.affiliatesCount?.toString() || '1',
    planName: initialData?.planName || '',
    planCategory: initialData?.planCategory || '',
    planId: initialData?.planId || '',
    acaPrice: initialData?.acaPrice?.toString() || '0',
    wnPolicies: parseWnPolicies(initialData?.wnPolicies),
    wnContractDate: toDateInput(initialData?.wnContractDate),
    cancellationDate: toDateInput(initialData?.cancellationDate),
    totalMonthly: initialData?.totalMonthly?.toString() || '0',
    annualIncome: initialData?.annualIncome?.toString() || '',
    status: initialData?.status || 'Activo',
    activationDate: toDateInput(initialData?.activationDate) || '',
    renewalDate: toDateInput(initialData?.renewalDate) || '2026-11-15',
    policyExpirationDate: toDateInput(initialData?.policyExpirationDate) || `${currentYear}-12-31`,
    preferredDoctors: parseJsonArray(initialData?.preferredDoctors),
    specificMedications: parseJsonArray(initialData?.specificMedications),
    bankHolder: initialData?.bankHolder || '',
    bankName: initialData?.bankName || '',
    bankRouting: initialData?.bankRouting || '',
    bankAccount: initialData?.bankAccount || '',
    bankAccountType: initialData?.bankAccountType || '',
    portalUser: initialData?.portalUser || '',
    portalPassword: initialData?.portalPassword || '',
    sherpaUrl: initialData?.sherpaUrl || '',
    googleReview: initialData?.googleReview || 'Pendiente por enviar',
    notes: initialData?.notes || '',
    preferredLanguage: initialData?.preferredLanguage || '',
    dentalInsurer: initialData?.dentalInsurer || '',
    dentalDeductible: initialData?.dentalDeductible || '',
    dentalMaxBenefit: initialData?.dentalMaxBenefit || '',
    firstPaymentPaid: initialData?.firstPaymentPaid === true ? 'Sí' : initialData?.firstPaymentPaid === false ? 'No' : (initialData?.firstPaymentPaid as string || 'Pendiente'),
    firstPaymentDate: toDateInput(initialData?.firstPaymentDate),
    tags: (() => {
      const t = initialData?.tags
      if (!t) return []
      if (Array.isArray(t)) return t
      try { const p = JSON.parse(t as string); return Array.isArray(p) ? p : [] } catch { return [] }
    })(),
    applicantInPolicy: initialData?.applicantInPolicy ?? null,
    applicantExclusionReason: initialData?.applicantExclusionReason || '',
    dependents: [
      { type: 'spouse',     name: getD('spouse')?.name || '',     birthDate: toDateInput(getD('spouse')?.birthDate),     ssn: getD('spouse')?.ssn || '',     inPolicy: getD('spouse')     ? (getD('spouse')!.inPolicy     ?? null) : null, coverageNote: getD('spouse')?.coverageNote || '' },
      { type: 'dependent1', name: getD('dependent1')?.name || '', birthDate: toDateInput(getD('dependent1')?.birthDate), ssn: getD('dependent1')?.ssn || '', inPolicy: getD('dependent1') ? (getD('dependent1')!.inPolicy ?? null) : null, coverageNote: getD('dependent1')?.coverageNote || '' },
      { type: 'dependent2', name: getD('dependent2')?.name || '', birthDate: toDateInput(getD('dependent2')?.birthDate), ssn: getD('dependent2')?.ssn || '', inPolicy: getD('dependent2') ? (getD('dependent2')!.inPolicy ?? null) : null, coverageNote: getD('dependent2')?.coverageNote || '' },
      { type: 'dependent3', name: getD('dependent3')?.name || '', birthDate: toDateInput(getD('dependent3')?.birthDate), ssn: getD('dependent3')?.ssn || '', inPolicy: getD('dependent3') ? (getD('dependent3')!.inPolicy ?? null) : null, coverageNote: getD('dependent3')?.coverageNote || '' },
    ],
  }))

  const setField = useCallback((key: keyof FormData, value: string) =>
    setForm(f => ({ ...f, [key]: value })), [])

  const setDepField = useCallback((i: number, key: 'name' | 'birthDate' | 'ssn' | 'inPolicy' | 'coverageNote', val: string | boolean | null) =>
    setForm(f => { const deps = [...f.dependents]; deps[i] = { ...deps[i], [key]: val }; return { ...f, dependents: deps } }), [])

  const dep0Change = useCallback((k: 'name' | 'birthDate' | 'ssn', v: string) => setDepField(0, k, v), [setDepField])
  const dep1Change = useCallback((k: 'name' | 'birthDate' | 'ssn', v: string) => setDepField(1, k, v), [setDepField])
  const dep2Change = useCallback((k: 'name' | 'birthDate' | 'ssn', v: string) => setDepField(2, k, v), [setDepField])
  const dep3Change = useCallback((k: 'name' | 'birthDate' | 'ssn', v: string) => setDepField(3, k, v), [setDepField])
  const depHandlers = useMemo(() => [dep0Change, dep1Change, dep2Change, dep3Change], [dep0Change, dep1Change, dep2Change, dep3Change])

  const addListItem = useCallback((key: 'preferredDoctors' | 'specificMedications') =>
    setForm(f => ({ ...f, [key]: [...f[key], ''] })), [])
  const removeListItem = useCallback((key: 'preferredDoctors' | 'specificMedications', i: number) =>
    setForm(f => { const arr = f[key].filter((_, idx) => idx !== i); return { ...f, [key]: arr.length ? arr : [''] } }), [])
  const setListItem = useCallback((key: 'preferredDoctors' | 'specificMedications', i: number, val: string) =>
    setForm(f => { const arr = [...f[key]]; arr[i] = val; return { ...f, [key]: arr } }), [])

  const addWnPolicy = useCallback(() =>
    setForm(f => ({ ...f, wnPolicies: [...f.wnPolicies, { type: '', monthly: '' }] })), [])
  const removeWnPolicy = useCallback((i: number) =>
    setForm(f => { const arr = f.wnPolicies.filter((_, idx) => idx !== i); return { ...f, wnPolicies: arr.length ? arr : [{ type: '', monthly: '' }] } }), [])
  const changeWnPolicy = useCallback((i: number, key: keyof WnPolicy, val: string) =>
    setForm(f => {
      const arr = [...f.wnPolicies]
      arr[i] = { ...arr[i], [key]: val }
      const wnTotal = arr.reduce((sum, p) => sum + (parseFloat(p.monthly) || 0), 0)
      const acaPrice = parseFloat(f.acaPrice) || 0
      return { ...f, wnPolicies: arr, totalMonthly: (acaPrice + wnTotal).toFixed(2) }
    }), [])

  // Recalculate total when ACA price changes
  const setAcaPrice = useCallback((val: string) =>
    setForm(f => {
      const acaPrice = parseFloat(val) || 0
      const wnTotal = f.wnPolicies.reduce((sum, p) => sum + (parseFloat(p.monthly) || 0), 0)
      return { ...f, acaPrice: val, totalMonthly: (acaPrice + wnTotal).toFixed(2) }
    }), [])

  const age = calcAge(form.birthDate)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setSaving(true)
    try {
      await onSubmit({
        ...form,
        preferredDoctors: form.preferredDoctors.filter(Boolean),
        specificMedications: form.specificMedications.filter(Boolean),
        wnPolicies: form.wnPolicies.filter(p => p.type || p.monthly),
        tags: form.tags,
      })
    } finally { setSaving(false) }
  }

  const SECTION = 'bg-white rounded-xl border border-gray-200 p-5'
  const TITLE = 'font-semibold text-[#10253f] mb-4 text-base'

  return (
    <form onSubmit={handleSubmit} className="space-y-6">

      {/* Identificación */}
      <div className={SECTION}>
        <h2 className={TITLE}>Identificación</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          <div className="md:col-span-2">
            <Field label="Nombre Completo *" value={form.fullName} onChange={v => setField('fullName', v)} />
            <div onBlur={() => checkDuplicates(form.ssn, form.fullName)} />
          </div>
          <div>
            <div className="flex items-center justify-between mb-1">
              <label className={LABEL_CLASS + ' mb-0'}>SSN</label>
              {form.ssn && (
                <button type="button" onClick={() => setShowSSN(v => !v)}
                  className="text-xs font-medium" style={{ color: '#507b88' }}>
                  {showSSN ? '🙈 Ocultar' : '👁 Ver'}
                </button>
              )}
            </div>
            <input
              value={!form.ssn || showSSN ? form.ssn : '***-**-' + form.ssn.replace(/\D/g, '').slice(-4)}
              onChange={e => {
                if (!form.ssn || showSSN) setField('ssn', maskSSN(e.target.value))
              }}
              onBlur={() => checkDuplicates(form.ssn, form.fullName)}
              readOnly={!!form.ssn && !showSSN}
              placeholder="000-00-0000"
              maxLength={11}
              className={INPUT_CLASS + (form.ssn && !showSSN ? ' tracking-widest text-gray-500' : '')}
            />
          </div>
          {duplicates.length > 0 && (
            <div className="md:col-span-3 p-3 rounded-lg border border-yellow-300 bg-yellow-50">
              <p className="text-sm font-semibold text-yellow-800 mb-1">⚠️ Posible cliente duplicado:</p>
              {duplicates.map(d => (
                <div key={d.id} className="flex items-center justify-between text-sm text-yellow-900 py-0.5">
                  <span>• {d.fullName} — <span className="text-xs font-medium">{d.reason}</span></span>
                  <a href={`/clients/${d.id}`} target="_blank" rel="noreferrer" className="text-xs font-semibold underline text-yellow-700 ml-2">Ver →</a>
                </div>
              ))}
            </div>
          )}
          <div>
            <DateInput
              label={`Fecha de Nacimiento${age !== null ? ` · ${age} años` : ''}`}
              value={form.birthDate}
              onChange={v => setField('birthDate', v)}
            />
          </div>
          <Field label="Email" value={form.email} onChange={v => setField('email', v)} type="email" />
          <div>
            <label className={LABEL_CLASS}>Teléfono</label>
            <input
              value={form.phone}
              onChange={e => setField('phone', maskPhone(e.target.value))}
              placeholder="(000)-000-0000"
              maxLength={14}
              className={INPUT_CLASS}
            />
          </div>

          {/* Preferred language */}
          <div>
            <label className={LABEL_CLASS}>🌐 Idioma Preferido</label>
            <select value={form.preferredLanguage} onChange={e => setField('preferredLanguage', e.target.value)} className={INPUT_CLASS}>
              <option value="">Seleccionar...</option>
              <option value="Español">🇪🇸 Español</option>
              <option value="English">🇺🇸 English</option>
            </select>
          </div>

          {/* Tax / Employment fields */}
          <div className="md:col-span-3 pt-2 border-t border-gray-100 mt-1">
            <p className="text-xs font-bold uppercase tracking-wide text-gray-400 mb-3">Información Fiscal y Laboral</p>
          </div>

          <div>
            <label className={LABEL_CLASS}>Estado Civil</label>
            <select value={form.maritalStatus} onChange={e => setField('maritalStatus', e.target.value)} className={INPUT_CLASS}>
              <option value="">Seleccionar...</option>
              <option>Soltero/a</option>
              <option>Casado/a</option>
              <option>Unión libre</option>
              <option>Divorciado/a</option>
              <option>Viudo/a</option>
            </select>
          </div>

          <div>
            <label className={LABEL_CLASS}>Tipo de pago en trabajo</label>
            <select value={form.employmentType} onChange={e => setField('employmentType', e.target.value)} className={INPUT_CLASS}>
              <option value="">Seleccionar...</option>
              <option value="W-2">W-2 (empleado)</option>
              <option value="1099">1099 (independiente)</option>
              <option value="Ambos">Ambos (W-2 y 1099)</option>
              <option value="No trabaja">No trabaja</option>
            </select>
          </div>

          <div>
            <label className={LABEL_CLASS}>¿Declara impuestos?</label>
            <select value={form.filesTaxes} onChange={e => setField('filesTaxes', e.target.value)} className={INPUT_CLASS}>
              <option value="">Seleccionar...</option>
              <option value="true">Sí</option>
              <option value="false">No</option>
            </select>
          </div>

          {form.filesTaxes === 'true' && (
            <div className="md:col-span-2">
              <label className={LABEL_CLASS}>Cómo declara (Filing Status)</label>
              <select value={form.filingStatus} onChange={e => setField('filingStatus', e.target.value)} className={INPUT_CLASS}>
                <option value="">Seleccionar...</option>
                <option>Soltero/a (Single)</option>
                <option>Casado/a declarando en conjunto (Married Filing Jointly)</option>
                <option>Casado/a declarando por separado (Married Filing Separately)</option>
                <option>Cabeza de familia (Head of Household)</option>
                <option>Viudo/a calificado/a con hijo dependiente (Qualifying Widow/er)</option>
              </select>
            </div>
          )}
        </div>
      </div>

      {/* Ubicación */}
      <div className={SECTION}>
        <h2 className={TITLE}>Ubicación</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          <div className="md:col-span-2">
            <Field label="Dirección" value={form.address} onChange={v => setField('address', v)} placeholder="123 Main St" />
          </div>
          <Field label="Apt / Suite / Unidad" value={form.aptSuite} onChange={v => setField('aptSuite', v)} placeholder="Apt 4B, Suite 200..." />
          <Field label="Ciudad" value={form.city} onChange={v => setField('city', v)} />
          <SelectField label="Estado" value={form.state} onChange={v => setField('state', v)} options={US_STATES} />
          <Field label="Código Postal" value={form.zipCode} onChange={v => setField('zipCode', v)} placeholder="00000" />
          <Field label="Condado" value={form.county} onChange={v => setField('county', v)} />
        </div>
      </div>

      {/* Póliza ACA */}
      <div className={SECTION}>
        <h2 className={TITLE}>Póliza ACA</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          <DateInput label="Fecha Contratación" value={form.contractDate} onChange={v => setField('contractDate', v)} />
          <Field label="Año Póliza" value={form.policyYear} onChange={v => setField('policyYear', v)} />
          <SelectField label="Estatus" value={form.status} onChange={v => setField('status', v)}
            options={['Activo', 'Cancelado', 'Pendiente de Pago', 'Renovado', 'En Proceso']} />
          <SelectField label="¿Pagó Primera Prima?" value={form.firstPaymentPaid} onChange={v => setField('firstPaymentPaid', v)}
            options={['Sí', 'No', 'Pendiente']} />
          {form.firstPaymentPaid === 'Sí' && (
            <DateInput label="Fecha Primer Pago" value={form.firstPaymentDate} onChange={v => setField('firstPaymentDate', v)} />
          )}
          {form.status === 'Cancelado' && (
            <DateInput label="Fecha de Cancelación" value={form.cancellationDate} onChange={v => setField('cancellationDate', v)} />
          )}
          <SelectField label="Tipo de Cobertura" value={form.coverageType} onChange={v => setField('coverageType', v)}
            options={['Individual', 'Individual + Cónyuge', 'Familiar', 'Hijo']} />
          {/* Applicant in Policy */}
          <div>
            <label className={LABEL_CLASS}>¿El solicitante está incluido en la póliza?</label>
            <div className="flex gap-4 mt-1">
              <label className="flex items-center gap-2 cursor-pointer select-none">
                <input
                  type="radio"
                  name="applicantInPolicy"
                  checked={form.applicantInPolicy === true || form.applicantInPolicy === null}
                  onChange={() => setForm(f => ({ ...f, applicantInPolicy: true, applicantExclusionReason: '' }))}
                  className="accent-[#305a72]"
                />
                <span className="text-sm font-semibold text-green-700">Sí</span>
              </label>
              <label className="flex items-center gap-2 cursor-pointer select-none">
                <input
                  type="radio"
                  name="applicantInPolicy"
                  checked={form.applicantInPolicy === false}
                  onChange={() => setForm(f => ({ ...f, applicantInPolicy: false }))}
                  className="accent-red-500"
                />
                <span className="text-sm font-semibold text-red-600">No</span>
              </label>
            </div>
          </div>
          {form.applicantInPolicy === false && (
            <SelectField
              label="Razón de exclusión"
              value={form.applicantExclusionReason}
              onChange={v => setField('applicantExclusionReason', v)}
              options={[
                'No tiene SSN / ITIN',
                'Tiene Medicare',
                'Tiene Medicaid',
                'Tiene cobertura por trabajo',
                'No califica por ingresos',
                'Otro',
              ]}
            />
          )}
          <SelectField label="Aseguradora" value={form.insurer} onChange={v => setField('insurer', v)} options={INSURERS} />
          <Field label="Número de Afiliados" value={form.affiliatesCount} onChange={v => setField('affiliatesCount', v)} type="number" />
          <div className="lg:col-span-2">
            <Field label="Nombre del Plan" value={form.planName} onChange={v => setField('planName', v)} />
          </div>
          <SelectField label="Categoría del Plan" value={form.planCategory} onChange={v => setField('planCategory', v)}
            options={['Bronze', 'Silver', 'Gold', 'Platinum']} />
          <Field label="ID de Intercambio" value={form.planId} onChange={v => setField('planId', v)} />
          <CurrencyField label="Precio ACA ($)" value={form.acaPrice} onChange={setAcaPrice} />
          <CurrencyField label="Ingresos Anuales Individual/Familiar ($)" value={form.annualIncome} onChange={v => setField('annualIncome', v)} />
          <DateInput label="📅 Fecha de Activación" value={form.activationDate} onChange={v => setField('activationDate', v)} />
          <DateInput label="Próx. Renovación" value={form.renewalDate} onChange={v => setField('renewalDate', v)} />
          <DateInput label="Vencimiento Póliza (12/31)" value={form.policyExpirationDate} onChange={v => setField('policyExpirationDate', v)} />
        </div>
      </div>

      {/* Washington National */}
      <div className={SECTION}>
        <div className="flex items-center justify-between mb-4">
          <h2 className={TITLE + ' mb-0'}>Washington National</h2>
          <button type="button" onClick={addWnPolicy} className="text-xs font-semibold px-3 py-1.5 rounded-lg text-white" style={{ background: '#305a72' }}>
            + Agregar Póliza
          </button>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-4">
          <DateInput label="Fecha de Contratación WN" value={form.wnContractDate} onChange={v => setField('wnContractDate', v)} />
          <p className="text-xs text-gray-400 self-end pb-2">
            Usa esta fecha para calcular comisión/riesgo de WN — a veces difiere de la "Fecha Contratación" del ACA. Si se deja vacía, se usa la fecha de contratación del ACA.
          </p>
        </div>
        <div className="space-y-3">
          {form.wnPolicies.map((p, i) => (
            <WnPolicyRow key={i} policy={p} index={i} onChange={changeWnPolicy} onRemove={removeWnPolicy} showRemove={form.wnPolicies.length > 1} />
          ))}
        </div>
        {form.wnPolicies.length > 0 && (
          <div className="mt-3 pt-3 border-t border-gray-200 flex justify-end">
            <div className="text-sm font-semibold" style={{ color: '#10253f' }}>
              Total Mensual (ACA + WN): <span className="text-lg">${form.totalMonthly}</span>
            </div>
          </div>
        )}
      </div>

      {/* Familia / Dependientes */}
      <div className={SECTION}>
        <h2 className={TITLE}>Familia / Dependientes</h2>
        <div className="space-y-5">
          {(['Cónyuge', 'Dependiente 1', 'Dependiente 2', 'Dependiente 3'] as const).map((label, i) => (
            <DepRow key={i} label={label} dep={form.dependents[i]} onChange={depHandlers[i]} />
          ))}
        </div>
      </div>

      {/* Médico / Medicamentos */}
      <div className={SECTION}>
        <h2 className={TITLE}>Médico / Medicamentos</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <DynamicList
            label="Médicos Preferidos"
            items={form.preferredDoctors}
            onAdd={() => addListItem('preferredDoctors')}
            onRemove={i => removeListItem('preferredDoctors', i)}
            onChange={(i, v) => setListItem('preferredDoctors', i, v)}
          />
          <DynamicList
            label="Medicamentos Específicos"
            items={form.specificMedications}
            onAdd={() => addListItem('specificMedications')}
            onRemove={i => removeListItem('specificMedications', i)}
            onChange={(i, v) => setListItem('specificMedications', i, v)}
          />
        </div>
      </div>

      {/* Banco */}
      <div className="bg-white rounded-xl border border-yellow-300 p-5">
        <h2 className="font-semibold mb-1 text-base" style={{ color: '#10253f' }}>Banco (Datos Protegidos)</h2>
        <p className="text-xs text-yellow-700 mb-4">Información confidencial — manejese con cuidado</p>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          <Field label="Titular de Cuenta" value={form.bankHolder} onChange={v => setField('bankHolder', v)} />
          <Field label="Banco" value={form.bankName} onChange={v => setField('bankName', v)} />
          <Field label="Número de Ruta" value={form.bankRouting} onChange={v => setField('bankRouting', v)} />
          <Field label="Número de Cuenta" value={form.bankAccount} onChange={v => setField('bankAccount', v)} />
          <SelectField label="Tipo de Cuenta" value={form.bankAccountType} onChange={v => setField('bankAccountType', v)}
            options={['Cheques', 'Ahorros']} />
        </div>
      </div>

      {/* Acceso al Portal */}
      <div className={SECTION}>
        <h2 className={TITLE}>Acceso al Portal de la Aseguradora</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          <Field label="Usuario Portal" value={form.portalUser} onChange={v => setField('portalUser', v)} />
          <Field label="Contraseña Portal" value={form.portalPassword} onChange={v => setField('portalPassword', v)} />
          <div className="md:col-span-2 lg:col-span-3">
            <Field label="Link HealthSherpa" value={form.sherpaUrl} onChange={v => setField('sherpaUrl', v)} placeholder="https://www.healthsherpa.com/agents/..." />
          </div>
          <div className="md:col-span-2 lg:col-span-3">
            <label className={LABEL_CLASS}>Notas</label>
            <textarea value={form.notes} onChange={e => setField('notes', e.target.value)} rows={3} className={INPUT_CLASS} />
          </div>
        </div>
      </div>

      {/* Etiquetas */}
      <div className={SECTION}>
        <h2 className={TITLE}>Etiquetas</h2>
        <div className="space-y-3">
          <div className="flex flex-wrap gap-2">
            {PREDEFINED_TAGS.map(tag => {
              const selected = form.tags.includes(tag.label)
              return (
                <button
                  key={tag.label}
                  type="button"
                  onClick={() => setForm(f => ({
                    ...f,
                    tags: selected ? f.tags.filter(t => t !== tag.label) : [...f.tags, tag.label]
                  }))}
                  className="px-3 py-1 rounded-full text-xs font-semibold border-2 transition-all"
                  style={{
                    borderColor: tag.color,
                    background: selected ? tag.color : 'transparent',
                    color: selected ? '#fff' : tag.color,
                  }}
                >
                  {tag.label}
                </button>
              )
            })}
          </div>
          <div className="flex gap-2">
            <input
              id="custom-tag-input"
              type="text"
              placeholder="Etiqueta personalizada (Enter para agregar)"
              className={INPUT_CLASS}
              onKeyDown={e => {
                if (e.key === 'Enter') {
                  e.preventDefault()
                  const val = (e.target as HTMLInputElement).value.trim()
                  if (val && !form.tags.includes(val)) {
                    setForm(f => ({ ...f, tags: [...f.tags, val] }));
                    (e.target as HTMLInputElement).value = ''
                  }
                }
              }}
            />
          </div>
          {form.tags.length > 0 && (
            <div className="flex flex-wrap gap-1 mt-1">
              {form.tags.map(t => (
                <span key={t} className="px-2 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-700 flex items-center gap-1">
                  {t}
                  <button type="button" onClick={() => setForm(f => ({ ...f, tags: f.tags.filter(x => x !== t) }))} className="hover:text-red-500 ml-0.5">✕</button>
                </span>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Dental Insurance */}
      <div className={SECTION}>
        <h2 className={TITLE}>🦷 Póliza Dental</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Field label="Aseguradora Dental" value={form.dentalInsurer} onChange={v => setField('dentalInsurer', v)} placeholder="Ej: Delta Dental, Cigna..." />
          <Field label="Deducible Dental" value={form.dentalDeductible} onChange={v => setField('dentalDeductible', v)} placeholder="Ej: $50, $100" />
          <Field label="Beneficio Máximo Anual" value={form.dentalMaxBenefit} onChange={v => setField('dentalMaxBenefit', v)} placeholder="Ej: $1,000, $1,500" />
        </div>
      </div>

      {/* Google Review */}
      <div className={SECTION}>
        <h2 className={TITLE}>Google Review</h2>
        <div className="max-w-xs">
          <SelectField label="Estado del Google Review" value={form.googleReview} onChange={v => setField('googleReview', v)}
            options={['Pendiente por enviar', 'Enviada', 'Esperando por el cliente', 'Realizada']} />
        </div>
      </div>

      <div className="flex justify-end pb-4">
        <button
          type="submit"
          disabled={saving || !form.fullName}
          className="px-8 py-2.5 rounded-lg font-semibold text-white disabled:opacity-50 transition-opacity"
          style={{ background: '#10253f' }}
        >
          {saving ? 'Guardando...' : submitLabel}
        </button>
      </div>
    </form>
  )
}
