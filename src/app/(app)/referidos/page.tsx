'use client'

import { useEffect, useState, useCallback } from 'react'
import Link from 'next/link'
import { getReferralInitialMessage, getReferralReminderMessage } from '@/lib/referralMessages'
import { AGENT_FALLBACK, agentSignature } from '@/lib/agentProfile'
import ProfileNotice from '@/components/ProfileNotice'

interface Prospect {
  id: string; fullName: string; phone: string | null; stage: string; createdAt: string
}

interface Referrer {
  clientId: string; clientName: string; clientPhone: string | null; clientEmail: string | null
  totalReferrals: number; converted: number; pending: number; lost: number
  conversionRate: number; lastReferralDate: string; prospects: Prospect[]
}

function fmt(date: string) {
  try { return new Date(date).toLocaleDateString('es-US', { month: 'short', day: 'numeric', year: 'numeric' }) } catch { return date }
}

const RANK_BADGES = ['🥇', '🥈', '🥉']

// La firma sale de la Configuración de la agencia. Sin nombre configurado se
// firma con el rótulo neutro, nunca con el de otro agente.
function buildReferrerActions(referrer: Referrer, agentName: string) {
  const firstName = referrer.clientName.split(' ')[0]
  function sendWhatsApp() {
    if (!referrer.clientPhone) return
    const digits = referrer.clientPhone.replace(/\D/g, '')
    const intl = digits.length === 10 ? `1${digits}` : digits
    const msg = `Hola ${firstName}, ha sido un gusto acompañarte cuidando lo que más importa: tu salud y la de tu familia. Si conoces a alguien que valore una asesoría honesta y sin compromiso sobre sus seguros, sería un honor ayudarle igual que a ti. ¡Un abrazo! 🙏\n\n— ${agentSignature(agentName)}`
    window.open(`https://wa.me/${intl}?text=${encodeURIComponent(msg)}`, '_blank')
  }
  function sendEmail() {
    if (!referrer.clientEmail) return
    const subject = 'Gracias por tu confianza 🙏'
    const signOff = agentName.trim() ? `${agentName.trim()}\n${AGENT_FALLBACK}` : AGENT_FALLBACK
    const body = `Hola ${firstName},\n\nHa sido un verdadero gusto acompañarte asegurando lo que más importa para ti y tu familia.\n\nSi tienes algún familiar, amigo o compañero de trabajo que valore una asesoría honesta, clara y sin compromiso sobre sus seguros, sería un honor poder ayudarle con la misma dedicación que a ti.\n\n¡Un fuerte abrazo!\n\n${signOff}`
    window.location.href = `mailto:${referrer.clientEmail}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`
  }
  return { sendWhatsApp, sendEmail }
}

function ProspectsList({ prospects }: { prospects: Prospect[] }) {
  return (
    <div className="rounded-lg overflow-hidden mt-2" style={{ border: '1px solid #e2e8f0' }}>
      {prospects.map(p => (
        <div key={p.id} className="flex items-center justify-between px-3 py-2.5 border-b border-gray-100 last:border-b-0" style={{ background: '#f8fafc' }}>
          <div>
            <div className="text-sm font-medium" style={{ color: '#0f172a' }}>{p.fullName}</div>
            <div className="text-xs text-gray-500">{p.phone || 'Sin teléfono'} · Referido {fmt(p.createdAt)}</div>
          </div>
          <span className="px-2.5 py-1 rounded-full text-xs font-semibold"
            style={p.stage === 'Cerrado - Ganado'
              ? { background: '#d1fae5', color: '#065f46' }
              : p.stage === 'Cerrado - Perdido'
                ? { background: '#fee2e2', color: '#991b1b' }
                : { background: '#fef3c7', color: '#92400e' }}>
            {p.stage}
          </span>
        </div>
      ))}
    </div>
  )
}

