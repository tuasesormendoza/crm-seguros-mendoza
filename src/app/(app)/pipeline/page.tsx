'use client'

import { useEffect, useState, useCallback } from 'react'
import Link from 'next/link'

interface Prospect {
  id: string
  fullName: string
  phone: string | null
  email: string | null
  state: string | null
  source: string | null
  stage: string
  notes: string | null
  referredByClientId: string | null
  referredByName: string | null
  assignedDate: string
  createdAt: string
  // Modo Combate quick-quote fields
  zipCode: string | null
  income: string | null
  householdSize: string | null
  // CMS / Sherpa compliance
  sherpaStatus: string | null
  consentAt: string | null
  // Decision / docs limbo
  callbackAt: string | null
  // Closed - lost
  lossReason: string | null
  tags: string | null
  followUpAt: string | null
  followUpNote: string | null
}

interface ClientOption {
  id: string
  fullName: string
  phone: string | null
}

// ── One-Call Close pipeline structure ────────────────────────────────────────
const STAGES = [
  'Nuevo Lead (Por Contactar)',
  'Llamada en Vivo (Cotizando)',
  'En Espera de Decisión / Docs',
  'Cerrado - Ganado',
  'Cerrado - Perdido',
]

const STAGE_COLORS: Record<string, string> = {
  'Nuevo Lead (Por Contactar)':   '#305a72',
  'Llamada en Vivo (Cotizando)':  '#193c5c',
  'En Espera de Decisión / Docs': '#7fa4a4',
  'Cerrado - Ganado':             '#166534',
  'Cerrado - Perdido':            '#991b1b',
}

const STAGE_BG: Record<string, string> = {
  'Nuevo Lead (Por Contactar)':   '#e8f0f4',
  'Llamada en Vivo (Cotizando)':  '#e8ecf5',
  'En Espera de Decisión / Docs': '#f0f6f6',
  'Cerrado - Ganado':             '#dcfce7',
  'Cerrado - Perdido':            '#fee2e2',
}

const STAGE_HINTS: Record<string, string> = {
  'Nuevo Lead (Por Contactar)':   'Bandeja de prospectos fríos (redes sociales / formularios)',
  'Llamada en Vivo (Cotizando)':  'Cliente en la línea — Modo Combate activo',
  'En Espera de Decisión / Docs': 'Limbo controlado: consultar con cónyuge o documentos pendientes',
  'Cerrado - Ganado':             'Convertidos a clientes activos',
  'Cerrado - Perdido':            'Fuera del flujo activo',
}

const LOSS_REASONS = [
  { key: 'GHOSTING',             label: 'Ghosting',                  icon: '👻', desc: 'No responde mensajes ni llamadas' },
  { key: 'FALTA_DOCUMENTACION',  label: 'Falta de Documentación',    icon: '📄', desc: 'Estatus legal o pruebas de ingresos pendientes' },
  { key: 'PRECIO_INGRESOS',      label: 'Precio / Ingresos',         icon: '💲', desc: 'Ingresos altos o no quiere pagar prima' },
  { key: 'COMPETENCIA',          label: 'Competencia',               icon: '🏳️', desc: 'Contrató con otro agente o renovó solo' },
] as const

// Reasons that trigger automatic "Nutrición" tagging + Nov 1 follow-up
const NUTRITION_REASONS = ['GHOSTING', 'PRECIO_INGRESOS']

const INPUT = 'w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#507b88]'

// Next November 1st — Open Enrollment reopening
function nextNov1(): Date {
  const now = new Date()
  const isPastNov1 = now.getMonth() > 10 || (now.getMonth() === 10 && now.getDate() > 1)
  const year = isPastNov1 ? now.getFullYear() + 1 : now.getFullYear()
  return new Date(year, 10, 1, 9, 0, 0)
}

function parseTags(raw: string | null): string[] {
  if (!raw) return []
  try { const p = JSON.parse(raw); return Array.isArray(p) ? p : [] } catch { return [] }
}

