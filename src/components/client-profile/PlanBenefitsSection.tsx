'use client'

import { useState } from 'react'

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

export default function PlanBenefitsSection({ client, clientId, onUpdated }: {
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