function ReferrerCard({ referrer, rank, agentName }: { referrer: Referrer; rank: number; agentName: string }) {
  const [expanded, setExpanded] = useState(false)
  const { sendWhatsApp, sendEmail } = buildReferrerActions(referrer, agentName)
  return (
    <div className="bg-white rounded-xl border border-gray-200 p-4">
      <div className="flex items-start gap-3">
        <span className="text-xl mt-0.5">{rank <= 2 ? RANK_BADGES[rank] : <span className="text-xs font-bold text-gray-500">#{rank + 1}</span>}</span>
        <div className="flex-1 min-w-0">
          <Link href={`/clients/${referrer.clientId}`} className="text-sm font-semibold hover:underline block" style={{ color: '#10253f' }}>
            {referrer.clientName}
          </Link>
          {referrer.clientPhone && <div className="text-xs text-gray-500">{referrer.clientPhone}</div>}
        </div>
      </div>
      <div className="flex gap-3 mt-3 flex-wrap">
        <div className="flex flex-col items-center px-3 py-1.5 rounded-lg" style={{ background: '#f1f5f9' }}>
          <span className="text-xs text-gray-500">Referidos</span>
          <span className="text-sm font-bold" style={{ color: '#10253f' }}>{referrer.totalReferrals}</span>
        </div>
        <div className="flex flex-col items-center px-3 py-1.5 rounded-lg" style={{ background: '#d1fae5' }}>
          <span className="text-xs" style={{ color: '#065f46' }}>Convertidos</span>
          <span className="text-sm font-bold" style={{ color: '#065f46' }}>{referrer.converted}</span>
        </div>
        <div className="flex flex-col items-center px-3 py-1.5 rounded-lg" style={{ background: '#fef3c7' }}>
          <span className="text-xs" style={{ color: '#92400e' }}>Pendientes</span>
          <span className="text-sm font-bold" style={{ color: '#92400e' }}>{referrer.pending}</span>
        </div>
        <div className="flex flex-col items-center px-3 py-1.5 rounded-lg" style={{ background: '#f8fafc' }}>
          <span className="text-xs text-gray-500">Conversión</span>
          <span className="text-sm font-bold" style={{ color: referrer.conversionRate >= 50 ? '#065f46' : '#92400e' }}>{referrer.conversionRate}%</span>
        </div>
      </div>
      <div className="mt-2">
        <div className="h-1.5 rounded-full overflow-hidden w-full" style={{ background: '#f1f5f9' }}>
          <div className="h-full rounded-full" style={{ width: `${referrer.conversionRate}%`, background: referrer.conversionRate >= 50 ? '#10b981' : '#f59e0b' }} />
        </div>
      </div>
      <div className="text-xs text-gray-400 mt-1">Último referido: {fmt(referrer.lastReferralDate)}</div>
      <div className="flex flex-wrap gap-2 mt-3">
        {referrer.clientPhone && (
          <button onClick={sendWhatsApp}
            className="flex-1 px-3 py-2 rounded-lg text-xs font-semibold text-white text-center"
            style={{ background: '#25d366' }}>
            💬 Agradecer
          </button>
        )}
        {referrer.clientEmail && (
          <button onClick={sendEmail}
            className="flex-1 px-3 py-2 rounded-lg text-xs font-semibold text-white text-center"
            style={{ background: '#2a6496' }}>
            📧 Email
          </button>
        )}
        <button onClick={() => setExpanded(v => !v)}
          className="flex-1 px-3 py-2 rounded-lg text-xs font-semibold border text-center"
          style={{ border: '1px solid #cbd5e1', color: '#475569' }}>
          {expanded ? '▲ Ocultar' : '👁 Prospectos'}
        </button>
      </div>
      {expanded && <ProspectsList prospects={referrer.prospects} />}
    </div>
  )
}

function ReferrerRow({ referrer, rank, agentName }: { referrer: Referrer; rank: number; agentName: string }) {
  const [expanded, setExpanded] = useState(false)
  const { sendWhatsApp, sendEmail } = buildReferrerActions(referrer, agentName)

  return (
    <>
      <tr className="border-b border-gray-100 hover:bg-gray-50 transition-colors">
        <td className="px-4 py-3 text-center">
          <span className="text-lg">{rank <= 2 ? RANK_BADGES[rank] : <span className="text-xs font-bold text-gray-500">#{rank + 1}</span>}</span>
        </td>
        <td className="px-4 py-3">
          <Link href={`/clients/${referrer.clientId}`} className="text-sm font-semibold hover:underline" style={{ color: '#10253f' }}>
            {referrer.clientName}
          </Link>
          {referrer.clientPhone && <div className="text-xs text-gray-500 mt-0.5">{referrer.clientPhone}</div>}
        </td>
        <td className="px-4 py-3 text-center">
          <span className="text-sm font-bold" style={{ color: '#10253f' }}>{referrer.totalReferrals}</span>
        </td>
        <td className="px-4 py-3 text-center">
          <span className="px-2 py-0.5 rounded-full text-xs font-semibold" style={{ background: '#d1fae5', color: '#065f46' }}>{referrer.converted}</span>
        </td>
        <td className="px-4 py-3 text-center">
          <span className="px-2 py-0.5 rounded-full text-xs font-semibold" style={{ background: '#fef3c7', color: '#92400e' }}>{referrer.pending}</span>
        </td>
        <td className="px-4 py-3">
          <div className="flex items-center gap-2">
            <div className="flex-1 h-1.5 rounded-full overflow-hidden" style={{ background: '#f1f5f9', minWidth: 60 }}>
              <div className="h-full rounded-full" style={{ width: `${referrer.conversionRate}%`, background: referrer.conversionRate >= 50 ? '#10b981' : '#f59e0b' }} />
            </div>
            <span className="text-xs font-semibold w-8" style={{ color: referrer.conversionRate >= 50 ? '#065f46' : '#92400e' }}>{referrer.conversionRate}%</span>
          </div>
        </td>
        <td className="px-4 py-3 text-xs text-gray-500">{fmt(referrer.lastReferralDate)}</td>
        <td className="px-4 py-3">
          <div className="flex items-center gap-1.5">
            {referrer.clientPhone && (
              <button onClick={sendWhatsApp}
                className="px-2.5 py-1 rounded-lg text-xs font-semibold text-white transition-all hover:opacity-90"
                style={{ background: '#25d366' }}>
                💬 Agradecer
              </button>
            )}
            {referrer.clientEmail && (
              <button onClick={sendEmail}
                className="px-2.5 py-1 rounded-lg text-xs font-semibold text-white transition-all hover:opacity-90"
                style={{ background: '#2a6496' }}>
                📧 Email
              </button>
            )}
            <button onClick={() => setExpanded(v => !v)}
              className="px-2.5 py-1 rounded-lg text-xs font-semibold border transition-all hover:bg-gray-100"
              style={{ border: '1px solid #cbd5e1', color: '#475569' }}>
              {expanded ? '▲ Ocultar' : '👁 Ver prospectos'}
            </button>
          </div>
        </td>
      </tr>
      {expanded && (
        <tr>
          <td colSpan={8} className="px-4 py-0">
            <div className="pb-3">
              <ProspectsList prospects={referrer.prospects} />
            </div>
          </td>
        </tr>
      )}
    </>
  )
}

// ── Solicitar Referidos ──────────────────────────────────────────────────

interface RequestClient {
  id: string
  fullName: string
  phone: string | null
  referralRequestStage: string | null
  referralRequestSentAt: string | null
  referralRequestLastSent: string | null
}

const REQUEST_STAGES = ['Por enviar', 'Solicitado', 'Recordatorio enviado', 'Refirió', 'No por ahora'] as const
type RequestStage = typeof REQUEST_STAGES[number]

const REQUEST_STAGE_META: Record<RequestStage, { color: string; bg: string; borderColor: string }> = {
  'Por enviar':           { color: '#64748b', bg: '#f8fafc', borderColor: '#e2e8f0' },
  'Solicitado':           { color: '#2563eb', bg: '#eff6ff', borderColor: '#bfdbfe' },
  'Recordatorio enviado': { color: '#d97706', bg: '#fffbeb', borderColor: '#fde68a' },
  'Refirió':              { color: '#059669', bg: '#f0fdf4', borderColor: '#a7f3d0' },
  'No por ahora':         { color: '#dc2626', bg: '#fef2f2', borderColor: '#fecaca' },
}

function getStage(c: RequestClient): RequestStage {
  return (c.referralRequestStage as RequestStage) || 'Por enviar'
}

function daysSince(iso: string | null): number | null {
  if (!iso) return null
  return Math.floor((Date.now() - new Date(iso).getTime()) / (1000 * 60 * 60 * 24))
}

function whatsAppLink(phone: string, message: string): string {
  const digits = phone.replace(/\D/g, '')
  const intl = digits.length === 10 ? `1${digits}` : digits
  return `https://wa.me/${intl}?text=${encodeURIComponent(message)}`
}

function RequestReferralsTab() {
  const [clients, setClients] = useState<RequestClient[]>([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState<'Todos' | RequestStage>('Todos')
  const [saving, setSaving] = useState<string | null>(null)
  // Con quién se firman los mensajes que se van a enviar desde esta pestaña.
  const [agentName, setAgentName] = useState('')

  useEffect(() => {
    fetch('/api/settings').then(r => r.json()).then(s => setAgentName(s.agentName || '')).catch(() => {})
  }, [])

  const load = useCallback(async () => {
    const res = await fetch('/api/referral-requests')
    const data = await res.json()
    setClients(data.clients || [])
    setLoading(false)
  }, [])

  useEffect(() => { load() }, [load])

  const updateClient = useCallback(async (id: string, patch: Record<string, unknown>) => {
    setSaving(id)
    await fetch(`/api/clients/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(patch),
    })
    await load()
    setSaving(null)
  }, [load])

  function sendInitial(c: RequestClient) {
    if (!c.phone) return
    const msg = getReferralInitialMessage(c.fullName.split(' ')[0], c.id, agentName)
    window.open(whatsAppLink(c.phone, msg), '_blank')
    updateClient(c.id, { referralRequestStage: 'Solicitado', referralRequestSentAt: new Date().toISOString(), referralRequestLastSent: new Date().toISOString() })
  }

  function sendReminder(c: RequestClient) {
    if (!c.phone) return
    const msg = getReferralReminderMessage(c.fullName.split(' ')[0], c.id, agentName)
    window.open(whatsAppLink(c.phone, msg), '_blank')
    updateClient(c.id, { referralRequestStage: 'Recordatorio enviado', referralRequestLastSent: new Date().toISOString() })
  }

  function setFinalStage(c: RequestClient, stage: RequestStage) {
    updateClient(c.id, { referralRequestStage: stage })
  }

  function reset(c: RequestClient) {
    updateClient(c.id, { referralRequestStage: null, referralRequestSentAt: null, referralRequestLastSent: null })
  }

  if (loading) return (
    <div className="flex items-center justify-center h-64">
      <div className="text-gray-400">Cargando clientes...</div>
    </div>
  )

  const counts: Record<RequestStage, number> = { 'Por enviar': 0, 'Solicitado': 0, 'Recordatorio enviado': 0, 'Refirió': 0, 'No por ahora': 0 }
  for (const c of clients) counts[getStage(c)]++

  const filtered = filter === 'Todos' ? clients : clients.filter(c => getStage(c) === filter)

  return (
    <div className="space-y-6">
      <ProfileNotice context="Los mensajes de referidos se firman con tu nombre." />
      <div className="rounded-xl p-4" style={{ background: '#f0f7fb', border: '1px solid #b8d4e8' }}>
        <p className="text-sm" style={{ color: '#1e4a6e' }}>
          <strong>💡 Cómo funciona:</strong> envía un mensaje de WhatsApp pidiendo referidos de forma cálida y personalizada. El sistema marca automáticamente al cliente como &quot;Solicitado&quot; y, unos días después, puedes enviarle un recordatorio amable con un mensaje diferente. Marca &quot;Refirió&quot; o &quot;No por ahora&quot; según la respuesta para llevar el control.
        </p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        {(['Todos', ...REQUEST_STAGES] as const).map(stage => {
          const meta = stage === 'Todos' ? { color: '#10253f', bg: '#f8fafc', borderColor: '#e2e8f0' } : REQUEST_STAGE_META[stage]
          const count = stage === 'Todos' ? clients.length : counts[stage]
          const active = filter === stage
          return (
            <button
              key={stage}
              onClick={() => setFilter(stage)}
              className="rounded-xl p-3 text-left transition-all"
              style={{ background: meta.bg, border: `2px solid ${active ? meta.color : meta.borderColor}` }}
            >
              <div className="text-2xl font-bold" style={{ color: meta.color }}>{count}</div>
              <div className="text-xs font-medium mt-0.5" style={{ color: meta.color }}>{stage}</div>
            </button>
          )
        })}
      </div>

      {/* ── Mobile cards (hidden on md+) ────────────────────────────────── */}
      <div className="flex flex-col gap-3 md:hidden">
        {filtered.map(c => {
          const stage = getStage(c)
          const meta = REQUEST_STAGE_META[stage]
          const lastSentDays = daysSince(c.referralRequestLastSent)
          const isSaving = saving === c.id
          return (
            <div key={c.id} className="rounded-2xl p-4 bg-white border border-gray-200" style={{ boxShadow: '0 1px 3px rgba(0,0,0,.06)' }}>
              <div className="flex items-start justify-between gap-2 mb-3">
                <div>
                  <Link href={`/clients/${c.id}`} className="font-semibold text-sm" style={{ color: '#10253f' }}>{c.fullName}</Link>
                  {c.phone && <div className="text-xs text-gray-500 mt-0.5">{c.phone}</div>}
                </div>
                <span className="shrink-0 px-2.5 py-1 rounded-full text-xs font-semibold whitespace-nowrap"
                  style={{ background: meta.bg, color: meta.color, border: `1px solid ${meta.borderColor}` }}>
                  {stage}
                </span>
              </div>
              <div className="text-xs text-gray-400 mb-3">
                Última acción: {lastSentDays === null ? '—' : lastSentDays === 0 ? 'Hoy' : `Hace ${lastSentDays} día${lastSentDays === 1 ? '' : 's'}`}
              </div>
              <div className="flex flex-wrap gap-2">
                {c.phone && stage === 'Por enviar' && (
                  <button onClick={() => sendInitial(c)} disabled={isSaving}
                    className="px-3 py-1.5 rounded-lg text-xs font-semibold text-white" style={{ background: '#25d366' }}>
                    💬 Solicitar referido
                  </button>
                )}
                {c.phone && (stage === 'Solicitado' || stage === 'Recordatorio enviado') && (
                  <button onClick={() => sendReminder(c)} disabled={isSaving}
                    className="px-3 py-1.5 rounded-lg text-xs font-semibold text-white" style={{ background: '#25d366' }}>
                    💬 Recordatorio
                  </button>
                )}
                {(stage === 'Solicitado' || stage === 'Recordatorio enviado' || stage === 'Por enviar') && (
                  <>
                    <button onClick={() => setFinalStage(c, 'Refirió')} disabled={isSaving}
                      className="px-3 py-1.5 rounded-lg text-xs font-semibold border" style={{ border: '1px solid #a7f3d0', color: '#059669' }}>
                      ✅ Refirió
                    </button>
                    <button onClick={() => setFinalStage(c, 'No por ahora')} disabled={isSaving}
                      className="px-3 py-1.5 rounded-lg text-xs font-semibold border" style={{ border: '1px solid #fecaca', color: '#dc2626' }}>
                      🙅 No por ahora
                    </button>
                  </>
                )}
                {(stage === 'Refirió' || stage === 'No por ahora') && (
                  <button onClick={() => reset(c)} disabled={isSaving}
                    className="px-3 py-1.5 rounded-lg text-xs font-semibold border" style={{ border: '1px solid #cbd5e1', color: '#475569' }}>
                    ↺ Reiniciar
                  </button>
                )}
                {!c.phone && <span className="text-xs text-gray-400">Sin teléfono</span>}
              </div>
            </div>
          )
        })}
        {filtered.length === 0 && (
          <div className="text-center py-8 text-sm text-gray-400">No hay clientes en este estado.</div>
        )}
      </div>

      {/* ── Desktop table (hidden on mobile) ─────────────────────────────── */}
      <div className="hidden md:block bg-white rounded-xl border border-gray-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr style={{ background: '#f8fafc', borderBottom: '1px solid #e2e8f0' }}>
                <th className="px-4 py-3 text-xs font-semibold text-gray-500 text-left">Cliente</th>
                <th className="px-4 py-3 text-xs font-semibold text-gray-500 text-left">Estado</th>
                <th className="px-4 py-3 text-xs font-semibold text-gray-500 text-left">Última acción</th>
                <th className="px-4 py-3 text-xs font-semibold text-gray-500 text-left">Acciones</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map(c => {
                const stage = getStage(c)
                const meta = REQUEST_STAGE_META[stage]
                const lastSentDays = daysSince(c.referralRequestLastSent)
                const isSaving = saving === c.id
                return (
                  <tr key={c.id} className="border-b border-gray-50 hover:bg-gray-50">
                    <td className="px-4 py-3">
                      <Link href={`/clients/${c.id}`} className="text-sm font-semibold hover:underline" style={{ color: '#10253f' }}>{c.fullName}</Link>
                      {c.phone && <div className="text-xs text-gray-500 mt-0.5">{c.phone}</div>}
                    </td>
                    <td className="px-4 py-3">
                      <span className="px-2.5 py-1 rounded-full text-xs font-semibold whitespace-nowrap" style={{ background: meta.bg, color: meta.color, border: `1px solid ${meta.borderColor}` }}>
                        {stage}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-xs text-gray-500">
                      {lastSentDays === null ? '—' : lastSentDays === 0 ? 'Hoy' : `Hace ${lastSentDays} día${lastSentDays === 1 ? '' : 's'}`}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        {c.phone && (stage === 'Por enviar') && (
                          <button onClick={() => sendInitial(c)} disabled={isSaving}
                            className="px-2.5 py-1 rounded-lg text-xs font-semibold text-white transition-all hover:opacity-90 disabled:opacity-50"
                            style={{ background: '#25d366' }}>
                            💬 Solicitar referido
                          </button>
                        )}
                        {c.phone && (stage === 'Solicitado' || stage === 'Recordatorio enviado') && (
                          <button onClick={() => sendReminder(c)} disabled={isSaving}
                            className="px-2.5 py-1 rounded-lg text-xs font-semibold text-white transition-all hover:opacity-90 disabled:opacity-50"
                            style={{ background: '#25d366' }}>
                            💬 Recordatorio
                          </button>
                        )}
                        {(stage === 'Solicitado' || stage === 'Recordatorio enviado' || stage === 'Por enviar') && (
                          <>
                            <button onClick={() => setFinalStage(c, 'Refirió')} disabled={isSaving}
                              className="px-2.5 py-1 rounded-lg text-xs font-semibold border transition-all hover:bg-gray-100 disabled:opacity-50"
                              style={{ border: '1px solid #a7f3d0', color: '#059669' }}>
                              ✅ Refirió
                            </button>
                            <button onClick={() => setFinalStage(c, 'No por ahora')} disabled={isSaving}
                              className="px-2.5 py-1 rounded-lg text-xs font-semibold border transition-all hover:bg-gray-100 disabled:opacity-50"
                              style={{ border: '1px solid #fecaca', color: '#dc2626' }}>
                              🙅 No por ahora
                            </button>
                          </>
                        )}
                        {(stage === 'Refirió' || stage === 'No por ahora') && (
                          <button onClick={() => reset(c)} disabled={isSaving}
                            className="px-2.5 py-1 rounded-lg text-xs font-semibold border transition-all hover:bg-gray-100 disabled:opacity-50"
                            style={{ border: '1px solid #cbd5e1', color: '#475569' }}>
                            ↺ Reiniciar
                          </button>
                        )}
                        {!c.phone && <span className="text-xs text-gray-400">Sin teléfono</span>}
                      </div>
                    </td>
                  </tr>
                )
              })}
              {filtered.length === 0 && (
                <tr>
                  <td colSpan={4} className="px-4 py-8 text-center text-sm text-gray-400">No hay clientes en este estado.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}

export default function ReferidosPage() {
  const [tab, setTab] = useState<'top' | 'solicitar'>('top')
  const [referrers, setReferrers] = useState<Referrer[]>([])
  const [loading, setLoading] = useState(true)
  // Firma de los mensajes: de la Configuración de la agencia, no del código.
  const [agentName, setAgentName] = useState('')

  useEffect(() => {
    fetch('/api/referrals').then(r => r.json()).then(d => {
      setReferrers(d.referrers || [])
      setLoading(false)
    })
    fetch('/api/settings').then(r => r.json()).then(s => setAgentName(s.agentName || '')).catch(() => {})
  }, [])

  function broadcastWhatsApp() {
    const msg = `Hola, ha sido un gusto acompañarte cuidando lo que más importa: tu salud y la de tu familia. Si conoces a alguien que valore una asesoría honesta y sin compromiso sobre sus seguros, sería un honor ayudarle igual que a ti. ¡Un abrazo! 🙏\n\n— ${agentSignature(agentName)}`
    window.open(`https://wa.me/?text=${encodeURIComponent(msg)}`, '_blank')
  }

  const TAB_BASE = 'px-5 py-2 text-sm font-semibold rounded-lg transition-colors'
  const TAB_ACTIVE = TAB_BASE + ' text-white'
  const TAB_INACTIVE = TAB_BASE + ' text-gray-600 hover:bg-gray-100'

  const totalReferrers = referrers.length
  const totalReferrals = referrers.reduce((s, r) => s + r.totalReferrals, 0)
  const best = referrers[0] || null
  const avgConversion = totalReferrers > 0 ? Math.round(referrers.reduce((s, r) => s + r.conversionRate, 0) / totalReferrers) : 0

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-start justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-2xl font-bold" style={{ color: '#10253f' }}>🤝 Referidos</h1>
          <p className="text-sm text-gray-500 mt-1">Clientes que han referido prospectos y campaña de solicitud de referidos</p>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-2">
        <button className={tab === 'top' ? TAB_ACTIVE : TAB_INACTIVE}
          style={tab === 'top' ? { background: '#10253f' } : {}}
          onClick={() => setTab('top')}>
          Top Referidores
        </button>
        <button className={tab === 'solicitar' ? TAB_ACTIVE : TAB_INACTIVE}
          style={tab === 'solicitar' ? { background: '#10253f' } : {}}
          onClick={() => setTab('solicitar')}>
          Solicitar Referidos
        </button>
      </div>

      {tab === 'top' && (
        loading ? (
          <div className="flex items-center justify-center h-64">
            <div className="text-gray-400">Cargando referidos...</div>
          </div>
        ) : (
          <div className="space-y-6">
            {/* Summary cards */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {[
                { label: 'Clientes que refirieron', value: totalReferrers, icon: '👥', color: '#10253f', bg: '#e8f2f8' },
                { label: 'Total prospectos referidos', value: totalReferrals, icon: '🔗', color: '#2a6496', bg: '#dbeafe' },
                { label: 'Mejor referidor', value: best ? best.clientName.split(' ')[0] + ' (' + best.totalReferrals + ')' : '—', icon: '🥇', color: '#d97706', bg: '#fef3c7' },
                { label: 'Tasa de conversión promedio', value: `${avgConversion}%`, icon: '📈', color: '#059669', bg: '#d1fae5' },
              ].map(card => (
                <div key={card.label} className="bg-white rounded-xl border border-gray-200 p-4" style={{ borderTop: `3px solid ${card.color}` }}>
                  <div className="flex items-start justify-between">
                    <div className="min-w-0">
                      <div className="text-2xl font-extrabold leading-none truncate" style={{ color: '#0f172a' }}>{card.value}</div>
                      <div className="text-xs font-medium mt-1.5 text-gray-500">{card.label}</div>
                    </div>
                    <div className="w-9 h-9 rounded-xl flex items-center justify-center text-lg shrink-0" style={{ background: card.bg }}>{card.icon}</div>
                  </div>
                </div>
              ))}
            </div>

            {/* Table or empty state */}
            {referrers.length === 0 ? (
              <div className="bg-white rounded-xl border border-gray-200 p-12 text-center">
                <div className="text-4xl mb-4">🤝</div>
                <h3 className="font-bold text-lg text-gray-700 mb-2">¡Aún no hay referidos!</h3>
                <p className="text-sm text-gray-500 mb-6">Motiva a tus clientes a referir amigos y familiares que necesiten seguro de salud.</p>
                <button onClick={broadcastWhatsApp}
                  className="inline-flex items-center gap-2 px-6 py-2.5 rounded-lg text-white font-semibold transition-all hover:opacity-90"
                  style={{ background: '#25d366' }}>
                  💬 Enviar mensaje a clientes
                </button>
              </div>
            ) : (
              <div>
                {/* Mobile cards */}
                <div className="flex flex-col gap-3 md:hidden">
                  {referrers.map((r, i) => (
                    <ReferrerCard key={r.clientId} referrer={r} rank={i} agentName={agentName} />
                  ))}
                </div>
                {/* Desktop table */}
                <div className="hidden md:block bg-white rounded-xl border border-gray-200 overflow-hidden">
                  <div className="px-5 py-4 border-b border-gray-100">
                    <h2 className="font-semibold text-sm" style={{ color: '#10253f' }}>Top Referidores</h2>
                  </div>
                  <div className="overflow-x-auto">
                    <table className="w-full">
                      <thead>
                        <tr style={{ background: '#f8fafc', borderBottom: '1px solid #e2e8f0' }}>
                          <th className="px-4 py-3 text-xs font-semibold text-gray-500 text-center w-12">#</th>
                          <th className="px-4 py-3 text-xs font-semibold text-gray-500 text-left">Cliente</th>
                          <th className="px-4 py-3 text-xs font-semibold text-gray-500 text-center">Referidos</th>
                          <th className="px-4 py-3 text-xs font-semibold text-gray-500 text-center">Convertidos</th>
                          <th className="px-4 py-3 text-xs font-semibold text-gray-500 text-center">Pendientes</th>
                          <th className="px-4 py-3 text-xs font-semibold text-gray-500 text-left">Tasa conv.</th>
                          <th className="px-4 py-3 text-xs font-semibold text-gray-500 text-left">Último</th>
                          <th className="px-4 py-3 text-xs font-semibold text-gray-500 text-left">Acciones</th>
                        </tr>
                      </thead>
                      <tbody>
                        {referrers.map((r, i) => (
                          <ReferrerRow key={r.clientId} referrer={r} rank={i} agentName={agentName} />
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            )}
          </div>
        )
      )}

      {tab === 'solicitar' && <RequestReferralsTab />}
    </div>
  )
}