function fmtDateTime(iso: string | null): string {
  if (!iso) return ''
  const d = new Date(iso)
  return d.toLocaleString('es-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })
}

function isOverdue(iso: string | null): boolean {
  if (!iso) return false
  return new Date(iso).getTime() < Date.now()
}

async function patchProspect(id: string, data: Record<string, unknown>) {
  const res = await fetch(`/api/prospects/${id}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  })
  return res.ok ? res.json() : null
}

export default function PipelinePage() {
  const [prospects, setProspects] = useState<Prospect[]>([])
  const [clients, setClients] = useState<ClientOption[]>([])
  const [sherpaConsentUrl, setSherpaConsentUrl] = useState('')
  const [showForm, setShowForm] = useState(false)
  const [editId, setEditId] = useState<string | null>(null)
  const [reengageModal, setReengageModal] = useState<Prospect | null>(null)
  const [bulkReengage, setBulkReengage] = useState(false)
  const DEFAULT_MSG = 'Hola {nombre}, espero que todo esté bien 😊 Solo quería recordarte que aquí sigo disponible para ayudarte con tu seguro de salud. Cuando lo necesites, con gusto te asesoro. ¡Saludos!'
  const [reengageMsg, setReengageMsg] = useState(DEFAULT_MSG)
  const [clientSearch, setClientSearch] = useState('')
  const [showClientDropdown, setShowClientDropdown] = useState(false)
  const [form, setForm] = useState({
    fullName: '', phone: '', email: '', state: '', source: '', notes: '',
    referredByClientId: '', referredByName: '',
  })

  // ── One-Call Close flow state ───────────────────────────────────────────────
  const [combatModal, setCombatModal] = useState<Prospect | null>(null)
  const [callbackModal, setCallbackModal] = useState<Prospect | null>(null)
  const [lossModal, setLossModal] = useState<Prospect | null>(null)
  const [convertModal, setConvertModal] = useState<Prospect | null>(null)
  const [draggingId, setDraggingId] = useState<string | null>(null)
  const [dragOverStage, setDragOverStage] = useState<string | null>(null)

  const load = useCallback(async () => {
    const res = await fetch('/api/prospects')
    setProspects(await res.json())
  }, [])

  useEffect(() => {
    load()
    fetch('/api/clients').then(r => r.json()).then((data: ClientOption[]) => setClients(data))
    fetch('/api/settings').then(r => r.json()).then((s: Record<string, string>) => setSherpaConsentUrl(s.healthSherpaConsentUrl || ''))
  }, [load])

  const setF = (k: string, v: string) => setForm(f => ({ ...f, [k]: v }))

  function resetForm() {
    setForm({ fullName: '', phone: '', email: '', state: '', source: '', notes: '', referredByClientId: '', referredByName: '' })
    setClientSearch('')
    setShowClientDropdown(false)
  }

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault()
    await fetch('/api/prospects', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(form),
    })
    resetForm()
    setShowForm(false)
    load()
  }

  async function deleteProspect(id: string) {
    if (!confirm('¿Eliminar este prospecto?')) return
    await fetch(`/api/prospects/${id}`, { method: 'DELETE' })
    load()
  }

  function buildWALink(phone: string, name: string, msg: string): string {
    const digits = phone.replace(/\D/g, '')
    const intl = digits.length === 10 ? `1${digits}` : digits
    const text = msg.replace(/\{nombre\}/g, name.split(' ')[0])
    return `https://wa.me/${intl}?text=${encodeURIComponent(text)}`
  }

  async function reactivate(id: string) {
    await patchProspect(id, { stage: 'Nuevo Lead (Por Contactar)', lossReason: null, callbackAt: null })
    setReengageModal(null)
    load()
  }

  // ── Central stage-change router ──────────────────────────────────────────────
  // Used by both drag & drop and the manual "Mover" modal — guarantees the
  // mandatory pop-ups fire no matter how the agent moves the card.
  async function requestStageChange(p: Prospect, targetStage: string) {
    setEditId(null)
    if (targetStage === p.stage) return
    if (targetStage === 'En Espera de Decisión / Docs') {
      setCallbackModal(p)
    } else if (targetStage === 'Cerrado - Perdido') {
      setLossModal(p)
    } else if (targetStage === 'Cerrado - Ganado') {
      setConvertModal(p)
    } else {
      await patchProspect(p.id, { stage: targetStage })
      load()
    }
  }

  // Filtered clients for referral search
  const filteredClients = clients.filter(c =>
    clientSearch.length >= 2 &&
    c.fullName.toLowerCase().includes(clientSearch.toLowerCase())
  ).slice(0, 8)

  const editProspect = editId ? prospects.find(p => p.id === editId) || null : null

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold" style={{ color: '#10253f' }}>Pipeline de Prospectos</h1>
          <p className="text-sm text-gray-500 mt-0.5">{prospects.length} prospectos · Modelo de Venta en Una Sola Llamada</p>
        </div>
        <button onClick={() => { resetForm(); setShowForm(true) }}
          className="px-4 py-2 rounded-lg text-white font-semibold text-sm"
          style={{ background: '#305a72' }}>
          + Nuevo Prospecto
        </button>
      </div>

      {/* ── New Prospect Modal ── */}
      {showForm && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl p-6 w-full max-w-md shadow-2xl max-h-[90vh] overflow-y-auto">
            <h2 className="font-bold text-lg mb-4" style={{ color: '#10253f' }}>Nuevo Prospecto</h2>
            <form onSubmit={handleCreate} className="space-y-3">
              <input className={INPUT} placeholder="Nombre completo *" required
                value={form.fullName} onChange={e => setF('fullName', e.target.value)} />
              <input className={INPUT} placeholder="Teléfono"
                value={form.phone} onChange={e => setF('phone', e.target.value)} />
              <input className={INPUT} placeholder="Email"
                value={form.email} onChange={e => setF('email', e.target.value)} />
              <input className={INPUT} placeholder="Estado (Florida, Georgia...)"
                value={form.state} onChange={e => setF('state', e.target.value)} />

              <select className={INPUT} value={form.source} onChange={e => {
                setF('source', e.target.value)
                if (e.target.value !== 'Referido') {
                  setF('referredByClientId', '')
                  setF('referredByName', '')
                  setClientSearch('')
                }
              }}>
                <option value="">Fuente...</option>
                <option>Referido</option>
                <option>Redes Sociales</option>
                <option>Llamada en frío</option>
                <option>Web / Google</option>
                <option>Evento</option>
                <option>Otro</option>
              </select>

              {form.source === 'Referido' && (
                <div className="rounded-xl border-2 border-blue-100 bg-blue-50 p-3 space-y-2">
                  <p className="text-xs font-semibold text-blue-700 uppercase tracking-wide">¿Quién lo refirió?</p>
                  {form.referredByClientId ? (
                    <div className="flex items-center justify-between bg-white rounded-lg px-3 py-2 border border-blue-200">
                      <div>
                        <div className="text-sm font-semibold" style={{ color: '#10253f' }}>👤 {form.referredByName}</div>
                        <div className="text-xs text-blue-600">Cliente referidor seleccionado</div>
                      </div>
                      <button type="button"
                        onClick={() => { setF('referredByClientId', ''); setF('referredByName', ''); setClientSearch('') }}
                        className="text-red-400 hover:text-red-600 text-sm px-2">✕</button>
                    </div>
                  ) : (
                    <div className="relative">
                      <input
                        className={INPUT + ' bg-white'}
                        placeholder="Buscar cliente que refirió..."
                        value={clientSearch}
                        onChange={e => { setClientSearch(e.target.value); setShowClientDropdown(true) }}
                        onFocus={() => setShowClientDropdown(true)}
                      />
                      {showClientDropdown && filteredClients.length > 0 && (
                        <div className="absolute top-full left-0 right-0 mt-1 bg-white rounded-lg shadow-xl border z-10 overflow-hidden">
                          {filteredClients.map(c => (
                            <button key={c.id} type="button"
                              onMouseDown={() => {
                                setF('referredByClientId', c.id)
                                setF('referredByName', c.fullName)
                                setClientSearch('')
                                setShowClientDropdown(false)
                              }}
                              className="w-full px-3 py-2 text-left hover:bg-gray-50 border-b last:border-0">
                              <div className="text-sm font-medium" style={{ color: '#10253f' }}>{c.fullName}</div>
                              {c.phone && <div className="text-xs text-gray-400">{c.phone}</div>}
                            </button>
                          ))}
                        </div>
                      )}
                      {clientSearch.length >= 2 && filteredClients.length === 0 && (
                        <div className="absolute top-full left-0 right-0 mt-1 bg-white rounded-lg shadow border p-3 text-xs text-gray-400">
                          No se encontraron clientes
                        </div>
                      )}
                      {clientSearch.length < 2 && (
                        <p className="text-xs text-gray-400 mt-1">Escribe 2+ letras para buscar</p>
                      )}
                    </div>
                  )}
                </div>
              )}

              <textarea className={INPUT} placeholder="Notas" rows={2}
                value={form.notes} onChange={e => setF('notes', e.target.value)} />

              <div className="flex gap-2 pt-2">
                <button type="submit"
                  className="flex-1 py-2 rounded-lg text-white font-semibold text-sm"
                  style={{ background: '#305a72' }}>
                  Guardar
                </button>
                <button type="button" onClick={() => { resetForm(); setShowForm(false) }}
                  className="flex-1 py-2 rounded-lg font-semibold text-sm border border-gray-300">
                  Cancelar
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── Move Stage Modal (manual alternative to drag & drop) ── */}
      {editProspect && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
          <div className="bg-white rounded-2xl p-6 w-80 shadow-2xl">
            <h2 className="font-bold text-lg mb-4" style={{ color: '#10253f' }}>Mover a Etapa</h2>
            <div className="space-y-2">
              {STAGES.map(s => (
                <button key={s} onClick={() => requestStageChange(editProspect, s)}
                  className="w-full px-3 py-2.5 rounded-lg text-white text-sm font-medium text-left"
                  style={{ background: STAGE_COLORS[s] }}>
                  {s}
                </button>
              ))}
            </div>
            <button onClick={() => setEditId(null)} className="mt-3 w-full py-2 rounded-lg text-sm border border-gray-300">
              Cancelar
            </button>
          </div>
        </div>
      )}

      {/* ── 🔥 Modo Combate ── */}
      {combatModal && (
        <CombatModal
          prospect={combatModal}
          sherpaConsentUrl={sherpaConsentUrl}
          onClose={() => setCombatModal(null)}
          onUpdated={(updated) => {
            setProspects(ps => ps.map(p => p.id === updated.id ? updated : p))
            setCombatModal(updated)
          }}
          onConvert={(p) => { setCombatModal(null); setConvertModal(p) }}
          onMoveToWaiting={(p) => { setCombatModal(null); requestStageChange(p, 'En Espera de Decisión / Docs') }}
        />
      )}

      {/* ── Callback scheduling modal (En Espera de Decisión / Docs) ── */}
      {callbackModal && (
        <CallbackModal
          prospect={callbackModal}
          onClose={() => setCallbackModal(null)}
          onScheduled={() => { setCallbackModal(null); load() }}
        />
      )}

      {/* ── Loss reason modal (Cerrado - Perdido) ── */}
      {lossModal && (
        <LossReasonModal
          prospect={lossModal}
          onClose={() => setLossModal(null)}
          onSaved={() => { setLossModal(null); load() }}
        />
      )}

      {/* ── Convert to client modal ── */}
      {convertModal && (
        <ConvertModal
          prospect={convertModal}
          onClose={() => setConvertModal(null)}
          onConverted={() => { setConvertModal(null); load() }}
        />
      )}

      {/* ── Re-engagement modal (single prospect) ── */}
      {reengageModal && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl p-6 w-full max-w-md shadow-2xl">
            <h2 className="font-bold text-lg mb-1" style={{ color: '#10253f' }}>💬 Mensaje de Reactivación</h2>
            <p className="text-sm text-gray-500 mb-4">
              Enviar a <span className="font-semibold text-gray-800">{reengageModal.fullName}</span>
              {reengageModal.phone && <span className="ml-1 text-gray-400">· {reengageModal.phone}</span>}
            </p>
            <label className="block text-xs font-semibold uppercase tracking-wide text-gray-500 mb-1.5">Mensaje</label>
            <textarea
              value={reengageMsg}
              onChange={e => setReengageMsg(e.target.value)}
              rows={4}
              className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm outline-none resize-none focus:border-blue-400"
              style={{ background: '#f8fafc' }}
            />
            <p className="text-xs text-gray-400 mt-1 mb-4">
              Usa <code className="bg-gray-100 px-1 rounded">{'{nombre}'}</code> para insertar el primer nombre automáticamente.
            </p>
            <div className="flex gap-2">
              {reengageModal.phone ? (
                <a href={buildWALink(reengageModal.phone, reengageModal.fullName, reengageMsg)}
                  target="_blank" rel="noopener noreferrer"
                  onClick={() => setReengageModal(null)}
                  className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-semibold text-white"
                  style={{ background: '#25d366' }}>
                  💬 Enviar por WhatsApp
                </a>
              ) : (
                <div className="flex-1 text-center text-xs text-red-500 py-2">Sin número de teléfono</div>
              )}
              <button onClick={() => reactivate(reengageModal.id)}
                className="px-4 py-2.5 rounded-xl text-sm font-semibold text-white"
                style={{ background: '#305a72' }}>
                🔄 Reactivar
              </button>
              <button onClick={() => setReengageModal(null)}
                className="px-4 py-2.5 rounded-xl text-sm border border-gray-200 text-gray-600">
                Cerrar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Bulk re-engagement modal (all lost) ── */}
      {bulkReengage && (() => {
        const lost = prospects.filter(p => p.stage === 'Cerrado - Perdido' && p.phone)
        return (
          <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-2xl p-6 w-full max-w-lg shadow-2xl">
              <h2 className="font-bold text-lg mb-1" style={{ color: '#10253f' }}>📣 Recordatorio Masivo</h2>
              <p className="text-sm text-gray-500 mb-4">
                {lost.length} prospectos perdidos con número. Haz clic en cada uno para enviar.
              </p>
              <label className="block text-xs font-semibold uppercase tracking-wide text-gray-500 mb-1.5">Mensaje para todos</label>
              <textarea
                value={reengageMsg}
                onChange={e => setReengageMsg(e.target.value)}
                rows={3}
                className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm outline-none resize-none focus:border-blue-400 mb-4"
                style={{ background: '#f8fafc' }}
              />
              <div className="space-y-2 max-h-60 overflow-y-auto mb-4">
                {lost.map(p => (
                  <div key={p.id} className="flex items-center justify-between px-3 py-2 rounded-lg" style={{ background: '#f8fafc' }}>
                    <div>
                      <div className="text-sm font-medium" style={{ color: '#10253f' }}>{p.fullName}</div>
                      <div className="text-xs text-gray-400">{p.phone}</div>
                    </div>
                    <a href={buildWALink(p.phone!, p.fullName, reengageMsg)}
                      target="_blank" rel="noopener noreferrer"
                      className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-semibold text-white"
                      style={{ background: '#25d366' }}>
                      💬 Enviar
                    </a>
                  </div>
                ))}
                {lost.length === 0 && <p className="text-sm text-gray-400 text-center py-4">Sin prospectos perdidos con teléfono</p>}
              </div>
              <button onClick={() => setBulkReengage(false)}
                className="w-full py-2.5 rounded-xl text-sm border border-gray-200 text-gray-600">
                Cerrar
              </button>
            </div>
          </div>
        )
      })()}

      {/* ── Kanban ── */}
      {/* Desktop: horizontal scroll with fixed-width columns. Mobile: stacked vertically. */}
      <div className="flex flex-col gap-4 md:flex-row md:overflow-x-auto pb-4">
        {STAGES.map(stage => {
          const stageProspects = prospects.filter(p => p.stage === stage)
          const visibleProspects = stage === 'Cerrado - Ganado'
            ? [] // converted leads are archived for metrics, not cluttering the board
            : stageProspects
          const isDragOver = dragOverStage === stage

          return (
            <div key={stage} className="w-full md:flex-shrink-0 md:w-72"
              onDragOver={(e) => { e.preventDefault(); setDragOverStage(stage) }}
              onDragLeave={() => setDragOverStage(s => s === stage ? null : s)}
              onDrop={(e) => {
                e.preventDefault()
                setDragOverStage(null)
                const id = draggingId || e.dataTransfer.getData('text/prospect-id')
                const p = prospects.find(x => x.id === id)
                setDraggingId(null)
                if (p) requestStageChange(p, stage)
              }}>
              {/* Column header */}
              <div className="px-3 py-2 rounded-t-lg text-white text-sm font-semibold flex items-center justify-between"
                style={{ background: STAGE_COLORS[stage] }}
                title={STAGE_HINTS[stage]}>
                <span>{stage}</span>
                <div className="flex items-center gap-1.5">
                  <span className="bg-white/20 rounded-full px-2 py-0.5 text-xs">{stageProspects.length}</span>
                  {stage === 'Cerrado - Perdido' && stageProspects.length > 0 && (
                    <button
                      onClick={() => setBulkReengage(true)}
                      className="bg-white/20 hover:bg-white/30 rounded-full px-2 py-0.5 text-xs font-medium transition-colors"
                      title="Enviar recordatorio a todos">
                      📣 Todos
                    </button>
                  )}
                </div>
              </div>

              {/* Cards */}
              <div className={`rounded-b-lg min-h-32 p-2 space-y-2 border border-t-0 transition-colors ${isDragOver ? 'ring-2 ring-inset' : ''}`}
                style={{ background: STAGE_BG[stage] || '#f9fafb', borderColor: isDragOver ? STAGE_COLORS[stage] : undefined }}>

                {stage === 'Cerrado - Ganado' && stageProspects.length > 0 && (
                  <div className="text-center py-4 px-2 rounded-lg bg-white/60 border border-green-200">
                    <p className="text-sm font-semibold" style={{ color: '#166534' }}>✅ {stageProspects.length} convertidos a cliente</p>
                    <p className="text-xs text-gray-500 mt-1">Archivados para métricas — revisa la lista en <Link href="/clients" className="underline font-medium" style={{ color: '#166534' }}>Clientes</Link></p>
                  </div>
                )}

                {visibleProspects.map(p => {
                  const overdue = stage === 'En Espera de Decisión / Docs' && isOverdue(p.callbackAt)
                  const isCombatStage = stage === 'Llamada en Vivo (Cotizando)'
                  const sentToSherpa = p.sherpaStatus === 'enviado'
                  const tags = parseTags(p.tags)

                  return (
                    <div key={p.id}
                      draggable
                      onDragStart={(e) => { setDraggingId(p.id); e.dataTransfer.setData('text/prospect-id', p.id); e.dataTransfer.effectAllowed = 'move' }}
                      onDragEnd={() => setDraggingId(null)}
                      onClick={() => { if (isCombatStage) setCombatModal(p) }}
                      className={`bg-white rounded-xl p-3 shadow-sm border transition-shadow ${isCombatStage ? 'cursor-pointer hover:shadow-md' : ''} ${draggingId === p.id ? 'opacity-40' : ''}`}
                      style={{ borderColor: overdue ? '#dc2626' : sentToSherpa && isCombatStage ? '#f59e0b' : '#f3f4f6', borderWidth: overdue ? 2 : 1, cursor: 'grab' }}>

                      {overdue && (
                        <div className="mb-2 px-2 py-1 rounded-lg text-xs font-bold text-white text-center animate-pulse" style={{ background: '#dc2626' }}>
                          🚨 Requiere Seguimiento Urgente
                        </div>
                      )}
                      {sentToSherpa && isCombatStage && (
                        <div className="mb-2 px-2 py-1 rounded-lg text-xs font-semibold text-center" style={{ background: '#fef3c7', color: '#92400e' }}>
                          ⏳ Enviado en Sherpa — esperando consentimiento
                        </div>
                      )}

                      <div className="font-semibold text-sm" style={{ color: '#10253f' }}>{p.fullName}</div>
                      {p.phone && <div className="text-xs text-gray-500 mt-0.5">{p.phone}</div>}

                      <div className="flex flex-wrap gap-1 mt-1.5">
                        {p.source && (
                          <span className="text-xs px-2 py-0.5 rounded-full font-medium"
                            style={{ background: p.source === 'Referido' ? '#dbeafe' : '#e8f0f4', color: p.source === 'Referido' ? '#1e40af' : '#305a72' }}>
                            {p.source === 'Referido' ? '🤝' : '📌'} {p.source}
                          </span>
                        )}
                        {p.state && (
                          <span className="text-xs px-2 py-0.5 rounded-full bg-gray-100 text-gray-600">{p.state}</span>
                        )}
                        {tags.map(t => (
                          <span key={t} className="text-xs px-2 py-0.5 rounded-full font-medium" style={{ background: '#dcfce7', color: '#166534' }}>
                            🌱 {t}
                          </span>
                        ))}
                      </div>

                      {p.referredByClientId && p.referredByName && (
                        <div className="mt-2 flex items-center gap-1.5 bg-blue-50 rounded-lg px-2 py-1.5">
                          <span className="text-xs text-blue-600">👤 Referido por:</span>
                          <Link href={`/clients/${p.referredByClientId}`}
                            className="text-xs font-semibold hover:underline"
                            style={{ color: '#1e40af' }}>
                            {p.referredByName}
                          </Link>
                        </div>
                      )}

                      {/* Callback / re-call schedule */}
                      {stage === 'En Espera de Decisión / Docs' && p.callbackAt && (
                        <div className={`mt-2 flex items-center gap-1.5 rounded-lg px-2 py-1.5 ${overdue ? '' : 'bg-amber-50'}`}
                          style={overdue ? { background: '#fee2e2' } : undefined}>
                          <span className={`text-xs font-semibold ${overdue ? '' : 'text-amber-700'}`} style={overdue ? { color: '#dc2626' } : undefined}>
                            📞 Re-llamar: {fmtDateTime(p.callbackAt)}
                          </span>
                        </div>
                      )}

                      {/* Loss reason badge */}
                      {stage === 'Cerrado - Perdido' && p.lossReason && (
                        <div className="mt-2 flex items-center gap-1.5 bg-red-50 rounded-lg px-2 py-1.5">
                          <span className="text-xs font-semibold" style={{ color: '#991b1b' }}>
                            {LOSS_REASONS.find(r => r.key === p.lossReason)?.icon} {LOSS_REASONS.find(r => r.key === p.lossReason)?.label || p.lossReason}
                          </span>
                        </div>
                      )}
                      {stage === 'Cerrado - Perdido' && p.followUpAt && (
                        <div className="mt-1.5 text-xs text-gray-400">
                          🗓️ Seguimiento programado: {new Date(p.followUpAt).toLocaleDateString('es-US', { month: 'long', day: 'numeric', year: 'numeric' })}
                        </div>
                      )}

                      {p.notes && <div className="text-xs text-gray-400 mt-1.5 line-clamp-2 italic">{p.notes}</div>}
                      <div className="text-xs text-gray-300 mt-1">{new Date(p.createdAt).toLocaleDateString('en-US')}</div>

                      <div className="flex gap-1 mt-2 flex-wrap" onClick={e => e.stopPropagation()}>
                        {stage === 'Cerrado - Perdido' ? (
                          <>
                            <button onClick={() => setReengageModal(p)}
                              className="flex-1 text-xs px-2 py-1.5 rounded-lg text-white font-semibold flex items-center justify-center gap-1"
                              style={{ background: '#25d366' }}>
                              💬 Recordar
                            </button>
                            <button onClick={() => reactivate(p.id)}
                              className="text-xs px-2 py-1.5 rounded-lg font-semibold"
                              style={{ background: '#dbeafe', color: '#1e40af' }}
                              title="Mover a Nuevo Lead">
                              🔄
                            </button>
                            <button onClick={() => deleteProspect(p.id)}
                              className="text-xs px-2 py-1 rounded-lg text-white font-medium"
                              style={{ background: '#991b1b' }}>
                              ✕
                            </button>
                          </>
                        ) : isCombatStage ? (
                          <>
                            <button onClick={() => setCombatModal(p)}
                              className="flex-1 text-xs px-2 py-1.5 rounded-lg text-white font-bold flex items-center justify-center gap-1"
                              style={{ background: '#193c5c' }}>
                              🔥 Modo Combate
                            </button>
                            <button onClick={() => setEditId(p.id)}
                              className="text-xs px-2 py-1.5 rounded-lg text-white font-medium"
                              style={{ background: '#507b88' }}>
                              Mover
                            </button>
                            <button onClick={() => deleteProspect(p.id)}
                              className="text-xs px-2 py-1 rounded-lg text-white font-medium"
                              style={{ background: '#991b1b' }}>
                              ✕
                            </button>
                          </>
                        ) : (
                          <>
                            <button onClick={() => setEditId(p.id)}
                              className="text-xs px-2 py-1 rounded-lg text-white font-medium"
                              style={{ background: '#507b88' }}>
                              Mover
                            </button>
                            <button onClick={() => deleteProspect(p.id)}
                              className="text-xs px-2 py-1 rounded-lg text-white font-medium ml-auto"
                              style={{ background: '#991b1b' }}>
                              ✕
                            </button>
                          </>
                        )}
                      </div>
                    </div>
                  )
                })}

                {visibleProspects.length === 0 && stage !== 'Cerrado - Ganado' && (
                  <div className="text-center py-6 text-xs text-gray-400 italic">
                    {isDragOver ? '⬇ Suelta aquí' : 'Sin prospectos'}
                  </div>
                )}
                {stage === 'Cerrado - Ganado' && stageProspects.length === 0 && (
                  <div className="text-center py-6 text-xs text-gray-400 italic">Sin conversiones todavía</div>
                )}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

// ══════════════════════════════════════════════════════════════════════════════
// 🔥 MODO COMBATE — expanded view optimized for absolute speed during a live call
// ══════════════════════════════════════════════════════════════════════════════
function CombatModal({ prospect, sherpaConsentUrl, onClose, onUpdated, onConvert, onMoveToWaiting }: {
  prospect: Prospect
  sherpaConsentUrl?: string
  onClose: () => void
  onUpdated: (p: Prospect) => void
  onConvert: (p: Prospect) => void
  onMoveToWaiting: (p: Prospect) => void
}) {
  const [savingSherpa, setSavingSherpa] = useState(false)
  const [savingConsent, setSavingConsent] = useState(false)
  const [copied, setCopied] = useState<string | null>(null)

  async function copy(text: string, label: string) {
    try {
      await navigator.clipboard.writeText(text)
      setCopied(label)
      setTimeout(() => setCopied(c => c === label ? null : c), 1400)
    } catch { /* clipboard unavailable — silently ignore */ }
  }

  async function markSherpaSent() {
    setSavingSherpa(true)
    const updated = await patchProspect(prospect.id, { sherpaStatus: 'enviado' })
    setSavingSherpa(false)
    if (updated) onUpdated(updated)
  }

  async function markConsent() {
    setSavingConsent(true)
    const updated = await patchProspect(prospect.id, { consentAt: new Date().toISOString() })
    setSavingConsent(false)
    if (updated) onUpdated(updated)
  }

  const hasConsent = !!prospect.consentAt
  const sentToSherpa = prospect.sherpaStatus === 'enviado'

  const CopyField = ({ label, value, fieldKey }: { label: string; value: string | null; fieldKey: string }) => (
    <div>
      <label className="block text-xs font-semibold uppercase tracking-wide text-gray-400 mb-1">{label}</label>
      <div className="flex items-center gap-2">
        <div className="flex-1 px-3 py-2 rounded-lg text-sm font-medium border" style={{ background: '#f8fafc', color: '#10253f', borderColor: '#e2e8f0' }}>
          {value || '—'}
        </div>
        <button type="button" disabled={!value} onClick={() => copy(value || '', fieldKey)}
          className="px-3 py-2 rounded-lg text-xs font-bold text-white disabled:opacity-30 transition-colors"
          style={{ background: copied === fieldKey ? '#166534' : '#305a72' }}>
          {copied === fieldKey ? '✓ Copiado' : '📋 Copiar'}
        </button>
      </div>
    </div>
  )

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl w-full max-w-2xl shadow-2xl max-h-[92vh] overflow-y-auto">
        {/* Header */}
        <div className="px-6 py-4 rounded-t-2xl flex items-center justify-between" style={{ background: '#193c5c' }}>
          <div>
            <h2 className="font-bold text-lg text-white flex items-center gap-2">🔥 Modo Combate</h2>
            <p className="text-xs" style={{ color: '#7fa4a4' }}>{prospect.fullName} · Llamada en Vivo</p>
          </div>
          <button onClick={onClose} className="text-white/70 hover:text-white text-xl leading-none px-2">✕</button>
        </div>

        <div className="p-6 space-y-6">
          {/* ── Block 1: Quick copy ── */}
          <section>
            <h3 className="text-xs font-bold uppercase tracking-wider mb-3" style={{ color: '#507b88' }}>
              📋 Copiado Rápido (para HealthSherpa)
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <CopyField label="Nombre Completo" value={prospect.fullName} fieldKey="name" />
              <CopyField label="Número de Teléfono" value={prospect.phone} fieldKey="phone" />
            </div>
          </section>

          <hr className="border-gray-100" />

          {/* ── Block 2: CMS / Sherpa compliance ── */}
          <section>
            <h3 className="text-xs font-bold uppercase tracking-wider mb-3" style={{ color: '#507b88' }}>
              🛡 Cumplimiento CMS / Sherpa
            </h3>
            <div className="space-y-2">
              {sherpaConsentUrl ? (
                <a href={sherpaConsentUrl} target="_blank" rel="noopener noreferrer"
                  className="w-full px-4 py-3 rounded-xl text-sm font-bold flex items-center justify-between transition-colors"
                  style={{ background: '#e8f0f4', color: '#10253f' }}>
                  <span>🔗 Obtén el consentimiento en HealthSherpa</span>
                  <span className="text-xs font-medium" style={{ color: '#507b88' }}>abrir →</span>
                </a>
              ) : (
                <p className="text-xs text-gray-400 px-1">
                  ⚠️ Configura el link de consentimientos de HealthSherpa en{' '}
                  <a href="/settings" className="underline" style={{ color: '#507b88' }}>Configuración → Perfil del Agente</a> para verlo aquí.
                </p>
              )}
              <button onClick={markSherpaSent} disabled={savingSherpa || sentToSherpa}
                className="w-full px-4 py-3 rounded-xl text-sm font-bold text-left flex items-center justify-between disabled:cursor-default transition-colors"
                style={{
                  background: sentToSherpa ? '#fef3c7' : '#e8f0f4',
                  color: sentToSherpa ? '#92400e' : '#10253f',
                }}>
                <span>{sentToSherpa ? '⏳ Consentimiento Enviado' : '[ ⏳ Consentimiento Enviado ]'}</span>
                {sentToSherpa && <span className="text-xs font-medium">✓ activo</span>}
              </button>

              <button onClick={markConsent} disabled={savingConsent || hasConsent}
                className="w-full px-4 py-3 rounded-xl text-sm font-bold text-left flex items-center justify-between disabled:cursor-default transition-colors"
                style={{
                  background: hasConsent ? '#dcfce7' : '#e8f0f4',
                  color: hasConsent ? '#166534' : '#10253f',
                }}>
                <span>{hasConsent ? '✅ Consentimiento Recibido' : '[ ✅ Consentimiento Recibido ]'}</span>
                {hasConsent && <span className="text-xs font-medium">{fmtDateTime(prospect.consentAt)}</span>}
              </button>
              {!hasConsent && (
                <p className="text-xs text-gray-400 px-1">
                  ⚠️ El cierre permanece bloqueado hasta confirmar que el cliente dio su consentimiento — requisito normativo de CMS.
                </p>
              )}

              <Link href="/aptc" target="_blank"
                className="w-full px-4 py-3 rounded-xl text-sm font-bold flex items-center justify-between transition-colors"
                style={{ background: '#2563eb', color: '#ffffff' }}>
                <span>🧮 Calculadora APTC</span>
                <span className="text-xs font-medium text-white/80">abrir →</span>
              </Link>
            </div>
          </section>

          <hr className="border-gray-100" />

          {/* ── Block 3: Close ── */}
          <section>
            <h3 className="text-xs font-bold uppercase tracking-wider mb-3" style={{ color: '#507b88' }}>
              🏁 Cierre
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
              <button onClick={() => onConvert(prospect)} disabled={!hasConsent}
                className="w-full py-3.5 rounded-xl text-base font-bold text-white disabled:opacity-40 disabled:cursor-not-allowed transition-opacity"
                style={{ background: '#166534' }}>
                {hasConsent ? '→ Convertir en Cliente' : '🔒 Convertir en Cliente (requiere consentimiento)'}
              </button>
              <button onClick={() => onMoveToWaiting(prospect)}
                className="w-full py-3.5 rounded-xl text-base font-bold text-white transition-opacity"
                style={{ background: '#b91c1c' }}>
                🕓 En Espera de Decisión / Docs
              </button>
            </div>
          </section>
        </div>
      </div>
    </div>
  )
}

// ══════════════════════════════════════════════════════════════════════════════
// Callback / re-call scheduling — mandatory when entering "En Espera de Decisión"
// ══════════════════════════════════════════════════════════════════════════════
function CallbackModal({ prospect, onClose, onScheduled }: {
  prospect: Prospect
  onClose: () => void
  onScheduled: () => void
}) {
  const [date, setDate] = useState('')
  const [time, setTime] = useState('')
  const [saving, setSaving] = useState(false)

  async function handleSave(e: React.FormEvent) {
    e.preventDefault()
    if (!date || !time) return
    setSaving(true)
    await patchProspect(prospect.id, {
      stage: 'En Espera de Decisión / Docs',
      callbackAt: new Date(`${date}T${time}:00`).toISOString(),
    })
    setSaving(false)
    onScheduled()
  }

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl p-6 w-full max-w-sm shadow-2xl">
        <h2 className="font-bold text-lg mb-1" style={{ color: '#10253f' }}>📞 Programar Re-llamada</h2>
        <p className="text-sm text-gray-500 mb-4">
          <span className="font-semibold text-gray-800">{prospect.fullName}</span> entra al limbo controlado —
          define cuándo volverás a contactarlo. Es obligatorio para evitar que el lead se pierda.
        </p>
        <form onSubmit={handleSave} className="space-y-3">
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wide text-gray-500 mb-1">Fecha *</label>
            <input type="date" required className={INPUT} value={date} onChange={e => setDate(e.target.value)} />
          </div>
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wide text-gray-500 mb-1">Hora *</label>
            <input type="time" required className={INPUT} value={time} onChange={e => setTime(e.target.value)} />
          </div>
          <div className="flex gap-2 pt-2">
            <button type="submit" disabled={saving || !date || !time}
              className="flex-1 py-2 rounded-lg text-white font-semibold text-sm disabled:opacity-50"
              style={{ background: '#7fa4a4' }}>
              {saving ? 'Guardando...' : '✓ Confirmar y mover'}
            </button>
            <button type="button" onClick={onClose}
              className="flex-1 py-2 rounded-lg font-semibold text-sm border border-gray-300">
              Cancelar
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

// ══════════════════════════════════════════════════════════════════════════════
// Loss reason — mandatory standardized reason when closing a lead as lost
// ══════════════════════════════════════════════════════════════════════════════
function LossReasonModal({ prospect, onClose, onSaved }: {
  prospect: Prospect
  onClose: () => void
  onSaved: () => void
}) {
  const [saving, setSaving] = useState<string | null>(null)

  async function choose(reasonKey: string) {
    setSaving(reasonKey)
    const isNutrition = NUTRITION_REASONS.includes(reasonKey)
    const patch: Record<string, unknown> = {
      stage: 'Cerrado - Perdido',
      lossReason: reasonKey,
    }
    if (isNutrition) {
      patch.tags = JSON.stringify(['Nutrición'])
      patch.followUpAt = nextNov1().toISOString()
      patch.followUpNote = 'Reapertura de Open Enrollment (1 de noviembre) — recontactar lead nutrido'
    }
    await patchProspect(prospect.id, patch)
    setSaving(null)
    onSaved()
  }

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl p-6 w-full max-w-md shadow-2xl">
        <h2 className="font-bold text-lg mb-1" style={{ color: '#10253f' }}>📉 Motivo de Pérdida</h2>
        <p className="text-sm text-gray-500 mb-4">
          Selecciona por qué se pierde a <span className="font-semibold text-gray-800">{prospect.fullName}</span> — es obligatorio para mantener métricas limpias.
        </p>
        <div className="space-y-2">
          {LOSS_REASONS.map(r => (
            <button key={r.key} onClick={() => choose(r.key)} disabled={!!saving}
              className="w-full text-left px-4 py-3 rounded-xl border hover:shadow-md transition-shadow disabled:opacity-50"
              style={{ borderColor: '#fee2e2', background: '#fef9f9' }}>
              <div className="font-semibold text-sm flex items-center gap-2" style={{ color: '#991b1b' }}>
                <span>{r.icon}</span><span>{r.label}</span>
                {saving === r.key && <span className="text-xs font-normal">guardando...</span>}
              </div>
              <div className="text-xs text-gray-500 mt-0.5">{r.desc}</div>
              {NUTRITION_REASONS.includes(r.key) && (
                <div className="text-xs mt-1.5 font-medium" style={{ color: '#166534' }}>
                  🌱 Se etiquetará como &quot;Nutrición&quot; y se programará seguimiento automático para el 1 de noviembre (reapertura de Open Enrollment)
                </div>
              )}
            </button>
          ))}
        </div>
        <button onClick={onClose} disabled={!!saving}
          className="mt-3 w-full py-2 rounded-lg text-sm border border-gray-300">
          Cancelar
        </button>
      </div>
    </div>
  )
}

// ══════════════════════════════════════════════════════════════════════════════
// Convert to client — final step of the One-Call Close
// ══════════════════════════════════════════════════════════════════════════════
function ConvertModal({ prospect, onClose, onConverted }: {
  prospect: Prospect
  onClose: () => void
  onConverted: () => void
}) {
  const [insurer, setInsurer] = useState('')
  const [policyNumber, setPolicyNumber] = useState('')
  const [monthlyPremium, setMonthlyPremium] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleSave(e: React.FormEvent) {
    e.preventDefault()
    if (!insurer.trim() || !policyNumber.trim() || !monthlyPremium.trim()) return
    setSaving(true)
    setError(null)
    try {
      const premium = parseFloat(monthlyPremium) || 0
      const householdNum = prospect.householdSize ? parseInt(prospect.householdSize) || undefined : undefined
      const incomeNum = prospect.income ? parseFloat(prospect.income.replace(/[^0-9.]/g, '')) || undefined : undefined

      // 1) Mutate/duplicate into the definitive Clientes Activos table
      const res = await fetch('/api/clients', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          fullName: prospect.fullName,
          phone: prospect.phone || '',
          email: prospect.email || '',
          state: prospect.state || '',
          zipCode: prospect.zipCode || '',
          insurer,
          planId: policyNumber,
          acaPrice: monthlyPremium,
          totalMonthly: monthlyPremium,
          annualIncome: incomeNum ? String(incomeNum) : '',
          affiliatesCount: householdNum ? String(householdNum) : '1',
          status: 'Activo',
          notes: `Convertido desde Pipeline (Venta en Una Sola Llamada) · Prima mensual: $${premium.toFixed(2)}${prospect.notes ? `\n\nNotas del prospecto: ${prospect.notes}` : ''}`,
        }),
      })
      if (!res.ok) throw new Error('No se pudo crear el cliente')

      // 2) Archive the prospect as CERRADO_GANADO for metrics — it disappears from the board
      await patchProspect(prospect.id, { stage: 'Cerrado - Ganado' })

      onConverted()
    } catch {
      setError('Ocurrió un error al convertir. Intenta de nuevo.')
      setSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl p-6 w-full max-w-sm shadow-2xl">
        <h2 className="font-bold text-lg mb-1" style={{ color: '#10253f' }}>🏆 Convertir en Cliente</h2>
        <p className="text-sm text-gray-500 mb-4">
          <span className="font-semibold text-gray-800">{prospect.fullName}</span> pasará a Clientes Activos y se archivará como <span className="font-semibold" style={{ color: '#166534' }}>Cerrado - Ganado</span>.
        </p>
        <form onSubmit={handleSave} className="space-y-3">
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wide text-gray-500 mb-1">Compañía Aseguradora *</label>
            <input className={INPUT} required value={insurer} onChange={e => setInsurer(e.target.value)} placeholder="Florida Blue, Oscar, Ambetter..." />
          </div>
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wide text-gray-500 mb-1">Número de Póliza *</label>
            <input className={INPUT} required value={policyNumber} onChange={e => setPolicyNumber(e.target.value)} placeholder="Ej. 123456789" />
          </div>
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wide text-gray-500 mb-1">Prima Mensual ($) *</label>
            <input className={INPUT} required type="number" min="0" step="0.01" value={monthlyPremium}
              onChange={e => setMonthlyPremium(e.target.value)} placeholder="0.00" />
          </div>
          {error && <p className="text-xs text-red-500">{error}</p>}
          <div className="flex gap-2 pt-2">
            <button type="submit" disabled={saving}
              className="flex-1 py-2.5 rounded-lg text-white font-bold text-sm disabled:opacity-50"
              style={{ background: '#166534' }}>
              {saving ? 'Convirtiendo...' : '✓ Confirmar y Convertir'}
            </button>
            <button type="button" onClick={onClose} disabled={saving}
              className="flex-1 py-2.5 rounded-lg font-semibold text-sm border border-gray-300">
              Cancelar
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
