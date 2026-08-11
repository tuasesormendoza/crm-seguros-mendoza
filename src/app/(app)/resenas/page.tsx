'use client'

// Reseñas de Google: quién ya la dejó, quién falta y en qué punto está cada uno.
// El dato ya vivía en la ficha de cada cliente; aquí se trabaja en conjunto.

import { useEffect, useState, useCallback, useMemo } from 'react'
import Link from 'next/link'
import {
  REVIEW_STAGES, DONE_STAGE, stageOf, stageMeta, countByStage, completionPct,
  messageFor, whatsappLink,
} from '@/lib/googleReview'

interface Row {
  id: string
  fullName: string
  phone: string | null
  email: string | null
  googleReview: string | null
  status: string | null
  contractDate: string | null
}

// Si la agencia aún no escribió sus plantillas, se usan estas para que el botón
// de WhatsApp funcione desde el primer día.
const FALLBACK_FIRST = 'Hola {nombre}, fue un placer atenderte. Te agradecería mucho si pudieras dejarnos una reseña en Google, solo toma 1 minuto 🙏: {link}'
const FALLBACK_REMINDER = 'Hola {nombre}, quería recordarte que nos encantaría contar con tu reseña en Google: {link} ¡Gracias!'

const SEL = 'border border-gray-300 rounded-lg px-2 py-1 text-xs focus:outline-none focus:ring-2 focus:ring-[#507b88]'

