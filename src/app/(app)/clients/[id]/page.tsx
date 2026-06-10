'use client'

import { useEffect, useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { formatDate, formatDateTime, formatCurrency, getAge } from '@/lib/utils'
import ClientForm from '@/components/ClientForm'
import DocumentsSection from '@/components/DocumentsSection'
import ContactButtons from '@/components/ContactButtons'

const PREDEFINED_TAGS = [
  { label: 'VIP', color: '#fbbf24' },
  { label: 'Necesita seguimiento', color: '#f97316' },
  { label: 'Problema de pago', color: '#ef4444' },
  { label: 'Renovación próxima', color: '#8b5cf6' },
  { label: 'Cliente referido', color: '#10b981' },
  { label: 'Washington National', color: '#3b82f6' },
  { label: 'Documentos pendientes', color: '#6366f1' },
]

function getTagColor(label: string): string {
  return PREDEFINED_TAGS.find(t => t.label === label)?.color || '#507b88'
}

interface WnPolicy { type: string; monthly: string | number }

interface Appointment {
  id: string
  date: string
  notes?: string | null
  status: string
}

interface PolicyHistoryEntry {
  id: string
  year: number
  insurer?: string | null
  planName?: string | null
  planCategory?: string | null
  acaPrice?: number | null
  totalMonthly?: number | null
  wnPolicies?: string | null
  notes?: string | null
  recordedAt: string
}

interface Client {
  id: string
  fullName: string; ssn?: string | null; birthDate?: string | null
  email?: string | null; phone?: string | null
  filesTaxes?: boolean | null; filingStatus?: string | null
  maritalStatus?: string | null; employmentType?: string | null
  address?: string | null; aptSuite?: string | null; city?: string | null; zipCode?: string | null
  county?: string | null; state?: string | null
  contractDate?: string | null; policyYear?: number | null
  coverageType?: string | null; insurer?: string | null; affiliatesCount?: number | null
  planName?: string | null; planCategory?: string | null; planId?: string | null
  planNetwork?: string | null; planDeductible?: string | null; planMaxOOP?: string | null
  planPCP?: string | null; planSpecialist?: string | null; planUrgentCare?: string | null
  planHospital?: string | null; planRxGeneric?: string | null
  planXray?: string | null; planCTScan?: string | null; planLab?: string | null
  planReferral?: string | null
  acaPrice?: number | null; wnPolicies?: string | null
  wnContractDate?: string | null; cancellationDate?: string | null
  totalMonthly?: number | null; annualIncome?: number | null
  status?: string | null; activationDate?: string | null; renewalDate?: string | null; policyExpirationDate?: string | null
  preferredDoctors?: string | null; specificMedications?: string | null
  bankHolder?: string | null; bankName?: string | null; bankRouting?: string | null
  bankAccount?: string | null; bankAccountType?: string | null
  portalUser?: string | null; portalPassword?: string | null
  sherpaUrl?: string | null
  googleReview?: string | null; notes?: string | null
  preferredLanguage?: string | null
  dentalInsurer?: string | null; dentalDeductible?: string | null; dentalMaxBenefit?: string | null
  firstPaymentPaid?: boolean | null; firstPaymentDate?: string | null
  tags?: string | null
  applicantInPolicy?: boolean | null; applicantExclusionReason?: string | null
  dependents: { id: string; type: string; name?: string | null; birthDate?: string | null; ssn?: string | null; inPolicy?: boolean | null; coverageNote?: string | null }[]
  appointments: Appointment[]
}

const STATUS_COLORS: Record<string, { bg: string; text: string }> = {
  'Activo':            { bg: '#dcfce7', text: '#166534' },
  'Cancelado':         { bg: '#fee2e2', text: '#991b1b' },
  'Pendiente de Pago': { bg: '#fef9c3', text: '#854d0e' },
  'Renovado':          { bg: '#dbeafe', text: '#1e40af' },
  'En Proceso':        { bg: '#f3e8ff', text: '#6b21a8' },
}

const APPT_STATUS_COLORS: Record<string, { bg: string; text: string }> = {
  'Programada':  { bg: '#dbeafe', text: '#1e40af' },
  'Completada':  { bg: '#dcfce7', text: '#166534' },
  'Cancelada':   { bg: '#fee2e2', text: '#991b1b' },
  'Reagendada':  { bg: '#fef9c3', text: '#854d0e' },
}

function parseList(val?: string | null): string[] {
  if (!val) return []
  try { const p = JSON.parse(val); return Array.isArray(p) ? p.filter(Boolean) : [val] } catch { return [val] }
}

function parseWn(val?: string | null): WnPolicy[] {
  if (!val) return []
  try { const p = JSON.parse(val); return Array.isArray(p) ? p : [] } catch { return [] }
}

function InfoItem({ label, value }: { label: string; value?: string | number | null }) {
  return (
    <div>
      <dt className="text-xs font-medium uppercase tracking-wide" style={{ color: '#507b88' }}>{label}</dt>
      <dd className="mt-0.5 text-sm text-gray-900">{value ?? '—'}</dd>
    </div>
  )
}

function CopyButton({ value }: { value?: string | null }) {
  const [copied, setCopied] = useState(false)
  if (!value) return null
  return (
    <button
      type="button"
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(value)
          setCopied(true)
          setTimeout(() => setCopied(false), 1400)
        } catch { /* clipboard unavailable — silently ignore */ }
      }}
      className="text-xs font-medium shrink-0 transition-colors"
      style={{ color: copied ? '#166534' : '#507b88' }}
      title="Copiar al portapapeles"
    >
      {copied ? '✓ Copiado' : '📋 Copiar'}
    </button>
  )
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="bg-white rounded-xl border border-gray-200 p-5">
      <h2 className="font-semibold mb-4 text-base" style={{ color: '#10253f' }}>{title}</h2>
      {children}
    </div>
  )
}

// ── Appointment Modal ────────────────────────────────────────────────────────

