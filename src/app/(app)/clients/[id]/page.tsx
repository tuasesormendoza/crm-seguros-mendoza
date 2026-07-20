'use client'

import { useEffect, useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { formatDate, formatDateTime, formatCurrency, getAge } from '@/lib/utils'
import ClientForm from '@/components/ClientForm'
import DocumentsSection from '@/components/DocumentsSection'
import ContactButtons from '@/components/ContactButtons'
import LoadError from '@/components/LoadError'
import AppointmentModal from '@/components/client-profile/AppointmentModal'
import SherpaLink from '@/components/client-profile/SherpaLink'
import PlanBenefitsSection from '@/components/client-profile/PlanBenefitsSection'
import GoogleReviewTimeline from '@/components/client-profile/GoogleReviewTimeline'
import { InfoItem, CopyButton, Section } from '@/components/client-profile/ui'
import { PREDEFINED_TAGS, getTagColor, STATUS_COLORS, APPT_STATUS_COLORS, INSURER_HISTORY_OPTIONS, parseList, parseWn, type Client, type Appointment, type PolicyHistoryEntry, type InsurerHistoryEntry, type SurveyResponse, type WnPolicy } from '@/components/client-profile/types'

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
  const [insurerHistory, setInsurerHistory] = useState<InsurerHistoryEntry[]>([])
  const [savingInsurerHistory, setSavingInsurerHistory] = useState(false)
  const [insurerHistoryError, setInsurerHistoryError] = useState('')
  const [newInsurerChange, setNewInsurerChange] = useState({ insurer: '', startPeriod: '', endPeriod: '' })
  const [surveyResponses, setSurveyResponses] = useState<SurveyResponse[]>([])
  const [loadError, setLoadError] = useState(false)
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

  const loadInsurerHistory = useCallback((id: string) => {
    fetch(`/api/clients/${id}/insurer-history`).then(r => r.json()).then(setInsurerHistory)
  }, [])

  useEffect(() => {
    params.then(p => {
      setClientId(p.id)
      // Single consolidated request — one serverless invocation instead of 5.
      fetch(`/api/clients/${p.id}/full`)
        .then(r => { if (!r.ok) throw new Error(`HTTP ${r.status}`); return r.json() })
        .then(data => {
          if (data?.client) setClient(data.client)
          if (data?.activities) setActivities(data.activities)
          if (data?.policyHistory) setPolicyHistory(data.policyHistory)
          if (data?.insurerHistory) setInsurerHistory(data.insurerHistory)
          if (data?.surveyResponses) setSurveyResponses(data.surveyResponses)
        })
        .catch(() => setLoadError(true))
    })
  }, [params])

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

  const handleAddAppointment = async (data: { date: string; doctorName: string; location: string; notes: string; status: string }) => {
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

  const handleUpdateGoogleReview = async (stage: string) => {
    // Actualización optimista: la etapa cambia al instante al tocarla.
    setClient(c => c ? { ...c, googleReview: stage } : c)
    await fetch(`/api/clients/${clientId}`, {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ googleReview: stage }),
    }).catch(() => loadClient(clientId!))
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

  const handleAddInsurerChange = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!clientId) return
    setInsurerHistoryError('')
    if (!newInsurerChange.insurer || !newInsurerChange.startPeriod) {
      setInsurerHistoryError('Selecciona la aseguradora anterior y el mes en que empezó.')
      return
    }
    setSavingInsurerHistory(true)
    const res = await fetch(`/api/clients/${clientId}/insurer-history`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        insurer: newInsurerChange.insurer,
        startPeriod: newInsurerChange.startPeriod,
        endPeriod: newInsurerChange.endPeriod || null,
      }),
    })
    setSavingInsurerHistory(false)
    if (!res.ok) {
      const body = await res.json().catch(() => ({}))
      setInsurerHistoryError(body.error || 'No se pudo guardar el cambio de aseguradora.')
      return
    }
    setNewInsurerChange({ insurer: '', startPeriod: '', endPeriod: '' })
    loadInsurerHistory(clientId)
    loadClient(clientId) // client.insurer puede haberse actualizado
  }

  const handleDeleteInsurerHistory = async (id: string) => {
    if (!confirm('¿Eliminar este registro del historial de aseguradoras?')) return
    await fetch(`/api/insurer-history/${id}`, { method: 'DELETE' })
    loadInsurerHistory(clientId!)
  }

  const ACTIVITY_ICONS: Record<string, string> = {
    nota: '📝', llamada: '📞', texto: '💬', whatsapp: '🟢', email: '📧', documento: '📄', reunion: '🤝', otro: '•'
  }

  if (!client && loadError) return <LoadError message="No se pudo cargar el perfil del cliente" />

  if (!client) return <div className="flex items-center justify-center h-64"><div className="text-gray-400">Cargando...</div></div>

  const hasDental = !!(client.dentalInsurer || client.dentalDeductible || client.dentalMaxBenefit || client.dentalMonthly)

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


      {/* Cancellation banner */}
      {(client.status === 'Cancelado' || client.status === 'Con otro agente') && (() => {
        const c = client!
        const start = c.activationDate || c.contractDate
        const end = c.cancellationDate
        const months = start && end
          ? Math.max(0, Math.round((new Date(end).getTime() - new Date(start).getTime()) / (1000 * 60 * 60 * 24 * 30.44)))
          : null
        const wnPoliciesData = parseWn(c.wnPolicies)
        const wnClawbackRisk = wnPoliciesData.length > 0 && !c.wnSecondPaymentReceived

        async function addToProspects() {
          await fetch('/api/prospects', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              fullName: c.fullName,
              phone: c.phone || undefined,
              email: c.email || undefined,
              stage: 'Cerrado - Perdido',
              lossReason: 'COMPETENCIA',
              notes: `Cliente cancelado${end ? ` el ${formatDate(end)}` : ''}. Fue con otro agente.`,
            }),
          })
          alert(`${c.fullName} fue agregado al pipeline de prospectos como "Cerrado – Perdido".`)
        }

        return (
          <div className="rounded-xl p-4 space-y-2" style={{ background: '#fef2f2', border: '1.5px solid #fecaca' }}>
            <div className="flex items-start justify-between gap-3 flex-wrap">
              <div>
                <p className="text-sm font-bold" style={{ color: '#991b1b' }}>
                  Cliente cancelado — fue con otro agente
                </p>
                <p className="text-xs mt-0.5" style={{ color: '#b91c1c' }}>
                  {end ? `Fecha de cancelación: ${formatDate(end)}` : 'Fecha de cancelación no registrada'}
                  {months !== null ? ` · ${months} mes${months === 1 ? '' : 'es'} activo` : ''}
                </p>
              </div>
              <button
                onClick={addToProspects}
                className="px-3 py-1.5 rounded-lg text-xs font-semibold text-white shrink-0"
                style={{ background: '#305a72' }}
              >
                + Agregar a prospectos
              </button>
            </div>
            {wnClawbackRisk && (
              <p className="text-xs font-semibold" style={{ color: '#92400e', background: '#fef3c7', border: '1px solid #fde68a', borderRadius: '6px', padding: '6px 10px' }}>
                ⚠️ Riesgo de clawback WN: tiene póliza Washington National y el segundo pago aún no está confirmado.
              </p>
            )}
          </div>
        )
      })()}

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
              {client.aptcAmount != null && (
                <div>
                  <dt className="text-xs font-medium uppercase tracking-wide" style={{ color: '#507b88' }}>Crédito Fiscal Otorgado</dt>
                  <dd className="mt-0.5 text-base font-bold" style={{ color: '#0369a1' }}>
                    {formatCurrency(client.aptcAmount)}<span className="text-xs font-normal text-gray-400">/mes</span>
                  </dd>
                </div>
              )}
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
                {(client.wnContractDate || client.cancellationDate || client.wnPaymentDay) && (
                  <div className="pb-2 mb-1 border-b border-gray-100 text-xs text-gray-500 space-y-0.5">
                    {client.wnContractDate && <div>📅 Fecha de contratación WN: <strong>{formatDate(client.wnContractDate)}</strong></div>}
                    {client.wnPaymentDay && <div>💵 Día de cobro de la mensualidad: <strong>{client.wnPaymentDay}</strong></div>}
                    {client.cancellationDate && <div>🚫 Fecha de cancelación: <strong>{formatDate(client.cancellationDate)}</strong></div>}
                  </div>
                )}
                {wnPolicies.map((p, i) => (
                  <div key={i} className="flex justify-between items-center gap-2 py-2 border-b border-gray-100 last:border-0">
                    <div className="min-w-0">
                      <div className="text-sm text-gray-900">{p.type || '—'}</div>
                      {p.policyNumber && <div className="text-xs text-gray-400">N.º póliza: {p.policyNumber}</div>}
                    </div>
                    <span className="text-sm font-semibold shrink-0" style={{ color: '#305a72' }}>{formatCurrency(Number(p.monthly))}/mes</span>
                  </div>
                ))}
                <div className="flex justify-between items-center pt-2">
                  <span className="text-sm font-bold" style={{ color: '#10253f' }}>Total Mensual (ACA + WN + Dental)</span>
                  <span className="text-base font-bold" style={{ color: '#10253f' }}>{formatCurrency(client.totalMonthly)}</span>
                </div>
              </div>
            )}
          </Section>

          {/* Dental Insurance */}
          {hasDental && (
            <Section title="🦷 Póliza Dental">
              <dl className="space-y-3">
                <InfoItem label="Aseguradora Dental" value={client.dentalInsurer} />
                <InfoItem label="Deducible" value={client.dentalDeductible} />
                <InfoItem label="Beneficio Máximo Anual" value={client.dentalMaxBenefit} />
                {!!client.dentalMonthly && <InfoItem label="Precio del Plan" value={`${formatCurrency(client.dentalMonthly)}/mes`} />}
              </dl>
            </Section>
          )}
          {!hasDental && (
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

          {/* Insurer History */}
          <div className="bg-white rounded-xl border border-gray-200 p-5">
            <h2 className="font-semibold text-base mb-1" style={{ color: '#10253f' }}>🔄 Historial de Aseguradoras</h2>
            <p className="text-xs text-gray-400 mb-4">
              Si este cliente cambió de aseguradora durante su póliza (ej. tenía Oscar y se cambió a Ambetter), regístralo
              aquí para que la conciliación de comisiones atribuya cada mes a la aseguradora correcta. Solo agrega
              la(s) aseguradora(s) ANTERIOR(ES) con su mes de inicio y fin — el resto del tiempo se asume la aseguradora
              actual ({client.insurer || '—'}).
            </p>

            {insurerHistory.length === 0 ? (
              <p className="text-sm text-gray-400 mb-4">Sin cambios de aseguradora registrados.</p>
            ) : (
              <div className="space-y-2 mb-4">
                {insurerHistory.map(entry => {
                  const fmtMonthYear = (iso: string) => {
                    const d = /^\d{4}-\d{2}-\d{2}T00:00:00/.test(iso)
                      ? (() => { const u = new Date(iso); return new Date(u.getUTCFullYear(), u.getUTCMonth(), u.getUTCDate()) })()
                      : new Date(iso)
                    return d.toLocaleDateString('es-ES', { month: 'short', year: 'numeric' })
                  }
                  return (
                    <div key={entry.id} className="flex items-center justify-between gap-2 px-3 py-2 rounded-lg" style={{ background: '#f8fafc' }}>
                      <div className="text-sm">
                        <span className="font-semibold" style={{ color: '#10253f' }}>{entry.insurer}</span>
                        <span className="text-xs text-gray-500 ml-2">
                          {fmtMonthYear(entry.startDate)} – {entry.endDate ? fmtMonthYear(entry.endDate) : 'Actual'}
                        </span>
                      </div>
                      <button onClick={() => handleDeleteInsurerHistory(entry.id)} className="text-gray-300 hover:text-red-400 text-xs">✕</button>
                    </div>
                  )
                })}
              </div>
            )}

            <form onSubmit={handleAddInsurerChange} className="grid grid-cols-1 sm:grid-cols-3 gap-3 p-3 rounded-xl" style={{ background: '#f8fafc', border: '1px solid #e2e8f0' }}>
              <div className="sm:col-span-3">
                <label className="block text-xs font-medium text-gray-600 mb-1">Aseguradora anterior</label>
                <select
                  value={newInsurerChange.insurer}
                  onChange={e => setNewInsurerChange(v => ({ ...v, insurer: e.target.value }))}
                  className="w-full border border-gray-300 rounded-lg px-2 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#507b88] bg-white"
                >
                  <option value="">Seleccionar...</option>
                  {INSURER_HISTORY_OPTIONS.map(i => <option key={i} value={i}>{i}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Desde</label>
                <input
                  type="month"
                  value={newInsurerChange.startPeriod}
                  onChange={e => setNewInsurerChange(v => ({ ...v, startPeriod: e.target.value }))}
                  className="w-full border border-gray-300 rounded-lg px-2 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#507b88] bg-white"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Hasta</label>
                <input
                  type="month"
                  value={newInsurerChange.endPeriod}
                  onChange={e => setNewInsurerChange(v => ({ ...v, endPeriod: e.target.value }))}
                  className="w-full border border-gray-300 rounded-lg px-2 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#507b88] bg-white"
                />
              </div>
              <div className="flex items-end">
                <button
                  type="submit"
                  disabled={savingInsurerHistory}
                  className="w-full px-3 py-2 rounded-lg text-sm font-semibold text-white disabled:opacity-50"
                  style={{ background: '#305a72' }}
                >
                  {savingInsurerHistory ? '...' : '+ Agregar'}
                </button>
              </div>
              {insurerHistoryError && <p className="sm:col-span-3 text-xs text-red-600">{insurerHistoryError}</p>}
            </form>
          </div>
        </div>

        {/* Right */}
        <div className="space-y-4">
          {/* Citas Médicas */}
          <div className="bg-white rounded-xl border border-gray-200 p-5">
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-semibold text-base" style={{ color: '#10253f' }}>🩺 Citas Médicas</h2>
              <button onClick={() => setShowApptModal(true)}
                className="text-xs font-semibold px-3 py-1.5 rounded-lg text-white"
                style={{ background: '#305a72' }}>
                + Nueva
              </button>
            </div>
            {client.appointments.length === 0 ? (
              <p className="text-sm text-gray-400">Sin citas médicas agendadas</p>
            ) : (
              <div className="space-y-2">
                {client.appointments.map(a => {
                  const aStyle = APPT_STATUS_COLORS[a.status] || { bg: '#f3f4f6', text: '#374151' }
                  // Mensaje de confirmación de cita médica por WhatsApp al cliente.
                  // El texto se codifica con encodeURIComponent para que los emojis
                  // y acentos se vean bien también en WhatsApp Web (no como "?").
                  const digits = (client.phone || '').replace(/\D/g, '')
                  const waPhone = digits.length === 10 ? '1' + digits : digits
                  const waLines = [`Hola ${client.fullName}, te confirmo tu cita médica:`, `📅 ${formatDateTime(a.date)}`]
                  if (a.doctorName) waLines.push(`🩺 ${a.doctorName}`)
                  if (a.location) waLines.push(`📍 ${a.location}`)
                  if (a.notes) waLines.push(`📝 ${a.notes}`)
                  const waUrl = `https://wa.me/${waPhone}?text=${encodeURIComponent(waLines.join('\n'))}`
                  return (
                    <div key={a.id} className="p-3 rounded-lg border border-gray-100 bg-gray-50">
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex-1 min-w-0">
                          <div className="text-sm font-medium text-gray-900">{formatDateTime(a.date)}</div>
                          {a.doctorName && <div className="text-xs text-gray-700 mt-0.5">🩺 {a.doctorName}</div>}
                          {a.location && <div className="text-xs text-gray-500 mt-0.5">📍 {a.location}</div>}
                          {a.notes && <div className="text-xs text-gray-500 mt-0.5">📝 {a.notes}</div>}
                        </div>
                        <div className="flex items-center gap-1 shrink-0">
                          <span className="text-xs px-2 py-0.5 rounded-full font-medium" style={{ background: aStyle.bg, color: aStyle.text }}>
                            {a.status}
                          </span>
                          <button onClick={() => handleDeleteAppointment(a.id)} className="text-gray-300 hover:text-red-400 text-xs px-1">✕</button>
                        </div>
                      </div>
                      <div className="flex items-center gap-2 mt-2 flex-wrap">
                        {waPhone.length >= 11 && (
                          <a href={waUrl} target="_blank" rel="noopener noreferrer"
                            className="text-xs font-semibold px-2.5 py-1 rounded-lg text-white inline-flex items-center gap-1"
                            style={{ background: '#25d366' }}>
                            💬 Confirmar por WhatsApp
                          </a>
                        )}
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
            <GoogleReviewTimeline current={client.googleReview} onSelect={handleUpdateGoogleReview} />
            <p className="text-xs text-gray-400 mt-3 text-center">Toca una etapa para actualizar el avance</p>
          </div>

          {/* Survey responses */}
          {surveyResponses.length > 0 && (() => {
            const s = surveyResponses[0]
            const cats: { label: string; val: number | null }[] = [
              { label: 'Atención y trato',      val: s.ratingAtention },
              { label: 'Claridad al explicar',  val: s.ratingClarity },
              { label: 'Rapidez de respuesta',  val: s.ratingSpeed },
              { label: 'Dedicación',            val: s.ratingDedication },
            ]
            const filled = cats.filter(c => c.val !== null)
            const avg = filled.length ? filled.reduce((acc, c) => acc + (c.val ?? 0), 0) / filled.length : null
            const recLabel: Record<string, string> = { si: '✅ Sí, me recomendaría', no: '❌ No por ahora', quizas: '🤔 Quizás en el futuro' }
            return (
              <div className="bg-white rounded-xl border border-gray-200 p-5">
                <div className="flex items-center justify-between mb-4">
                  <h2 className="font-semibold text-base" style={{ color: '#10253f' }}>
                    ⭐ Encuesta de satisfacción
                  </h2>
                  <div className="flex items-center gap-2">
                    {avg !== null && (
                      <span className="text-sm font-bold px-2.5 py-1 rounded-full" style={{ background: avg >= 4 ? '#d1fae5' : avg >= 3 ? '#fef3c7' : '#fee2e2', color: avg >= 4 ? '#065f46' : avg >= 3 ? '#92400e' : '#991b1b' }}>
                        {avg.toFixed(1)} / 5
                      </span>
                    )}
                    <span className="text-xs text-gray-400">
                      {new Date(s.submittedAt).toLocaleDateString('es-US', { year: 'numeric', month: 'short', day: 'numeric' })}
                    </span>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3 mb-4">
                  {cats.map(c => (
                    <div key={c.label} className="rounded-lg p-3" style={{ background: '#f8fafc', border: '1px solid #e2e8f0' }}>
                      <div className="text-xs text-gray-500 mb-1">{c.label}</div>
                      <div className="flex items-center gap-1.5">
                        <div className="flex gap-0.5">
                          {[1,2,3,4,5].map(n => (
                            <span key={n} style={{ fontSize: 16, color: c.val !== null && n <= c.val ? '#f59e0b' : '#e2e8f0' }}>★</span>
                          ))}
                        </div>
                        <span className="text-xs font-semibold text-gray-600">{c.val !== null ? `${c.val}/5` : '—'}</span>
                      </div>
                    </div>
                  ))}
                </div>

                {s.recommends && (
                  <div className="mb-3 text-sm font-medium" style={{ color: '#475569' }}>
                    {recLabel[s.recommends] ?? s.recommends}
                  </div>
                )}

                {s.comments && (
                  <div className="rounded-lg p-3 text-sm italic" style={{ background: '#f0f7fb', border: '1px solid #b8d4e8', color: '#334155' }}>
                    "{s.comments}"
                  </div>
                )}

                {surveyResponses.length > 1 && (
                  <p className="text-xs text-gray-400 mt-3">{surveyResponses.length} respuestas recibidas — mostrando la más reciente</p>
                )}
              </div>
            )
          })()}

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
                  <option value="texto">💬 Mensaje de Texto</option>
                  <option value="whatsapp">🟢 WhatsApp</option>
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