export default function ResenasPage() {
  const [rows, setRows] = useState<Row[]>([])
  const [link, setLink] = useState('')
  const [tplFirst, setTplFirst] = useState('')
  const [tplReminder, setTplReminder] = useState('')
  const [agentName, setAgentName] = useState('')
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [filter, setFilter] = useState<string | null>(null)
  const [hideCancelled, setHideCancelled] = useState(true)
  const [saving, setSaving] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const d = await (await fetch('/api/reviews')).json()
      setRows(Array.isArray(d.clients) ? d.clients : [])
      setLink(d.link || '')
      setTplFirst(d.template || FALLBACK_FIRST)
      setTplReminder(d.reminder || FALLBACK_REMINDER)
      setAgentName(d.agentName || '')
    } catch { /* la lista queda vacía */ }
    setLoading(false)
  }, [])

  useEffect(() => { load() }, [load])

  // Los cancelados no deberían contar: pedirle una reseña a alguien que se fue
  // es justo lo que trae una reseña mala.
  const pool = useMemo(
    () => hideCancelled ? rows.filter(r => r.status !== 'Cancelado') : rows,
    [rows, hideCancelled],
  )

  const counts = useMemo(() => countByStage(pool), [pool])
  const pct = useMemo(() => completionPct(pool), [pool])

  const visible = useMemo(() => {
    const q = search.trim().toLowerCase()
    return pool.filter(r => {
      if (filter && stageOf(r.googleReview) !== filter) return false
      if (!q) return true
      return r.fullName.toLowerCase().includes(q) || (r.phone || '').includes(q)
    })
  }, [pool, filter, search])

  async function setStage(row: Row, stage: string) {
    const before = row.googleReview
    setSaving(row.id)
    // Se pinta el cambio de inmediato y se revierte si el servidor lo rechaza.
    setRows(rs => rs.map(r => r.id === row.id ? { ...r, googleReview: stage } : r))
    try {
      const res = await fetch(`/api/clients/${row.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ googleReview: stage }),
      })
      if (!res.ok) throw new Error()
    } catch {
      setRows(rs => rs.map(r => r.id === row.id ? { ...r, googleReview: before } : r))
      alert('No se pudo guardar el cambio. Intenta de nuevo.')
    }
    setSaving(null)
  }

  // Al mandar el WhatsApp se avanza la etapa solo: pendiente → enviada.
  function onSend(row: Row) {
    if (stageOf(row.googleReview) === REVIEW_STAGES[0].key) setStage(row, 'Enviada')
  }

  function copyLink() {
    navigator.clipboard.writeText(link).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    }).catch(() => {})
  }

  return (
    <div className="max-w-5xl mx-auto space-y-5">
      {/* Encabezado + progreso */}
      <div className="flex items-start justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold" style={{ color: '#10253f' }}>⭐ Reseñas de Google</h1>
          <p className="text-sm text-gray-500 mt-0.5">
            {counts[DONE_STAGE]} de {pool.length} cliente(s) ya dejaron su reseña
          </p>
        </div>
        {link && (
          <button onClick={copyLink}
            className="text-xs font-semibold px-3 py-2 rounded-lg border"
            style={{ color: '#0369a1', borderColor: '#bae6fd', background: '#f0f9ff' }}>
            {copied ? '✅ Copiado' : '🔗 Copiar enlace de reseña'}
          </button>
        )}
      </div>

      <div className="bg-white rounded-xl border border-gray-200 p-4">
        <div className="flex items-center justify-between text-xs mb-1.5">
          <span className="text-gray-600 font-medium">Progreso</span>
          <span className="font-bold" style={{ color: pct >= 50 ? '#059669' : pct >= 25 ? '#d97706' : '#64748b' }}>{pct}%</span>
        </div>
        <div className="h-2.5 rounded-full overflow-hidden" style={{ background: '#f1f5f9' }}>
          <div className="h-full rounded-full transition-all"
            style={{ width: `${pct}%`, background: 'linear-gradient(90deg, #34d399, #059669)' }} />
        </div>
      </div>

      {!link && (
        <div className="px-4 py-3 rounded-xl text-sm" style={{ background: '#fffbeb', border: '1px solid #fde68a', color: '#92400e' }}>
          ⚠️ Aún no has puesto tu enlace de reseña de Google. Ve a <strong>Configuración → Mensajería</strong> y agrégalo para poder enviarlo por WhatsApp.
        </div>
      )}

      {/* Etapas — se pulsan para filtrar */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {REVIEW_STAGES.map(s => {
          const active = filter === s.key
          return (
            <button key={s.key} onClick={() => setFilter(active ? null : s.key)}
              title={s.desc}
              className="p-3 rounded-xl text-left transition-all"
              style={{
                background: s.bg,
                border: `${active ? 2 : 1}px solid ${active ? s.color : s.border}`,
              }}>
              <div className="text-xs font-semibold uppercase tracking-wide" style={{ color: s.color }}>
                {s.icon} {s.short}
              </div>
              <div className="text-2xl font-bold mt-1" style={{ color: s.color, lineHeight: 1 }}>{counts[s.key]}</div>
            </button>
          )
        })}
      </div>

      {/* Buscador */}
      <div className="flex flex-col sm:flex-row gap-3">
        <input value={search} onChange={e => setSearch(e.target.value)}
          placeholder="Buscar por nombre o teléfono..."
          className="flex-1 border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#507b88]" />
        <label className="flex items-center gap-2 text-xs text-gray-600 whitespace-nowrap">
          <input type="checkbox" checked={hideCancelled} onChange={e => setHideCancelled(e.target.checked)} />
          Ocultar cancelados
        </label>
      </div>

      {filter && (
        <button onClick={() => setFilter(null)} className="text-xs text-gray-500 underline">
          Quitar filtro &quot;{stageMeta(filter).short}&quot;
        </button>
      )}

      {/* Lista */}
      {loading ? (
        <div className="text-center py-10 text-gray-400">Cargando...</div>
      ) : visible.length === 0 ? (
        <div className="text-center py-16 bg-white rounded-2xl border border-gray-200">
          <div className="text-4xl mb-2">⭐</div>
          <p className="text-gray-500 font-medium">
            {rows.length === 0 ? 'Aún no tienes clientes' : 'Ningún cliente en este filtro'}
          </p>
        </div>
      ) : (
        <div className="space-y-2">
          {visible.map(r => {
            const meta = stageMeta(r.googleReview)
            const msg = messageFor(stageOf(r.googleReview), { first: tplFirst, reminder: tplReminder }, {
              nombre: r.fullName.split(' ')[0], link, agente: agentName,
            })
            const wa = link ? whatsappLink(r.phone, msg) : ''
            return (
              <div key={r.id} className="bg-white rounded-xl border border-gray-200 p-3 sm:p-4">
                <div className="flex items-start justify-between gap-3 flex-wrap">
                  <div className="min-w-0">
                    <Link href={`/clients/${r.id}`} className="font-semibold text-gray-900 hover:underline">
                      {r.fullName}
                    </Link>
                    {r.status === 'Cancelado' && (
                      <span className="ml-2 text-xs px-1.5 py-0.5 rounded-full" style={{ background: '#fee2e2', color: '#991b1b' }}>
                        Cancelado
                      </span>
                    )}
                    {r.phone && <div className="text-xs text-gray-500 mt-0.5">📞 {r.phone}</div>}
                  </div>
                  <span className="text-xs font-semibold px-2 py-1 rounded-full shrink-0"
                    style={{ background: meta.bg, color: meta.color, border: `1px solid ${meta.border}` }}>
                    {meta.icon} {meta.short}
                  </span>
                </div>

                <div className="flex items-center gap-2 mt-3 flex-wrap">
                  <select value={stageOf(r.googleReview)} disabled={saving === r.id}
                    onChange={e => setStage(r, e.target.value)} className={SEL}>
                    {REVIEW_STAGES.map(s => <option key={s.key} value={s.key}>{s.icon} {s.key}</option>)}
                  </select>

                  {wa ? (
                    <a href={wa} target="_blank" rel="noopener noreferrer" onClick={() => onSend(r)}
                      className="text-xs font-semibold px-2.5 py-1.5 rounded-lg text-white" style={{ background: '#25d366' }}>
                      💬 {stageOf(r.googleReview) === REVIEW_STAGES[0].key ? 'Pedir reseña' : 'Recordar'}
                    </a>
                  ) : stageOf(r.googleReview) === DONE_STAGE ? (
                    <span className="text-xs" style={{ color: '#059669' }}>Ya la dejó — no hace falta insistir</span>
                  ) : !r.phone ? (
                    <span className="text-xs text-gray-400">Sin teléfono para enviar</span>
                  ) : null}
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