function AppointmentModal({ onClose, onSave }: {
  onClose: () => void
  onSave: (data: { date: string; notes: string; status: string }) => Promise<void>
}) {
  const [date, setDate] = useState('')
  const [time, setTime] = useState('09:00')
  const [notes, setNotes] = useState('')
  const [status, setStatus] = useState('Programada')
  const [saving, setSaving] = useState(false)

  const handle = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!date) return
    setSaving(true)
    try { await onSave({ date: `${date}T${time}:00`, notes, status }) } finally { setSaving(false) }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" onClick={onClose}>
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-md mx-4 p-6" onClick={e => e.stopPropagation()}>
        <h3 className="text-lg font-bold mb-4" style={{ color: '#10253f' }}>Agendar Cita</h3>
        <form onSubmit={handle} className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Fecha *</label>
              <input type="date" value={date} onChange={e => setDate(e.target.value)} required
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#507b88]" />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Hora</label>
              <input type="time" value={time} onChange={e => setTime(e.target.value)}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#507b88]" />
            </div>
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Motivo / Notas</label>
            <textarea value={notes} onChange={e => setNotes(e.target.value)} rows={3}
              placeholder="Revisión de póliza, cotización, etc."
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#507b88]" />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Estatus</label>
            <select value={status} onChange={e => setStatus(e.target.value)}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#507b88]">
              {['Programada', 'Completada', 'Cancelada', 'Reagendada'].map(s => <option key={s}>{s}</option>)}
            </select>
          </div>
          <div className="flex gap-3 pt-2">
            <button type="button" onClick={onClose} className="flex-1 border border-gray-300 text-gray-600 rounded-lg py-2 text-sm hover:bg-gray-50">
              Cancelar
            </button>
            <button type="submit" disabled={saving || !date}
              className="flex-1 text-white rounded-lg py-2 text-sm font-semibold disabled:opacity-50"
              style={{ background: '#10253f' }}>
              {saving ? 'Guardando...' : 'Guardar Cita'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

// ── HealthSherpa inline link ─────────────────────────────────────────────────

function SherpaLink({ clientId, initialUrl, onSaved }: {
  clientId: string | null
  initialUrl?: string | null
  onSaved: (url: string | null) => void
}) {
  const [editing, setEditing] = useState(false)
  const [url, setUrl] = useState(initialUrl || '')
  const [saving, setSaving] = useState(false)

  async function save() {
    if (!clientId) return
    setSaving(true)
    await fetch(`/api/clients/${clientId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ sherpaUrl: url || null }),
    })
    setSaving(false)
    setEditing(false)
    onSaved(url || null)
  }

  return (
    <div>
      <dt className="text-xs font-medium uppercase tracking-wide mb-1.5" style={{ color: '#507b88' }}>HealthSherpa</dt>
      {editing ? (
        <div className="flex gap-2">
          <input
            autoFocus
            type="url"
            value={url}
            onChange={e => setUrl(e.target.value)}
            placeholder="https://www.healthsherpa.com/agents/..."
            className="flex-1 text-xs border rounded-lg px-2.5 py-1.5 outline-none"
            style={{ borderColor: '#4a90b8', background: '#f0f7fb', color: '#0f172a' }}
            onKeyDown={e => { if (e.key === 'Enter') save(); if (e.key === 'Escape') setEditing(false) }}
          />
          <button onClick={save} disabled={saving}
            className="px-3 py-1.5 rounded-lg text-xs font-semibold text-white disabled:opacity-50"
            style={{ background: '#2a6496' }}>
            {saving ? '...' : 'Guardar'}
          </button>
          <button onClick={() => { setEditing(false); setUrl(initialUrl || '') }}
            className="px-3 py-1.5 rounded-lg text-xs border"
            style={{ color: '#64748b', borderColor: '#e2e8f0' }}>
            Cancelar
          </button>
        </div>
      ) : (
        <div className="flex items-center gap-2">
          {url ? (
            <>
              <a href={url} target="_blank" rel="noopener noreferrer"
                className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm font-semibold text-white transition-all hover:opacity-90"
                style={{ background: 'linear-gradient(135deg, #16a34a, #15803d)', boxShadow: '0 2px 6px rgba(22,163,74,.3)' }}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/>
                  <polyline points="15 3 21 3 21 9"/>
                  <line x1="10" y1="14" x2="21" y2="3"/>
                </svg>
                Abrir en Sherpa
              </a>
              <button onClick={() => setEditing(true)}
                className="text-xs px-2 py-1.5 rounded-lg border transition-colors hover:bg-gray-50"
                style={{ color: '#64748b', borderColor: '#e2e8f0' }}>
                ✏️ Editar
              </button>
            </>
          ) : (
            <button onClick={() => setEditing(true)}
              className="inline-flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg border transition-colors hover:bg-gray-50"
              style={{ color: '#64748b', borderColor: '#e2e8f0', borderStyle: 'dashed' }}>
              + Agregar link de Sherpa
            </button>
          )}
        </div>
      )}
    </div>
  )
}

// ── Plan Benefits inline-editable section ────────────────────────────────────

const BENEFIT_FIELDS = [
  { key: 'planNetwork',    label: 'Tipo de Red',                  group: 'plan',   icon: '🌐' },
  { key: 'planReferral',   label: 'Referido p/ Especialista',     group: 'plan',   icon: '📋' },
  { key: 'planDeductible', label: 'Deducible',                    group: 'costs',  icon: '💰' },
  { key: 'planMaxOOP',     label: 'Máx. de Bolsillo',             group: 'costs',  icon: '🛡' },
  { key: 'planPCP',        label: 'Médico Primario (PCP)',         group: 'visits', icon: '👨‍⚕️' },
  { key: 'planSpecialist', label: 'Especialista',                  group: 'visits', icon: '🩺' },
  { key: 'planUrgentCare', label: 'Urgent Care',                   group: 'visits', icon: '🚑' },
  { key: 'planHospital',   label: 'Hospitalización',               group: 'visits', icon: '🏥' },
  { key: 'planRxGeneric',  label: 'Medicamentos Genéricos',        group: 'meds',   icon: '💊' },
  { key: 'planXray',       label: 'Rayos X',                       group: 'diag',   icon: '🦴' },
  { key: 'planCTScan',     label: 'CT / PET Scans / MRI',          group: 'diag',   icon: '🔬' },
  { key: 'planLab',        label: 'Laboratorios',                  group: 'diag',   icon: '🧪' },
] as const

type BenefitKey = typeof BENEFIT_FIELDS[number]['key']

const GROUP_TITLES: Record<string,string> = {
  plan: 'Red y Referidos', costs: 'Costos Financieros',
  visits: 'Costos de Visita', meds: 'Medicamentos', diag: 'Diagnósticos e Imágenes',
}

interface BenefitClient {
  planNetwork?: string | null; planReferral?: string | null
  planDeductible?: string | null; planMaxOOP?: string | null
  planPCP?: string | null; planSpecialist?: string | null
  planUrgentCare?: string | null; planHospital?: string | null
  planRxGeneric?: string | null; planXray?: string | null
  planCTScan?: string | null; planLab?: string | null
}

function PlanBenefitsSection({ client, clientId, onUpdated }: {
  client: BenefitClient; clientId: string | null; onUpdated: () => void
}) {
  const [editing, setEditing] = useState(false)
  const [values, setValues] = useState<Record<string, string>>(() => {
    const init: Record<string, string> = {}
    BENEFIT_FIELDS.forEach(f => { init[f.key] = (client as Record<string, string | null>)[f.key] || '' })
    return init
  })
  const [saving, setSaving] = useState(false)

  const hasBenefits = BENEFIT_FIELDS.some(f => (client as Record<string, string | null>)[f.key])

  async function save() {
    if (!clientId) return
    setSaving(true)
    const patch: Record<string, string | null> = {}
    BENEFIT_FIELDS.forEach(f => { patch[f.key] = values[f.key] || null })
    await fetch(`/api/clients/${clientId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(patch),
    })
    setSaving(false)
    setEditing(false)
    onUpdated()
  }

  const groups = [...new Set(BENEFIT_FIELDS.map(f => f.group))]

  return (
    <div className="bg-white rounded-xl border border-gray-200 p-5">
      <div className="flex items-center justify-between mb-4">
        <h2 className="font-semibold text-base" style={{ color: '#10253f' }}>📊 Beneficios del Plan</h2>
        {!editing ? (
          <button onClick={() => setEditing(true)}
            className="text-xs px-3 py-1.5 rounded-lg font-semibold text-white"
            style={{ background: '#305a72' }}>
            {hasBenefits ? '✏️ Editar' : '+ Agregar beneficios'}
          </button>
        ) : (
          <div className="flex gap-2">
            <button onClick={save} disabled={saving}
              className="text-xs px-3 py-1.5 rounded-lg font-semibold text-white disabled:opacity-50"
              style={{ background: '#2a6496' }}>
              {saving ? '...' : '✓ Guardar'}
            </button>
            <button onClick={() => setEditing(false)}
              className="text-xs px-3 py-1.5 rounded-lg border font-medium"
              style={{ color: '#64748b', borderColor: '#e2e8f0' }}>
              Cancelar
            </button>
          </div>
        )}
      </div>

      {!hasBenefits && !editing ? (
        <div className="text-center py-4">
          <p className="text-sm text-gray-400">Sin información de beneficios</p>
          <p className="text-xs text-gray-300 mt-1">
            Sube el brochure PDF en Documentos (🤖) o haz clic en &quot;+ Agregar beneficios&quot;
          </p>
        </div>
      ) : editing ? (
        <div className="space-y-4">
          {groups.map(group => (
            <div key={group}>
              <p className="text-xs font-bold uppercase tracking-wide mb-2" style={{ color: '#507b88' }}>
                {GROUP_TITLES[group]}
              </p>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                {BENEFIT_FIELDS.filter(f => f.group === group).map(f => (
                  <div key={f.key}>
                    <label className="block text-xs font-medium text-gray-500 mb-1">{f.icon} {f.label}</label>
                    <input
                      value={values[f.key]}
                      onChange={e => setValues(v => ({ ...v, [f.key]: e.target.value }))}
                      placeholder={f.key === 'planReferral' ? 'Sí / No' : '$0 copay'}
                      className="w-full border border-gray-200 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#507b88] bg-white"
                    />
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="space-y-4">
          {groups.map(group => {
            const groupFields = BENEFIT_FIELDS.filter(f =>
              f.group === group && (client as Record<string, string | null>)[f.key]
            )
            if (groupFields.length === 0) return null
            return (
              <div key={group}>
                <p className="text-xs font-bold uppercase tracking-wide mb-2" style={{ color: '#507b88' }}>
                  {GROUP_TITLES[group]}
                </p>
                <div className="grid grid-cols-2 gap-x-6 gap-y-2">
                  {groupFields.map(f => (
                    <div key={f.key} className="flex items-center justify-between py-1 border-b border-gray-50">
                      <span className="text-xs text-gray-400">{f.icon} {f.label}</span>
                      <span className="text-xs font-semibold text-right ml-2" style={{ color: '#10253f' }}>
                        {(client as Record<string, string | null>)[f.key]}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

// ── Google Review Timeline ───────────────────────────────────────────────────

const REVIEW_STEPS = [
  {
    key: 'Pendiente por enviar',
    label: 'Pendiente\npor enviar',
    icon: '📋',
    desc: 'Aún no se ha solicitado la reseña al cliente.',
  },
  {
    key: 'Enviada',
    label: 'Enviada',
    icon: '📤',
    desc: 'Se envió el enlace de Google Review al cliente.',
  },
  {
    key: 'Esperando por el cliente',
    label: 'Esperando\nal cliente',
    icon: '⏳',
    desc: 'El cliente recibió el enlace y está pendiente de dejar la reseña.',
  },
  {
    key: 'Realizada',
    label: 'Realizada',
    icon: '⭐',
    desc: 'El cliente dejó su reseña en Google. ¡Gracias!',
  },
]

function GoogleReviewTimeline({ current }: { current?: string | null }) {
  const currentIdx = REVIEW_STEPS.findIndex(s => s.key === current)
  const activeIdx = currentIdx === -1 ? 0 : currentIdx

  return (
    <div>
      {/* Steps */}
      <div className="flex items-start gap-0">
        {REVIEW_STEPS.map((step, i) => {
          const isDone    = i < activeIdx
          const isActive  = i === activeIdx
          const isPending = i > activeIdx
          const isLast    = i === REVIEW_STEPS.length - 1

          return (
            <div key={step.key} className="flex items-start flex-1 min-w-0">
              {/* Step + connector */}
              <div className="flex flex-col items-center flex-1 min-w-0">
                {/* Circle + line row */}
                <div className="flex items-center w-full">
                  {/* Left connector */}
                  {i > 0 && (
                    <div className="flex-1 h-0.5 mt-0" style={{ background: isDone || isActive ? '#305a72' : '#e5e7eb' }} />
                  )}
                  {/* Circle */}
                  <div
                    className="w-9 h-9 rounded-full flex items-center justify-center text-base shrink-0 border-2 transition-all"
                    style={{
                      background: isDone ? '#305a72' : isActive ? '#10253f' : '#f9fafb',
                      borderColor: isDone || isActive ? '#10253f' : '#d1d5db',
                      color: isDone || isActive ? '#fff' : '#9ca3af',
                    }}
                  >
                    {isDone ? '✓' : step.icon}
                  </div>
                  {/* Right connector */}
                  {!isLast && (
                    <div className="flex-1 h-0.5" style={{ background: isDone ? '#305a72' : '#e5e7eb' }} />
                  )}
                </div>
                {/* Label */}
                <div className="mt-2 text-center px-1 w-full">
                  <p
                    className="text-xs font-semibold leading-tight whitespace-pre-line"
                    style={{ color: isActive ? '#10253f' : isDone ? '#305a72' : '#9ca3af' }}
                  >
                    {step.label}
                  </p>
                </div>
              </div>
            </div>
          )
        })}
      </div>

      {/* Current step description */}
      {activeIdx >= 0 && (
        <div className="mt-4 p-3 rounded-lg text-sm" style={{ background: '#f0f5f7', color: '#193c5c' }}>
          <span className="font-semibold">{REVIEW_STEPS[activeIdx].icon} {REVIEW_STEPS[activeIdx].key}:</span>{' '}
          {REVIEW_STEPS[activeIdx].desc}
        </div>
      )}
    </div>
  )
}

// ── Main page ────────────────────────────────────────────────────────────────

export default function ClientDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const [client, setClient] = useState<Client | null>(null)
  const [editing, setEditing] = useState(false)
  const [saveSuccess, setSaveSuccess] = useState(false)
  const [showSensitive, setShowSensitive] = useState(false)
  const [showSSN, setShowSSN] = useState(false)
  const [showPortalPassword, setShowPortalPassword] = useState(false)
  const [showApptModal, setShowApptModal] = useState(false)
  const [clientId, setClientId] = useState<string | null>(null)
  const [activities, setActivities] = useState<{ id: string; type: string; content: string; createdAt: string }[]>([])
  const [actType, setActType] = useState('nota')
  const [actContent, setActContent] = useState('')
  const [actSaving, setActSaving] = useState(false)
  const [policyHistory, setPolicyHistory] = useState<PolicyHistoryEntry[]>([])
  const [savingHistory, setSavingHistory] = useState(false)
  const router = useRouter()

  const loadClient = useCallback((id: string) => {
    fetch(`/api/clients/${id}`).then(r => r.json()).then(setClient)
  }, [])

  const loadActivities = useCallback((id: string) => {
    fetch(`/api/clients/${id}/activities`).then(r => r.json()).then(setActivities)
  }, [])

  const loadPolicyHistory = useCallback((id: string) => {
    fetch(`/api/clients/${id}/policy-history`).then(r => r.json()).then(setPolicyHistory)
  }, [])

  useEffect(() => {
    params.then(p => { setClientId(p.id); loadClient(p.id); loadActivities(p.id); loadPolicyHistory(p.id) })
  }, [params, loadClient, loadActivities, loadPolicyHistory])

  const handleDelete = async () => {
    if (!confirm('¿Eliminar este cliente? Esta acción no se puede deshacer.')) return
    await fetch(`/api/clients/${clientId}`, { method: 'DELETE' })
    router.push('/clients')
  }

  const handleSave = async (data: Record<string, unknown>) => {
    const res = await fetch(`/api/clients/${clientId}`, {
      method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data),
    })
    if (!res.ok) {
      alert('Error al guardar. Intenta de nuevo.')
      return
    }
    const updated = await res.json()
    setClient(updated)
    setEditing(false)
    setSaveSuccess(true)
    setTimeout(() => setSaveSuccess(false), 4000)
  }

  const handleAddAppointment = async (data: { date: string; notes: string; status: string }) => {
    await fetch(`/api/clients/${clientId}/appointments`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data),
    })
    loadClient(clientId!)
    setShowApptModal(false)
  }

  const handleDeleteAppointment = async (apptId: string) => {
    if (!confirm('¿Eliminar esta cita?')) return
    await fetch(`/api/appointments/${apptId}`, { method: 'DELETE' })
    loadClient(clientId!)
  }

  const handleUpdateApptStatus = async (apptId: string, status: string) => {
    await fetch(`/api/appointments/${apptId}`, {
      method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ status }),
    })
    loadClient(clientId!)
  }

  const handleAddActivity = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!actContent.trim() || !clientId) return
    setActSaving(true)
    await fetch(`/api/clients/${clientId}/activities`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ type: actType, content: actContent }),
    })
    setActContent('')
    setActSaving(false)
    loadActivities(clientId)
  }

  const handleDeleteActivity = async (actId: string) => {
    await fetch(`/api/activities/${actId}`, { method: 'DELETE' })
    loadActivities(clientId!)
  }

  const handleDeletePolicyHistory = async (histId: string) => {
    if (!confirm('¿Eliminar este registro del historial?')) return
    await fetch(`/api/policy-history/${histId}`, { method: 'DELETE' })
    loadPolicyHistory(clientId!)
  }

  const handleSavePolicyHistory = async () => {
    if (!clientId) return
    setSavingHistory(true)
    await fetch(`/api/clients/${clientId}/policy-history`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({}) })
    setSavingHistory(false)
    loadPolicyHistory(clientId)
  }

  const ACTIVITY_ICONS: Record<string, string> = {
    nota: '📝', llamada: '📞', email: '📧', documento: '📄', reunion: '🤝', otro: '•'
  }

  if (!client) return <div className="flex items-center justify-center h-64"><div className="text-gray-400">Cargando...</div></div>

  if (editing) return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <button onClick={() => setEditing(false)} className="text-gray-500 hover:text-gray-700 text-sm">← Cancelar</button>
        <h1 className="text-xl font-bold" style={{ color: '#10253f' }}>Editar: {client.fullName}</h1>
      </div>
      <ClientForm
        initialData={client as unknown as Parameters<typeof ClientForm>[0]['initialData']}
        onSubmit={handleSave}
        submitLabel="Guardar Cambios"
      />
    </div>
  )

  const statusStyle = STATUS_COLORS[client.status || ''] || { bg: '#f3f4f6', text: '#374151' }
  const clientTags: string[] = (() => { try { return JSON.parse(client.tags || '[]') } catch { return [] } })()
  const spouse = client.dependents.find(d => d.type === 'spouse')
  const deps = client.dependents.filter(d => d.type !== 'spouse')
  const doctors = parseList(client.preferredDoctors)
  const medications = parseList(client.specificMedications)
  const wnPolicies = parseWn(client.wnPolicies)

  return (
    <div className="space-y-6">
      {/* Save success banner */}
      {saveSuccess && (
        <div className="flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-semibold animate-fade-in"
          style={{ background: '#d1fae5', border: '1.5px solid #6ee7b7', color: '#065f46' }}>
          <span className="text-lg">✅</span>
          <span>¡Cambios guardados correctamente!</span>
        </div>
      )}

      {showApptModal && (
        <AppointmentModal onClose={() => setShowApptModal(false)} onSave={handleAddAppointment} />
      )}

      {/* Header */}
      <div className="flex items-start justify-between flex-wrap gap-3">
        <div className="flex items-center gap-3 flex-wrap">
          <Link href="/clients" className="text-gray-400 hover:text-gray-600 text-sm">← Clientes</Link>
          <span className="text-gray-300">/</span>
          <h1 className="text-xl font-bold" style={{ color: '#10253f' }}>{client.fullName}</h1>
          <span className="px-2.5 py-1 rounded-full text-xs font-semibold" style={{ background: statusStyle.bg, color: statusStyle.text }}>
            {client.status}
          </span>
          {clientTags.map(tag => (
            <span key={tag} className="px-2.5 py-1 rounded-full text-xs font-semibold text-white" style={{ background: getTagColor(tag) }}>
              {tag}
            </span>
          ))}
        </div>
        <div className="flex gap-2 flex-wrap print:hidden">
          <button onClick={() => setShowApptModal(true)}
            className="px-4 py-2 rounded-lg text-sm font-medium text-white"
            style={{ background: '#305a72' }}>
            📅 Agendar Cita
          </button>
          <Link
            href={`/aptc?clientId=${clientId}`}
            className="px-4 py-2 rounded-lg text-sm font-medium text-white inline-flex items-center gap-1"
            style={{ background: '#0891b2' }}>
            🧮 APTC
          </Link>
          <Link
            href={`/tarjeta?clientId=${clientId}&clientName=${encodeURIComponent(client.fullName)}`}
            className="px-4 py-2 rounded-lg text-sm font-medium text-white inline-flex items-center gap-1"
            style={{ background: '#507b88' }}>
            🪪 Generar Tarjeta
          </Link>
          <button onClick={() => setEditing(true)}
            className="px-4 py-2 rounded-lg text-sm font-medium text-white"
            style={{ background: '#10253f' }}>
            Editar
          </button>
          <button onClick={() => window.print()}
            className="px-4 py-2 rounded-lg text-sm font-medium border border-gray-300 text-gray-700 hover:bg-gray-50">
            🖨️ Imprimir
          </button>
          <button onClick={handleDelete} className="text-red-600 border border-red-200 px-4 py-2 rounded-lg hover:bg-red-50 text-sm">
            Eliminar
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left */}
        <div className="space-y-4">
          <Section title="Identificación">
            <dl className="space-y-3">
              {client.ssn && (
                <div>
                  <div className="flex items-center justify-between">
                    <dt className="text-xs font-medium uppercase tracking-wide" style={{ color: '#507b88' }}>SSN</dt>
                    <button onClick={() => setShowSSN(v => !v)} className="text-xs font-medium" style={{ color: '#507b88' }}>
                      {showSSN ? '🙈 Ocultar' : '👁 Ver'}
                    </button>
                  </div>
                  <dd className="mt-0.5 text-sm font-mono text-gray-900">
                    {showSSN ? client.ssn : `***-**-${client.ssn.replace(/\D/g, '').slice(-4)}`}
                  </dd>
                </div>
              )}
              <InfoItem label="Fecha de Nacimiento" value={client.birthDate ? `${formatDate(client.birthDate)} · ${getAge(client.birthDate)} años` : null} />
              <InfoItem label="Email" value={client.email} />
              <div>
                <dt className="text-xs font-medium uppercase tracking-wide mb-1" style={{ color: '#507b88' }}>Teléfono</dt>
                <dd className="flex items-center gap-2 flex-wrap">
                  <span className="text-sm text-gray-900">{client.phone || '—'}</span>
                  {client.phone && (
                    <ContactButtons clientName={client.fullName} clientPhone={client.phone} size="sm" showLabel={false} />
                  )}
                </dd>
              </div>
              {client.preferredLanguage && (
                <div>
                  <dt className="text-xs font-medium uppercase tracking-wide" style={{ color: '#507b88' }}>Idioma Preferido</dt>
                  <dd className="mt-0.5 text-sm font-semibold" style={{ color: '#10253f' }}>
                    {client.preferredLanguage === 'Español' ? '🇪🇸 Español' : client.preferredLanguage === 'English' ? '🇺🇸 English' : client.preferredLanguage}
                  </dd>
                </div>
              )}
              <InfoItem label="Dirección" value={[client.address, client.aptSuite].filter(Boolean).join(', ') || null} />
              <InfoItem label="Ciudad" value={client.city} />
              <InfoItem label="Estado" value={client.state} />
              <InfoItem label="Código Postal" value={client.zipCode} />
              <InfoItem label="Condado" value={client.county} />
            </dl>
            {/* Fiscal & Employment */}
            {(client.maritalStatus || client.employmentType || client.filesTaxes != null || client.annualIncome != null) && (
              <div className="mt-4 pt-3 border-t border-gray-100">
                <p className="text-xs font-bold uppercase tracking-widest text-gray-400 mb-3">Información Fiscal y Laboral</p>
                <dl className="space-y-2">
                  {client.maritalStatus && <InfoItem label="Estado Civil" value={client.maritalStatus} />}
                  {client.employmentType && <InfoItem label="Tipo de Pago" value={client.employmentType} />}
                  {client.annualIncome != null && (
                    <InfoItem label="Ingresos Anuales Ind./Familiar" value={formatCurrency(client.annualIncome)} />
                  )}
                  {client.filesTaxes != null && (
                    <InfoItem label="Declara Impuestos" value={client.filesTaxes ? 'Sí' : 'No'} />
                  )}
                  {client.filesTaxes && client.filingStatus && (
                    <InfoItem label="Cómo Declara" value={client.filingStatus} />
                  )}
                </dl>
              </div>
            )}
          </Section>

          <Section title="Familia / Dependientes">
            <div className="space-y-3">
              {([
                { label: 'Cónyuge', dep: spouse },
                { label: 'Dependiente 1', dep: deps[0] },
                { label: 'Dependiente 2', dep: deps[1] },
                { label: 'Dependiente 3', dep: deps[2] },
              ] as { label: string; dep: typeof spouse | undefined }[]).map(({ label, dep }) => (
                <div key={label} className="p-3 rounded-lg bg-gray-50 border border-gray-100">
                  <div className="flex items-center justify-between mb-1">
                    <dt className="text-xs font-semibold uppercase tracking-wide" style={{ color: '#305a72' }}>{label}</dt>
                    {dep && dep.inPolicy !== null && dep.inPolicy !== undefined && (
                      <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${dep.inPolicy === false ? 'bg-red-100 text-red-600' : 'bg-green-100 text-green-700'}`}>
                        {dep.inPolicy === false
                          ? `No aplica${dep.coverageNote ? ` · ${dep.coverageNote}` : ''}`
                          : 'En póliza'}
                      </span>
                    )}
                  </div>
                  {dep ? (
                    <>
                      <dd className="text-sm font-medium text-gray-900">{dep.name}</dd>
                      {dep.birthDate && <dd className="text-xs text-gray-500 mt-0.5">{formatDate(dep.birthDate)} · {getAge(dep.birthDate)} años</dd>}
                      {dep.ssn && <dd className="text-xs font-mono text-gray-500 mt-0.5">SSN: ***-**-{dep.ssn.replace(/\D/g, '').slice(-4)}</dd>}
                    </>
                  ) : (
                    <dd className="text-sm text-gray-400 italic">No registrado</dd>
                  )}
                </div>
              ))}
            </div>
          </Section>

          <Section title="Médico / Medicamentos">
            <dl className="space-y-3">
              <div>
                <dt className="text-xs font-medium uppercase tracking-wide mb-1" style={{ color: '#507b88' }}>Médicos</dt>
                {doctors.length ? doctors.map((d, i) => <dd key={i} className="text-sm text-gray-900">{d}</dd>) : <dd className="text-sm text-gray-400">—</dd>}
              </div>
              <div>
                <dt className="text-xs font-medium uppercase tracking-wide mb-1" style={{ color: '#507b88' }}>Medicamentos</dt>
                {medications.length ? medications.map((m, i) => <dd key={i} className="text-sm text-gray-900">{m}</dd>) : <dd className="text-sm text-gray-400">—</dd>}
              </div>
            </dl>
          </Section>
        </div>

        {/* Middle */}
        <div className="space-y-4">
          <Section title="Póliza ACA">
            {/* First Payment Alert */}
            {(() => {
              if (client.firstPaymentPaid === true) {
                return (
                  <div className="mb-3 px-3 py-2 rounded-lg flex items-center gap-2 bg-green-50 border border-green-200">
                    <span className="text-green-600 font-bold">✓</span>
                    <span className="text-sm font-semibold text-green-700">Primera prima pagada</span>
                    {client.firstPaymentDate && <span className="text-xs text-green-600 ml-auto">{formatDate(client.firstPaymentDate)}</span>}
                  </div>
                )
              }
              if (client.contractDate) {
                const contractDt = new Date(client.contractDate)
                const daysElapsed = Math.floor((Date.now() - contractDt.getTime()) / (1000 * 60 * 60 * 24))
                const dueDate = new Date(contractDt)
                dueDate.setDate(dueDate.getDate() + 30)
                const dueDateStr = dueDate.toLocaleDateString('es-US', { month: 'short', day: 'numeric', year: 'numeric' })
                if (daysElapsed <= 30) {
                  return (
                    <div className="mb-3 px-3 py-2 rounded-lg flex items-center gap-2 bg-orange-50 border border-orange-300">
                      <span className="text-lg">⚠️</span>
                      <span className="text-sm font-semibold text-orange-800">Primera prima pendiente — vence el {dueDateStr}</span>
                    </div>
                  )
                } else {
                  return (
                    <div className="mb-3 px-3 py-2 rounded-lg flex items-center gap-2 bg-red-50 border border-red-300">
                      <span className="text-lg">🚨</span>
                      <span className="text-sm font-semibold text-red-800">Primer pago vencido — venció el {dueDateStr}</span>
                    </div>
                  )
                }
              }
              return null
            })()}
            <dl className="space-y-3">
              {/* 1 */ <></>}
              <InfoItem label="Fecha Contratación" value={formatDate(client.contractDate)} />
              {/* 2 */}
              <InfoItem label="Fecha de Activación" value={formatDate(client.activationDate)} />
              {/* 3 */}
              <InfoItem label="ID de Intercambio" value={client.planId} />
              {/* 4 */}
              <InfoItem label="Año Póliza" value={client.policyYear} />
              {/* 5 */}
              <InfoItem label="Aseguradora" value={client.insurer} />
              {/* 6 — Cobertura + applicant indicator */}
              <InfoItem label="Cobertura" value={client.coverageType} />
              {client.applicantInPolicy === false && (
                <div className="pl-0.5">
                  <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold bg-red-100 text-red-700">
                    Solicitante NO incluido{client.applicantExclusionReason ? ` · ${client.applicantExclusionReason}` : ''}
                  </span>
                </div>
              )}
              {client.applicantInPolicy === true && (
                <div className="pl-0.5">
                  <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold bg-green-100 text-green-700">
                    Solicitante incluido en póliza
                  </span>
                </div>
              )}
              {/* 7 */}
              <InfoItem label="Afiliados" value={client.affiliatesCount} />
              {/* 8 */}
              <InfoItem label="Categoría" value={client.planCategory} />
              {/* 9 */}
              <InfoItem label="Plan" value={client.planName} />
              {/* 10 — Precio ACA resaltado */}
              <div>
                <dt className="text-xs font-medium uppercase tracking-wide" style={{ color: '#507b88' }}>Precio ACA</dt>
                <dd className="mt-0.5 text-base font-bold" style={{ color: '#059669' }}>
                  {formatCurrency(client.acaPrice)}<span className="text-xs font-normal text-gray-400">/mes</span>
                </dd>
              </div>
              {/* 11 */}
              <InfoItem label="Próx. Renovación" value={formatDate(client.renewalDate)} />
              {/* 12 */}
              <InfoItem label="Vencimiento Póliza (12/31)" value={formatDate(client.policyExpirationDate)} />
              {/* 13 — Primera Prima */}
              <div>
                <dt className="text-xs font-medium uppercase tracking-wide" style={{ color: '#507b88' }}>¿Pagó Primera Prima?</dt>
                <dd className="mt-0.5">
                  <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${
                    client.firstPaymentPaid === true ? 'bg-green-100 text-green-700'
                    : client.firstPaymentPaid === false ? 'bg-red-100 text-red-700'
                    : 'bg-yellow-100 text-yellow-700'
                  }`}>
                    {client.firstPaymentPaid === true ? 'Sí' : client.firstPaymentPaid === false ? 'No' : 'Pendiente'}
                  </span>
                </dd>
              </div>
              {/* 14 */}
              {client.firstPaymentDate && (
                <InfoItem label="Fecha Primer Pago" value={formatDate(client.firstPaymentDate)} />
              )}
            </dl>
          </Section>

          {/* Plan Benefits */}
          <PlanBenefitsSection client={client} clientId={clientId} onUpdated={() => clientId && loadClient(clientId)} />

          <Section title="Washington National">
            {wnPolicies.length === 0 ? (
              <p className="text-sm text-gray-400">—</p>
            ) : (
              <div className="space-y-2">
                {(client.wnContractDate || client.cancellationDate) && (
                  <div className="pb-2 mb-1 border-b border-gray-100 text-xs text-gray-500 space-y-0.5">
                    {client.wnContractDate && <div>📅 Fecha de contratación WN: <strong>{formatDate(client.wnContractDate)}</strong></div>}
                    {client.cancellationDate && <div>🚫 Fecha de cancelación: <strong>{formatDate(client.cancellationDate)}</strong></div>}
                  </div>
                )}
                {wnPolicies.map((p, i) => (
                  <div key={i} className="flex justify-between items-center py-2 border-b border-gray-100 last:border-0">
                    <span className="text-sm text-gray-900">{p.type || '—'}</span>
                    <span className="text-sm font-semibold" style={{ color: '#305a72' }}>{formatCurrency(Number(p.monthly))}/mes</span>
                  </div>
                ))}
                <div className="flex justify-between items-center pt-2">
                  <span className="text-sm font-bold" style={{ color: '#10253f' }}>Total Mensual (ACA + WN)</span>
                  <span className="text-base font-bold" style={{ color: '#10253f' }}>{formatCurrency(client.totalMonthly)}</span>
                </div>
              </div>
            )}
          </Section>

          {/* Dental Insurance */}
          {(client.dentalInsurer || client.dentalDeductible || client.dentalMaxBenefit) && (
            <Section title="🦷 Póliza Dental">
              <dl className="space-y-3">
                <InfoItem label="Aseguradora Dental" value={client.dentalInsurer} />
                <InfoItem label="Deducible" value={client.dentalDeductible} />
                <InfoItem label="Beneficio Máximo Anual" value={client.dentalMaxBenefit} />
              </dl>
            </Section>
          )}
          {!(client.dentalInsurer || client.dentalDeductible || client.dentalMaxBenefit) && (
            <div className="bg-white rounded-xl border border-dashed border-gray-200 p-4 text-center">
              <p className="text-sm text-gray-400">🦷 Sin póliza dental registrada</p>
              <p className="text-xs text-gray-300 mt-0.5">Agrega la información en Editar → Póliza Dental</p>
            </div>
          )}

          {/* Policy History */}
          <div className="bg-white rounded-xl border border-gray-200 p-5">
            <div className="flex items-center justify-between mb-1">
              <h2 className="font-semibold text-base" style={{ color: '#10253f' }}>Historial de Pólizas</h2>
              <button
                onClick={handleSavePolicyHistory}
                disabled={savingHistory}
                className="text-xs font-semibold px-3 py-1.5 rounded-lg text-white disabled:opacity-50"
                style={{ background: '#305a72' }}
              >
                {savingHistory ? 'Guardando...' : '📸 Guardar Snapshot Actual'}
              </button>
            </div>
            <p className="text-xs text-gray-400 mb-4">Guarda el estado actual de la póliza para llevar un historial año a año.</p>
            {policyHistory.length === 0 ? (
              <p className="text-sm text-gray-400">Sin historial registrado</p>
            ) : (
              <div className="relative">
                <div className="absolute left-3.5 top-0 bottom-0 w-0.5" style={{ background: '#e5e7eb' }} />
                <div className="space-y-4">
                  {policyHistory.map((entry, i) => (
                    <div key={entry.id} className="flex gap-4 relative">
                      <div className="w-7 h-7 rounded-full border-2 flex items-center justify-center text-xs font-bold shrink-0 z-10 bg-white" style={{ borderColor: i === 0 ? '#305a72' : '#d1d5db', color: i === 0 ? '#305a72' : '#9ca3af' }}>
                        {entry.year.toString().slice(-2)}
                      </div>
                      <div className="flex-1 pb-4 border-b border-gray-100 last:border-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-semibold text-sm" style={{ color: '#10253f' }}>{entry.year}</span>
                          {entry.insurer && <span className="text-xs bg-blue-50 text-blue-700 px-2 py-0.5 rounded-full">{entry.insurer}</span>}
                          {entry.planCategory && <span className={`text-xs px-2 py-0.5 rounded-full font-semibold ${entry.planCategory === 'Gold' ? 'bg-yellow-100 text-yellow-700' : entry.planCategory === 'Silver' ? 'bg-gray-100 text-gray-600' : entry.planCategory === 'Bronze' ? 'bg-orange-100 text-orange-700' : entry.planCategory === 'Platinum' ? 'bg-blue-100 text-blue-700' : 'bg-purple-50 text-purple-700'}`}>{entry.planCategory}</span>}
                          <button onClick={() => handleDeletePolicyHistory(entry.id)} className="ml-auto text-gray-300 hover:text-red-400 text-xs">✕</button>
                        </div>
                        {entry.planName && <p className="text-xs text-gray-600 mt-0.5">{entry.planName}</p>}
                        <div className="flex gap-3 mt-1">
                          {entry.totalMonthly != null && <span className="text-xs text-gray-500">Total: <strong>{formatCurrency(entry.totalMonthly)}/mes</strong></span>}
                          {entry.acaPrice != null && <span className="text-xs text-gray-500">ACA: <strong>{formatCurrency(entry.acaPrice)}</strong></span>}
                        </div>
                        {entry.notes && <p className="text-xs text-gray-500 mt-1 italic">{entry.notes}</p>}
                        <p className="text-xs text-gray-400 mt-1">Registrado: {new Date(entry.recordedAt).toLocaleDateString('es-US')}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Right */}
        <div className="space-y-4">
          {/* Citas */}
          <div className="bg-white rounded-xl border border-gray-200 p-5">
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-semibold text-base" style={{ color: '#10253f' }}>Citas</h2>
              <button onClick={() => setShowApptModal(true)}
                className="text-xs font-semibold px-3 py-1.5 rounded-lg text-white"
                style={{ background: '#305a72' }}>
                + Nueva
              </button>
            </div>
            {client.appointments.length === 0 ? (
              <p className="text-sm text-gray-400">Sin citas agendadas</p>
            ) : (
              <div className="space-y-2">
                {client.appointments.map(a => {
                  const aStyle = APPT_STATUS_COLORS[a.status] || { bg: '#f3f4f6', text: '#374151' }
                  return (
                    <div key={a.id} className="p-3 rounded-lg border border-gray-100 bg-gray-50">
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex-1 min-w-0">
                          <div className="text-sm font-medium text-gray-900">{formatDateTime(a.date)}</div>
                          {a.notes && <div className="text-xs text-gray-500 mt-0.5 truncate">{a.notes}</div>}
                        </div>
                        <div className="flex items-center gap-1 shrink-0">
                          <span className="text-xs px-2 py-0.5 rounded-full font-medium" style={{ background: aStyle.bg, color: aStyle.text }}>
                            {a.status}
                          </span>
                          <button onClick={() => handleDeleteAppointment(a.id)} className="text-gray-300 hover:text-red-400 text-xs px-1">✕</button>
                        </div>
                      </div>
                      <div className="flex gap-2 mt-2">
                        {['Completada', 'Cancelada', 'Reagendada'].filter(s => s !== a.status).map(s => (
                          <button key={s} onClick={() => handleUpdateApptStatus(a.id, s)}
                            className="text-xs text-gray-500 hover:text-gray-800 underline">
                            {s}
                          </button>
                        ))}
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </div>

          <Section title="Acceso al Portal de la Aseguradora">
            <dl className="space-y-3">
              <div>
                <div className="flex items-center justify-between gap-2">
                  <dt className="text-xs font-medium uppercase tracking-wide" style={{ color: '#507b88' }}>Usuario Portal</dt>
                  <CopyButton value={client.portalUser} />
                </div>
                <dd className="mt-0.5 text-sm text-gray-900">{client.portalUser ?? '—'}</dd>
              </div>
              <div>
                <div className="flex items-center justify-between gap-2">
                  <dt className="text-xs font-medium uppercase tracking-wide" style={{ color: '#507b88' }}>Contraseña Portal</dt>
                  <div className="flex items-center gap-3">
                    {client.portalPassword && (
                      <button onClick={() => setShowPortalPassword(v => !v)}
                        className="text-xs font-medium" style={{ color: '#507b88' }}>
                        {showPortalPassword ? '🙈 Ocultar' : '👁 Ver'}
                      </button>
                    )}
                    <CopyButton value={client.portalPassword} />
                  </div>
                </div>
                <dd className="mt-0.5 text-sm font-mono text-gray-900">
                  {client.portalPassword
                    ? (showPortalPassword ? client.portalPassword : '••••••••••')
                    : '—'}
                </dd>
              </div>
            </dl>
          </Section>

          {/* HealthSherpa — separado del acceso al portal de la aseguradora */}
          <Section title="HealthSherpa">
            <dl className="space-y-3">
              <SherpaLink clientId={client.id} initialUrl={client.sherpaUrl} onSaved={url => setClient(c => c ? { ...c, sherpaUrl: url } : c)} />
            </dl>
            {client.notes && (
              <div className="mt-3 pt-3 border-t border-gray-100">
                <dt className="text-xs font-medium uppercase tracking-wide mb-1" style={{ color: '#507b88' }}>Notas</dt>
                <dd className="text-sm text-gray-900 whitespace-pre-wrap">{client.notes}</dd>
              </div>
            )}
          </Section>

          {/* Google Review Timeline */}
          <div className="bg-white rounded-xl border border-gray-200 p-5">
            <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
              <h2 className="font-semibold text-base" style={{ color: '#10253f' }}>Google Review</h2>
              {client.googleReview !== 'Realizada' && client.phone && (
                <a
                  href={`https://wa.me/${client.phone.replace(/\D/g,'').length === 10 ? '1' : ''}${client.phone.replace(/\D/g,'')}?text=${encodeURIComponent(`Hola ${client.fullName.split(' ')[0]}, fue un placer atenderte. Te agradecería mucho si pudieras dejarnos una reseña en Google, solo toma 1 minuto 🙏: https://g.page/r/CbFgt44hL28OEAE/review`)}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-lg text-white"
                  style={{ background: '#25d366' }}
                >
                  💬 Enviar link por WhatsApp
                </a>
              )}
              {client.googleReview === 'Realizada' && (
                <span className="text-xs font-semibold text-green-600 bg-green-50 px-2 py-1 rounded-full">
                  ⭐ ¡Reseña completada!
                </span>
              )}
            </div>
            <GoogleReviewTimeline current={client.googleReview} />
          </div>

          {/* Documents */}
          {clientId && (
            <DocumentsSection
              clientId={clientId}
              onClientUpdated={() => clientId && loadClient(clientId)}
            />
          )}

          {/* Activity History */}
          <div className="bg-white rounded-xl border border-gray-200 p-5">
            <h2 className="font-semibold mb-4 text-base" style={{ color: '#10253f' }}>Actividad</h2>
            <form onSubmit={handleAddActivity} className="space-y-2 mb-4">
              <div className="flex gap-2">
                <select
                  value={actType}
                  onChange={e => setActType(e.target.value)}
                  className="border border-gray-300 rounded-lg px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#507b88] w-full"
                >
                  <option value="nota">📝 Nota</option>
                  <option value="llamada">📞 Llamada</option>
                  <option value="email">📧 Email</option>
                  <option value="documento">📄 Documento</option>
                  <option value="reunion">🤝 Reunión</option>
                  <option value="otro">• Otro</option>
                </select>
              </div>
              <div className="flex gap-2">
                <input
                  className="flex-1 min-w-0 border border-gray-300 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#507b88]"
                  placeholder="Descripción..."
                  value={actContent}
                  onChange={e => setActContent(e.target.value)}
                  required
                />
                <button type="submit" disabled={actSaving}
                  className="shrink-0 px-4 py-1.5 rounded-lg text-white text-sm font-medium"
                  style={{ background: '#305a72' }}>
                  {actSaving ? '...' : 'Agregar'}
                </button>
              </div>
            </form>
            {activities.length === 0 ? (
              <p className="text-sm text-gray-400 text-center py-4">Sin actividad registrada</p>
            ) : (
              <div className="space-y-2 max-h-64 overflow-y-auto">
                {activities.map(a => (
                  <div key={a.id} className="flex items-start gap-2 py-2 border-b last:border-0">
                    <span className="text-base mt-0.5">{ACTIVITY_ICONS[a.type] || '•'}</span>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm text-gray-900">{a.content}</p>
                      <p className="text-xs text-gray-400 mt-0.5">{new Date(a.createdAt).toLocaleString('es-US')}</p>
                    </div>
                    <button onClick={() => handleDeleteActivity(a.id)} className="text-gray-300 hover:text-red-400 text-xs ml-1">✕</button>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Banco */}
          <div className="bg-white rounded-xl border border-yellow-300 p-5">
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-semibold text-base" style={{ color: '#10253f' }}>Banco (Protegido)</h2>
              <button onClick={() => setShowSensitive(!showSensitive)}
                className="text-xs border px-2 py-1 rounded"
                style={{ color: '#92400e', background: '#fef9c3', borderColor: '#fde68a' }}>
                {showSensitive ? 'Ocultar' : 'Mostrar'}
              </button>
            </div>
            {showSensitive ? (
              <dl className="space-y-3">
                <InfoItem label="Titular" value={client.bankHolder} />
                <InfoItem label="Banco" value={client.bankName} />
                <InfoItem label="Número de Ruta" value={client.bankRouting} />
                <InfoItem label="Número de Cuenta" value={client.bankAccount} />
                <InfoItem label="Tipo de Cuenta" value={client.bankAccountType} />
                <InfoItem label="Contraseña Portal" value={client.portalPassword} />
              </dl>
            ) : (
              <p className="text-sm text-gray-400 italic">Haz clic en &quot;Mostrar&quot; para ver datos bancarios</p>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
