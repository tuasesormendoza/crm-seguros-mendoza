'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { daysUntilRule } from '@/lib/subsidyEligibility'
import type { BackupHealth } from '@/lib/backupHealth'
import { formatDate } from '@/lib/utils'
import { getMotivationalQuote } from '@/lib/motivationalQuotes'
import LoadError from '@/components/LoadError'

const REVIEW_LINK = 'https://g.page/r/CbFgt44hL28OEAE/review'

const REVIEW_STAGE_META: Record<string, { color: string; bg: string; borderColor: string }> = {
  'Pendiente por enviar':    { color: '#64748b', bg: '#f8fafc', borderColor: '#e2e8f0' },
  'Enviada':                 { color: '#2563eb', bg: '#eff6ff', borderColor: '#bfdbfe' },
  'Esperando por el cliente':{ color: '#d97706', bg: '#fffbeb', borderColor: '#fde68a' },
  'Realizada':               { color: '#059669', bg: '#f0fdf4', borderColor: '#a7f3d0' },
}

function makeWhatsApp(phone: string | null | undefined, name: string, stage: string): string {
  if (!phone) return ''
  const digits = phone.replace(/\D/g, '')
  const intl = digits.length === 10 ? `1${digits}` : digits
  let msg = ''
  if (stage === 'Pendiente por enviar' || stage === 'Enviada') {
    msg = `Hola ${name}, fue un placer atenderte. Te agradecería mucho si pudieras dejarnos una reseña en Google, solo toma 1 minuto 🙏: ${REVIEW_LINK}`
  } else if (stage === 'Esperando por el cliente') {
    msg = `Hola ${name}, quería recordarte que nos encantaría contar con tu reseña en Google: ${REVIEW_LINK} ¡Gracias!`
  }
  return `https://wa.me/${intl}?text=${encodeURIComponent(msg)}`
}

interface ReviewStage {
  stage: string
  count: number
  clients: { id: string; fullName: string; phone: string | null }[]
}

interface Goals {
  newClientsMonthly: number
  newClientsAnnual: number
  revenueMonthly: number
  revenueAnnual: number
  wnClientsMonthly: number
}
interface GoalsProgress { newClients: number; revenue: number; wnClients: number }

interface DashboardData {
  totalPolicies: number
  activeClients: number
  cancelledClients: number
  pendingPayment: number
  totalLives: number
  withWN: number
  byInsurer: Record<string, number>
  byState: Record<string, number>
  byCoverage: Record<string, number>
  upcomingRenewals: { id: string; fullName: string; renewalDate: string; insurer: string; daysUntil: number }[]
  upcomingBirthdays: { id: string; name: string; birthDate: string; daysUntil: number; type: string; phone: string | null }[]
  reviewsSent: number
  reviewsPending: number
  reviewByStage: ReviewStage[]
  unpaidFirstPremium: { id: string; fullName: string; contractDate: string; daysLeft: number; firstPaymentPaid: boolean | null }[]
  pendingFirstPayment: { id: string; fullName: string; contractDate: string; insurer: string | null; daysElapsed: number }[]
  totalMonthly: number
  newClientsThisMonth: { id: string; fullName: string; insurer: string | null; planCategory: string | null; totalMonthly: number | null; contractDate: string; status: string | null }[]
  backup?: BackupHealth | null    // salud del respaldo automático a Drive
  losesSubsidyCount?: number      // pierden el crédito fiscal el 01/01/2027
  missingMigrationCount?: number  // activos sin estatus migratorio registrado
}

function ReviewStageCard({ stage, count, clients }: ReviewStage) {
  const [expanded, setExpanded] = useState(false)
  const meta = REVIEW_STAGE_META[stage] ?? { color: '#64748b', bg: '#f8fafc', borderColor: '#e2e8f0' }

  return (
    <div style={{ borderRadius: 'var(--r-lg)', border: `1px solid ${meta.borderColor}`, overflow: 'hidden' }}>
      <button
        onClick={() => setExpanded(v => !v)}
        className="w-full p-4 text-left flex items-start justify-between transition-opacity hover:opacity-90"
        style={{ background: meta.bg }}>
        <div>
          <div className="text-xs font-semibold uppercase tracking-wide mb-2" style={{ color: meta.color }}>{stage}</div>
          <div className="text-3xl font-bold" style={{ color: meta.color, lineHeight: 1 }}>{count}</div>
          <div className="text-xs mt-1" style={{ color: 'var(--gray-500)' }}>{count === 1 ? 'cliente' : 'clientes'}</div>
        </div>
        {count > 0 && (
          <span style={{ color: 'var(--gray-400)', fontSize: '10px' }}>{expanded ? '▲' : '▼'}</span>
        )}
      </button>
      {expanded && count > 0 && (
        <div className="divide-y max-h-60 overflow-y-auto" style={{ borderTop: `1px solid ${meta.borderColor}` }}>
          {clients.map(c => {
            const waLink = makeWhatsApp(c.phone, c.fullName.split(' ')[0], stage)
            return (
              <div key={c.id} className="px-3 py-2.5" style={{ background: 'var(--surface-card)' }}>
                <div className="flex items-center justify-between gap-2">
                  <Link href={`/clients/${c.id}`}
                    className="text-xs font-medium hover:underline truncate"
                    style={{ color: 'var(--gray-900)' }}>
                    {c.fullName}
                  </Link>
                  {waLink && stage !== 'Realizada' && (
                    <a href={waLink} target="_blank" rel="noopener noreferrer"
                      title="Enviar por WhatsApp"
                      className="shrink-0 text-base hover:scale-110 transition-transform">💬</a>
                  )}
                </div>
                {c.phone && <div className="text-xs mt-0.5" style={{ color: 'var(--gray-400)' }}>{c.phone}</div>}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

function getAEPCountdown() {
  const today = new Date()
  const year = today.getFullYear()
  const prevAepStart = new Date(year - 1, 10, 15)
  const prevAepEnd   = new Date(year, 0, 15)
  const currAepStart = new Date(year, 10, 15)
  const currAepEnd   = new Date(year + 1, 0, 15)
  const isInPrevAep  = today >= prevAepStart && today <= prevAepEnd
  const isInCurrAep  = today >= currAepStart && today <= currAepEnd
  const isActive     = isInPrevAep || isInCurrAep
  const activeEnd    = isInPrevAep ? prevAepEnd : currAepEnd
  const nextStart    = today < currAepStart ? currAepStart : new Date(year + 1, 10, 15)
  const daysUntilStart = Math.ceil((nextStart.getTime() - today.getTime()) / (1000*60*60*24))
  const daysUntilEnd   = Math.ceil((activeEnd.getTime() - today.getTime()) / (1000*60*60*24))
  return { isActive, daysUntilStart, daysUntilEnd, nextStart, activeEnd }
}

const CARD: React.CSSProperties = {
  background: 'rgba(255,255,255,0.65)',
  backdropFilter: 'blur(20px) saturate(1.8)',
  WebkitBackdropFilter: 'blur(20px) saturate(1.8)',
  borderRadius: 18,
  boxShadow: '0 8px 32px rgba(var(--brand-800-rgb), 0.10), 0 1px 0 rgba(255,255,255,0.80) inset',
  border: '1px solid rgba(255,255,255,0.60)',
  padding: '20px 24px',
}

function GoalBar({ label, current, target, prefix = '' }: { label: string; current: number; target: number; prefix?: string }) {
  const pct = target > 0 ? Math.min(100, Math.round((current / target) * 100)) : 0
  const color = pct >= 80 ? '#10b981' : pct >= 50 ? '#f59e0b' : '#ef4444'
  return (
    <div>
      <div className="flex items-center justify-between text-xs mb-1">
        <span style={{ color: '#475569' }}>{label}</span>
        <div className="flex items-center gap-2">
          <span style={{ color: '#0f172a', fontWeight: 600 }}>{prefix}{current.toLocaleString()} / {prefix}{target.toLocaleString()}</span>
          <span className="px-1.5 py-0.5 rounded-full text-xs font-bold" style={{ background: pct >= 80 ? '#d1fae5' : pct >= 50 ? '#fef3c7' : '#fee2e2', color }}>{pct}%</span>
        </div>
      </div>
      <div className="h-2 rounded-full overflow-hidden" style={{ background: '#f1f5f9' }}>
        <div className="h-full rounded-full transition-all" style={{ width: `${pct}%`, background: `linear-gradient(90deg, ${color}, ${color}cc)` }} />
      </div>
    </div>
  )
}

export default function Dashboard() {
  const [data, setData] = useState<DashboardData | null>(null)
  const [goals, setGoals] = useState<Goals | null>(null)
  const [goalsProgress, setGoalsProgress] = useState<GoalsProgress | null>(null)
  const [birthdayTemplate, setBirthdayTemplate] = useState('Hola {nombre}, ¡feliz cumpleaños! 🎂🎉 Que tengas un día muy especial. Con cariño, {agente}')
  const [agentName, setAgentName] = useState('Omar Mendoza')
  const [loadError, setLoadError] = useState(false)
  const [tagging, setTagging] = useState(false)

  // Etiqueta de una vez a todos los clientes que perderán el crédito fiscal,
  // para poder filtrarlos después en la lista de Clientes.
  async function tagAffected() {
    setTagging(true)
    try {
      const res = await fetch('/api/clients/tag-subsidy', { method: 'POST' })
      const d = await res.json()
      alert(res.ok
        ? `🏷️ Listo: ${d.tagged} cliente(s) etiquetados como "Sin subsidio 2027"${d.tagged < d.affected ? ` (${d.affected - d.tagged} ya la tenían).` : '.'}\n\nAhora puedes filtrarlos en Clientes por esa etiqueta.`
        : (d.error || 'No se pudo etiquetar.'))
    } catch { alert('No se pudo conectar con el servidor.') }
    setTagging(false)
  }

  useEffect(() => {
    fetch('/api/dashboard')
      .then(r => { if (!r.ok) throw new Error(`HTTP ${r.status}`); return r.json() })
      .then(setData)
      .catch(() => setLoadError(true))
    // Datos secundarios: si fallan, el dashboard funciona con los valores por defecto
    fetch('/api/goals').then(r => r.json()).then(d => {
      if (d.goals) { setGoals(d.goals); setGoalsProgress(d.progress) }
    }).catch(() => {})
    fetch('/api/settings').then(r => r.json()).then(s => {
      if (s.birthdayTemplate) setBirthdayTemplate(s.birthdayTemplate)
      if (s.agentName) setAgentName(s.agentName)
    }).catch(() => {})
    // Auto-check notifications once per day
    const lastCheck = localStorage.getItem('notif_last_check')
    const today = new Date().toISOString().split('T')[0]
    if (lastCheck !== today) {
      fetch('/api/notifications/check', { method: 'POST' }).then(() => {
        localStorage.setItem('notif_last_check', today)
      }).catch(() => {})
    }
  }, [])

  if (!data && loadError) return <LoadError message="No se pudo cargar el dashboard" />

  if (!data) return (
    <div className="flex items-center justify-center h-64">
      <div className="flex items-center gap-3" style={{ color: 'var(--gray-400)' }}>
        <span>Cargando dashboard...</span>
      </div>
    </div>
  )

  const aep = getAEPCountdown()
  const todayItems = (data.upcomingRenewals?.filter(r => r.daysUntil <= 14).length || 0)
    + (data.upcomingBirthdays?.filter(b => b.daysUntil <= 7).length || 0)
    + (data.pendingFirstPayment?.length || 0)

  const hour = new Date().getHours()
  const greeting = hour < 12 ? 'Buenos días' : hour < 18 ? 'Buenas tardes' : 'Buenas noches'
  const motivationalQuote = getMotivationalQuote()

  const kpis = [
    { label: 'Total Pólizas',      value: data.totalPolicies, icon: '📋', accent: 'var(--brand-500)', iconBg: 'rgba(var(--brand-500-rgb), .12)', border: 'var(--brand-500)' },
    { label: 'Clientes Activos',   value: data.activeClients, icon: '✅', accent: '#059669', iconBg: '#d1fae5',              border: '#059669' },
    { label: 'Vidas Aseguradas',   value: data.totalLives,    icon: '👥', accent: 'var(--brand-800)', iconBg: 'rgba(var(--brand-800-rgb), .10)',   border: 'var(--brand-800)' },
    { label: 'Con Wash. National', value: data.withWN,        icon: '🛡', accent: 'var(--accent)', iconBg: 'rgba(var(--accent-rgb), .15)',border: 'var(--accent)' },
  ]

  return (
    <div className="space-y-7 animate-fade-in">
      {/* Page header */}
      <div className="flex items-start justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-xl font-bold lg:text-2xl" style={{ color: 'var(--gray-900)' }}>{greeting} 👋</h1>
          <p className="text-sm mt-0.5" style={{ color: 'var(--gray-500)' }}>Resumen de tu cartera</p>
        </div>
        <div className="flex gap-2">
          <Link href="/today"
            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-sm font-semibold text-white transition-all hover:opacity-90 active:scale-95"
            style={{ background: 'linear-gradient(135deg, var(--brand-800), var(--brand-500))', boxShadow: '0 2px 12px rgba(var(--brand-800-rgb), .30)' }}>
            📋 <span className="hidden sm:inline">¿Qué hacer </span>Hoy
            {todayItems > 0 && (
              <span className="w-5 h-5 rounded-full flex items-center justify-center text-xs font-bold"
                style={{ background: 'rgba(255,255,255,.25)' }}>{todayItems}</span>
            )}
          </Link>
        </div>
      </div>

      {/* Frase motivadora */}
      <div className="flex items-center gap-3 px-5 py-3.5 rounded-xl"
        style={{ background: 'linear-gradient(135deg, rgba(var(--brand-800-rgb), .08), rgba(var(--brand-500-rgb), .08))', border: '1px solid rgba(var(--brand-500-rgb), .18)' }}>
        <div className="text-xl shrink-0">✨</div>
        <p className="text-sm italic font-medium" style={{ color: 'var(--gray-700, #334155)' }}>&ldquo;{motivationalQuote}&rdquo;</p>
      </div>

      {/* AEP Banner */}
      {aep.isActive ? (
        <div className="flex items-center gap-4 px-5 py-4 rounded-xl"
          style={{ background: 'linear-gradient(135deg, #f0fdf4, #dcfce7)', border: '1px solid #a7f3d0' }}>
          <div className="w-10 h-10 rounded-lg flex items-center justify-center shrink-0 text-xl" style={{ background: '#d1fae5' }}>🟢</div>
          <div className="flex-1">
            <p className="font-bold text-sm" style={{ color: '#065f46' }}>AEP ACTIVO — {aep.daysUntilEnd} días para inscribir</p>
            <p className="text-xs mt-0.5" style={{ color: '#047857' }}>Período abierto hasta el {aep.activeEnd.toLocaleDateString('es-US', { month: 'long', day: 'numeric', year: 'numeric' })}</p>
          </div>
          <div className="px-3 py-1 rounded-full text-xs font-semibold shrink-0" style={{ background: '#a7f3d0', color: '#065f46' }}>En curso</div>
        </div>
      ) : (
        <div className="flex items-center gap-4 px-5 py-4 rounded-xl"
          style={{ background: 'linear-gradient(135deg, #fffbeb, #fef3c7)', border: '1px solid #fde68a' }}>
          <div className="w-10 h-10 rounded-lg flex items-center justify-center shrink-0 text-xl" style={{ background: '#fef3c7' }}>🗓️</div>
          <div className="flex-1">
            <p className="font-bold text-sm" style={{ color: '#78350f' }}>Próximo AEP: 15 de noviembre {aep.nextStart.getFullYear()}</p>
            <p className="text-xs mt-0.5" style={{ color: '#92400e' }}>Faltan <strong>{aep.daysUntilStart} días</strong> · SEP disponible todo el año para eventos calificativos</p>
          </div>
          <div className="text-2xl font-bold shrink-0" style={{ color: 'var(--warning)' }}>{aep.daysUntilStart}d</div>
        </div>
      )}

      {/* Respaldo automático caído. Va arriba del todo: si se pierden los datos
          no hay nada más que hacer, así que es lo más urgente del panel. */}
      {data.backup?.alarm && (
        <div className="px-5 py-4 rounded-xl" style={{ background: 'linear-gradient(135deg, #fef2f2, #fee2e2)', border: '1px solid #fecaca' }}>
          <div className="flex items-start gap-4">
            <div className="w-10 h-10 rounded-lg flex items-center justify-center shrink-0 text-xl" style={{ background: '#fee2e2' }}>💾</div>
            <div className="flex-1">
              <p className="font-bold text-sm" style={{ color: '#991b1b' }}>
                Tus datos NO se están respaldando en Google Drive
              </p>
              <p className="text-xs mt-1" style={{ color: '#b91c1c' }}>{data.backup.message}</p>
              <Link href="/settings"
                className="inline-block text-xs font-semibold px-3 py-1.5 rounded-lg text-white mt-2.5"
                style={{ background: '#dc2626' }}>
                Arreglar el respaldo →
              </Link>
            </div>
          </div>
        </div>
      )}

      {/* Cambio de elegibilidad del subsidio — 01/01/2027 */}
      {(!!data.losesSubsidyCount || !!data.missingMigrationCount) && (
        <div className="px-5 py-4 rounded-xl" style={{ background: 'linear-gradient(135deg, #fef2f2, #fee2e2)', border: '1px solid #fecaca' }}>
          <div className="flex items-start gap-4">
            <div className="w-10 h-10 rounded-lg flex items-center justify-center shrink-0 text-xl" style={{ background: '#fee2e2' }}>🚫</div>
            <div className="flex-1">
              <p className="font-bold text-sm" style={{ color: '#991b1b' }}>
                Cambio de subsidio ACA · 1 de enero de 2027 {daysUntilRule() > 0 && `· faltan ${daysUntilRule()} días`}
              </p>
              <p className="text-xs mt-1" style={{ color: '#b91c1c' }}>
                Solo ciudadanos y residentes permanentes seguirán recibiendo el crédito fiscal; los demás podrán inscribirse pero pagarán precio completo.
              </p>
              <div className="flex flex-wrap gap-2 mt-2.5">
                {!!data.losesSubsidyCount && (
                  <>
                    <Link href="/campanas"
                      className="text-xs font-semibold px-3 py-1.5 rounded-lg text-white"
                      style={{ background: '#dc2626' }}>
                      {data.losesSubsidyCount} cliente(s) perderán el subsidio → avisarles
                    </Link>
                    <button onClick={tagAffected} disabled={tagging}
                      className="text-xs font-semibold px-3 py-1.5 rounded-lg border disabled:opacity-50"
                      style={{ color: '#991b1b', borderColor: '#fecaca', background: '#fff' }}>
                      {tagging ? 'Etiquetando...' : '🏷️ Etiquetar a los afectados'}
                    </button>
                  </>
                )}
                {!!data.missingMigrationCount && (
                  <Link href="/clients"
                    className="text-xs font-semibold px-3 py-1.5 rounded-lg border"
                    style={{ color: '#92400e', borderColor: '#fde68a', background: '#fef9c3' }}>
                    {data.missingMigrationCount} sin estatus migratorio → completar
                  </Link>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* KPI Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {kpis.map(card => (
          <div key={card.label} style={{ ...CARD, borderTop: `3px solid ${card.accent}`, padding: '20px' }}>
            <div className="flex items-start justify-between">
              <div>
                <div className="text-3xl font-extrabold leading-none" style={{ color: '#0f172a' }}>{card.value}</div>
                <div className="text-xs font-medium mt-1.5" style={{ color: '#64748b' }}>{card.label}</div>
              </div>
              <div className="w-10 h-10 rounded-xl flex items-center justify-center text-lg shrink-0" style={{ background: card.iconBg }}>{card.icon}</div>
            </div>
          </div>
        ))}
      </div>

      {/* Goals Progress */}
      {goals && goalsProgress && (
        <div style={{ ...CARD, borderTop: '3px solid var(--brand-500)' }}>
          <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
            <h2 className="font-semibold text-sm" style={{ color: '#0f172a' }}>🎯 Progreso del Mes</h2>
            <a href="/settings" className="text-xs" style={{ color: 'var(--brand-500)' }}>Editar objetivos →</a>
          </div>
          <div className="space-y-4">
            <GoalBar label="Nuevos clientes este mes" current={goalsProgress.newClients} target={goals.newClientsMonthly} />
            <GoalBar label="Ingresos mensuales (total activos)" current={goalsProgress.revenue} target={goals.revenueMonthly} prefix="$" />
            <GoalBar label="Clientes WN este mes" current={goalsProgress.wnClients} target={goals.wnClientsMonthly} />
          </div>
        </div>
      )}

      {/* New clients this month */}
      {data.newClientsThisMonth && (
        <div style={CARD}>
          <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
            <div>
              <h2 className="font-semibold text-sm" style={{ color: '#0f172a' }}>🆕 Clientes Nuevos este Mes</h2>
              <p className="text-xs mt-0.5" style={{ color: '#64748b' }}>
                {new Date().toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}
              </p>
            </div>
            <div className="flex items-center gap-3">
              <div className="text-center">
                <div className="text-2xl font-extrabold" style={{ color: '#10253f' }}>{data.newClientsThisMonth.length}</div>
                <div className="text-xs" style={{ color: '#64748b' }}>clientes</div>
              </div>
              {data.newClientsThisMonth.length > 0 && (
                <div className="text-center">
                  <div className="text-2xl font-extrabold" style={{ color: '#059669' }}>
                    {new Intl.NumberFormat('en-US',{style:'currency',currency:'USD',maximumFractionDigits:0}).format(
                      data.newClientsThisMonth.reduce((s,c) => s + (c.totalMonthly || 0), 0)
                    )}
                  </div>
                  <div className="text-xs" style={{ color: '#64748b' }}>prima/mes añadida</div>
                </div>
              )}
            </div>
          </div>

          {data.newClientsThisMonth.length === 0 ? (
            <p className="text-sm text-center py-4" style={{ color: '#94a3b8' }}>Sin clientes nuevos este mes todavía</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr style={{ borderBottom: '1px solid #f1f5f9' }}>
                    {['Cliente', 'Aseguradora', 'Plan', 'Total/mes', 'Contratación'].map(h => (
                      <th key={h} className="text-left pb-2 pr-4 text-xs font-semibold uppercase tracking-wide" style={{ color: '#94a3b8' }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {data.newClientsThisMonth.map((c, i) => {
                    const catColor: Record<string,string> = { Gold:'#b45309', Silver:'#64748b', Bronze:'#c2410c', Platinum:'#1d4ed8' }
                    const catBg: Record<string,string> = { Gold:'#fef3c7', Silver:'#f1f5f9', Bronze:'#ffedd5', Platinum:'#dbeafe' }
                    return (
                      <tr key={c.id} style={{ borderBottom: i < data.newClientsThisMonth.length - 1 ? '1px solid #f8fafc' : 'none' }}>
                        <td className="py-2 pr-4">
                          <Link href={`/clients/${c.id}`} className="font-semibold hover:underline" style={{ color: '#10253f' }}>{c.fullName}</Link>
                        </td>
                        <td className="py-2 pr-4 text-sm" style={{ color: '#475569' }}>{c.insurer || '—'}</td>
                        <td className="py-2 pr-4">
                          {c.planCategory ? (
                            <span className="px-2 py-0.5 rounded-full text-xs font-bold"
                              style={{ background: catBg[c.planCategory] || '#f1f5f9', color: catColor[c.planCategory] || '#64748b' }}>
                              {c.planCategory}
                            </span>
                          ) : '—'}
                        </td>
                        <td className="py-2 pr-4 font-semibold" style={{ color: '#059669' }}>
                          {c.totalMonthly ? `$${c.totalMonthly.toFixed(2)}` : '—'}
                        </td>
                        <td className="py-2 text-xs" style={{ color: '#64748b' }}>
                          {c.contractDate ? new Date(c.contractDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) : '—'}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* Renewals + Birthdays */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        <div className="lg:col-span-2" style={CARD}>
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-semibold text-sm" style={{ color: 'var(--gray-900)' }}>Próximas Renovaciones</h2>
            <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold" style={{ background: 'var(--warning-bg)', color: 'var(--warning)' }}>60 días</span>
          </div>
          {data.upcomingRenewals.length === 0 ? (
            <p className="text-sm" style={{ color: 'var(--gray-400)' }}>Sin renovaciones próximas</p>
          ) : (
            <div className="space-y-1.5">
              {data.upcomingRenewals.map(r => (
                <Link href={`/clients/${r.id}`} key={r.id}
                  className="flex items-center justify-between px-3 py-2.5 rounded-lg transition-colors hover:bg-gray-50"
                  style={{ border: '1px solid var(--border)' }}>
                  <div>
                    <div className="text-sm font-medium" style={{ color: 'var(--gray-900)' }}>{r.fullName}</div>
                    <div className="text-xs mt-0.5" style={{ color: 'var(--gray-500)' }}>{r.insurer} · {formatDate(r.renewalDate)}</div>
                  </div>
                  <span className="text-xs font-semibold px-2.5 py-1 rounded-full"
                    style={r.daysUntil <= 7
                      ? { background: 'var(--danger-bg)', color: 'var(--danger)' }
                      : r.daysUntil <= 30
                        ? { background: 'var(--warning-bg)', color: 'var(--warning)' }
                        : { background: 'var(--success-bg)', color: 'var(--success)' }}>
                    {r.daysUntil === 0 ? 'Hoy' : `${r.daysUntil}d`}
                  </span>
                </Link>
              ))}
            </div>
          )}
        </div>

        <div style={CARD}>
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-semibold text-sm" style={{ color: '#0f172a' }}>🎂 Cumpleaños</h2>
            <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold" style={{ background: '#fce7f3', color: '#be185d' }}>30 días</span>
          </div>
          {data.upcomingBirthdays.length === 0 ? (
            <p className="text-sm" style={{ color: '#94a3b8' }}>Sin cumpleaños próximos</p>
          ) : (
            <div className="space-y-2">
              {data.upcomingBirthdays.map((b, i) => {
                const isToday = b.daysUntil === 0
                const waMsg = birthdayTemplate
                  .replace(/\{nombre\}/g, b.name.split(' ')[0])
                  .replace(/\{agente\}/g, agentName)
                const digits = (b.phone || '').replace(/\D/g, '')
                const intl = digits.length === 10 ? `1${digits}` : digits
                const waUrl = intl ? `https://wa.me/${intl}?text=${encodeURIComponent(waMsg)}` : ''
                return (
                  <div key={i}
                    className="flex items-center justify-between px-3 py-2.5 rounded-xl transition-colors"
                    style={{
                      background: isToday ? '#fff0f6' : '#f8fafc',
                      border: `1.5px solid ${isToday ? '#f9a8d4' : '#e2e8f0'}`,
                    }}>
                    <div className="flex-1 min-w-0">
                      <Link href={`/clients/${b.id}`}
                        className="text-sm font-semibold hover:underline block truncate"
                        style={{ color: isToday ? '#be185d' : '#0f172a' }}>
                        {isToday && '🎉 '}{b.name}
                      </Link>
                      <div className="text-xs mt-0.5" style={{ color: '#94a3b8' }}>
                        {formatDate(b.birthDate)}
                        {isToday && <span className="ml-2 font-bold" style={{ color: '#be185d' }}>¡Hoy!</span>}
                        {!isToday && <span className="ml-1">· en {b.daysUntil}d</span>}
                      </div>
                    </div>
                    {waUrl && (
                      <a href={waUrl} target="_blank" rel="noopener noreferrer"
                        title="Enviar felicitación por WhatsApp"
                        className="shrink-0 ml-2 flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-semibold text-white transition-all hover:opacity-90"
                        style={{ background: '#25d366' }}>
                        💬 {isToday ? '¡Felicitar!' : 'WA'}
                      </a>
                    )}
                  </div>
                )
              })}
            </div>
          )}
        </div>
      </div>

      {/* Pending First Payment */}
      {data.pendingFirstPayment && data.pendingFirstPayment.length > 0 && (
        <div style={{ ...CARD, borderLeft: '3px solid var(--warning)' }}>
          <div className="flex items-center gap-2.5 mb-3">
            <h2 className="font-semibold text-sm" style={{ color: 'var(--gray-900)' }}>Primer Pago Pendiente</h2>
            <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold" style={{ background: 'var(--warning-bg)', color: 'var(--warning)' }}>
              {data.pendingFirstPayment.length}
            </span>
          </div>
          <div className="space-y-1.5">
            {data.pendingFirstPayment.map(c => (
              <Link href={`/clients/${c.id}`} key={c.id}
                className="flex items-center justify-between px-3 py-2.5 rounded-lg transition-colors"
                style={{ border: '1px solid #fde68a', background: '#fffbeb' }}>
                <div>
                  <div className="text-sm font-medium" style={{ color: 'var(--gray-900)' }}>{c.fullName}</div>
                  <div className="text-xs mt-0.5" style={{ color: 'var(--gray-500)' }}>{c.insurer} · Contratado: {formatDate(c.contractDate as unknown as string)}</div>
                </div>
                <span className="text-xs font-semibold px-2.5 py-1 rounded-full"
                  style={c.daysElapsed > 30
                    ? { background: 'var(--danger-bg)', color: 'var(--danger)' }
                    : { background: 'var(--warning-bg)', color: 'var(--warning)' }}>
                  {c.daysElapsed > 30 ? 'Vencido' : `${c.daysElapsed}d`}
                </span>
              </Link>
            ))}
          </div>
        </div>
      )}

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
        {[
          { title: 'Vidas por Aseguradora', data: data.byInsurer },
          { title: 'Por Estado',            data: data.byState },
          { title: 'Tipo de Cobertura',     data: data.byCoverage },
        ].map(panel => (
          <div key={panel.title} style={CARD}>
            <h3 className="font-semibold text-sm mb-4" style={{ color: 'var(--gray-900)' }}>{panel.title}</h3>
            <div className="space-y-2.5">
              {Object.entries(panel.data).sort((a, b) => b[1] - a[1]).map(([name, count]) => {
                const maxVal = Math.max(...Object.values(panel.data))
                const pct = maxVal > 0 ? (count / maxVal) * 100 : 0
                return (
                  <div key={name}>
                    <div className="flex items-center justify-between text-xs mb-1">
                      <span style={{ color: 'var(--gray-700)' }}>{name}</span>
                      <span className="font-semibold" style={{ color: 'var(--gray-900)' }}>{count}</span>
                    </div>
                    <div className="h-1.5 rounded-full overflow-hidden" style={{ background: 'var(--gray-100)' }}>
                      <div className="h-full rounded-full" style={{ width: `${pct}%`, background: 'var(--brand-400)' }} />
                    </div>
                  </div>
                )
              })}
              {Object.keys(panel.data).length === 0 && <p className="text-xs" style={{ color: 'var(--gray-400)' }}>Sin datos</p>}
            </div>
          </div>
        ))}
      </div>

      {/* Google Review Funnel */}
      <div style={CARD}>
        <div className="flex items-center justify-between mb-5 flex-wrap gap-3">
          <div>
            <h2 className="font-semibold text-sm" style={{ color: 'var(--gray-900)' }}>Google Reviews</h2>
            <p className="text-xs mt-0.5" style={{ color: 'var(--gray-500)' }}>
              <span className="font-semibold" style={{ color: 'var(--success)' }}>
                {data.reviewByStage?.find(s => s.stage === 'Realizada')?.count ?? 0} realizadas
              </span>
              {' · '}
              <span className="font-semibold" style={{ color: 'var(--warning)' }}>
                {data.reviewsPending} pendientes
              </span>
            </p>
          </div>
          <a href={REVIEW_LINK} target="_blank" rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-xs font-semibold text-white transition-all hover:opacity-90"
            style={{ background: 'var(--brand-500)' }}>
            🔗 Ver perfil Google
          </a>
        </div>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          {(data.reviewByStage ?? []).map(s => (
            <ReviewStageCard key={s.stage} stage={s.stage} count={s.count} clients={s.clients} />
          ))}
        </div>
        {data.totalPolicies > 0 && (
          <div className="mt-5 pt-4" style={{ borderTop: '1px solid var(--border)' }}>
            <div className="flex items-center justify-between text-xs mb-2" style={{ color: 'var(--gray-500)' }}>
              <span>Progreso hacia 100% realizadas</span>
              <span className="font-bold" style={{ color: 'var(--gray-900)' }}>
                {Math.round(((data.reviewByStage?.find(s => s.stage === 'Realizada')?.count ?? 0) / data.totalPolicies) * 100)}%
              </span>
            </div>
            <div className="h-2 rounded-full overflow-hidden" style={{ background: 'var(--gray-100)' }}>
              <div className="h-full rounded-full transition-all"
                style={{
                  width: `${Math.round(((data.reviewByStage?.find(s => s.stage === 'Realizada')?.count ?? 0) / data.totalPolicies) * 100)}%`,
                  background: 'linear-gradient(90deg, var(--success), var(--teal-400))',
                }} />
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
