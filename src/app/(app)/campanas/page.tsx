'use client'

// Campañas — envío masivo por email a un segmento de clientes.

import { useEffect, useState, useCallback } from 'react'
import { useRole } from '@/hooks/useRole'
import AccessDenied from '@/components/AccessDenied'

interface Recipients { total: number; withEmail: number; withPhone: number; recipients: { id: string; fullName: string; email: string | null; phone: string | null }[] }

const STATUSES = ['Activo', 'Pendiente', 'Cancelado', 'Con otro agente']
const SPECIAL = [
  { key: '', label: 'Ninguno (todo el segmento)' },
  { key: 'dental', label: 'Solo los que NO tienen plan dental' },
  { key: 'wn', label: 'Solo los que NO tienen seguro suplementario' },
]

const INPUT = 'w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#507b88] bg-white'
const LABEL = 'block text-xs font-semibold text-gray-600 mb-1'

export default function CampanasPage() {
  const role = useRole()

  const [states, setStates] = useState<string[]>([])
  const [segment, setSegment] = useState({ status: 'Activo', state: '', missing: '' })
  const [preview, setPreview] = useState<Recipients | null>(null)
  const [subject, setSubject] = useState('')
  const [message, setMessage] = useState('')
  const [sending, setSending] = useState(false)
  const [result, setResult] = useState<string | null>(null)
  const [waLinks, setWaLinks] = useState<{ name: string; url: string }[] | null>(null)

  useEffect(() => {
    fetch('/api/clients?paginated=1&pageSize=1')
      .then(r => r.json())
      .then(d => setStates(Array.isArray(d.states) ? d.states : []))
      .catch(() => {})
  }, [])

  const loadPreview = useCallback(() => {
    const params = new URLSearchParams()
    if (segment.status) params.set('status', segment.status)
    if (segment.state) params.set('state', segment.state)
    if (segment.missing) params.set('missing', segment.missing)
    fetch(`/api/campaigns/recipients?${params}`)
      .then(r => r.json())
      .then(setPreview)
      .catch(() => setPreview(null))
  }, [segment])

  useEffect(() => { loadPreview() }, [loadPreview])

  async function send() {
    if (!subject.trim() || !message.trim()) { setResult('❌ Escribe el asunto y el mensaje.'); return }
    if (!preview || preview.withEmail === 0) { setResult('❌ Ningún cliente del segmento tiene email.'); return }
    if (!confirm(`¿Enviar esta campaña por email a ${preview.withEmail} cliente(s)?`)) return
    setSending(true)
    setResult(null)
    try {
      const res = await fetch('/api/campaigns/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ subject, message, segment }),
      })
      const data = await res.json()
      if (!res.ok) { setResult(`❌ ${data.error || 'Error al enviar'}`); }
      else {
        let msg = `✅ Enviados: ${data.sent}`
        if (data.failed) msg += ` · Fallidos: ${data.failed}`
        if (data.limitados) msg += ` · ${data.limitados} quedaron para una próxima tanda (máx. ${data.maxPorEnvio} por envío)`
        setResult(msg)
      }
    } catch {
      setResult('❌ No se pudo conectar con el servidor.')
    }
    setSending(false)
  }

  function generateWhatsApp() {
    if (!preview) return
    const links = preview.recipients
      .filter(r => r.phone && r.phone.trim())
      .map(r => {
        const digits = r.phone!.replace(/\D/g, '')
        const intl = digits.length === 10 ? `1${digits}` : digits
        const msg = message.replace(/\{nombre\}/g, r.fullName.split(' ')[0])
        return { name: r.fullName, url: `https://wa.me/${intl}?text=${encodeURIComponent(msg)}` }
      })
    setWaLinks(links)
  }

  if (role === null) return <div className="text-center text-gray-400 mt-20">Cargando...</div>
  if (role === 'assistant') return <AccessDenied />

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold" style={{ color: '#10253f' }}>📣 Campañas</h1>
        <p className="text-sm text-gray-500 mt-1">Envía un mensaje a un segmento de tus clientes (avisos de inscripción, educación en salud, ofertas).</p>
      </div>

      {/* Segmento */}
      <div className="bg-white rounded-xl border border-gray-200 p-4 md:p-6 space-y-4">
        <h2 className="font-bold text-base" style={{ color: '#10253f' }}>1. ¿A quién?</h2>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div>
            <label className={LABEL}>Estatus</label>
            <select className={INPUT} value={segment.status} onChange={e => setSegment(s => ({ ...s, status: e.target.value }))}>
              <option value="">Todos</option>
              {STATUSES.map(s => <option key={s} value={s}>{s}</option>)}
            </select>
          </div>
          <div>
            <label className={LABEL}>Estado</label>
            <select className={INPUT} value={segment.state} onChange={e => setSegment(s => ({ ...s, state: e.target.value }))}>
              <option value="">Todos</option>
              {states.map(s => <option key={s} value={s}>{s}</option>)}
            </select>
          </div>
          <div>
            <label className={LABEL}>Filtro especial</label>
            <select className={INPUT} value={segment.missing} onChange={e => setSegment(s => ({ ...s, missing: e.target.value }))}>
              {SPECIAL.map(s => <option key={s.key} value={s.key}>{s.label}</option>)}
            </select>
          </div>
        </div>
        {preview && (
          <div className="text-sm px-3 py-2 rounded-lg" style={{ background: '#f0f7fb', border: '1px solid #b8d4e8', color: '#1e4a6e' }}>
            <strong>{preview.total}</strong> cliente(s) en el segmento · <strong>{preview.withEmail}</strong> con email (recibirán) · <strong>{preview.withPhone}</strong> con teléfono (para WhatsApp)
            {preview.total > 0 && preview.withEmail < preview.total && (
              <span className="block text-xs text-gray-500 mt-0.5">{preview.total - preview.withEmail} sin email no recibirán el correo.</span>
            )}
          </div>
        )}
      </div>

      {/* Mensaje */}
      <div className="bg-white rounded-xl border border-gray-200 p-4 md:p-6 space-y-4">
        <h2 className="font-bold text-base" style={{ color: '#10253f' }}>2. El mensaje</h2>
        <div>
          <label className={LABEL}>Asunto (solo email)</label>
          <input className={INPUT} value={subject} onChange={e => setSubject(e.target.value)} placeholder="Ej. Ya viene la Inscripción Abierta 2027" />
        </div>
        <div>
          <label className={LABEL}>
            Mensaje
            <span className="ml-2 font-normal text-gray-400">Usa <code className="bg-gray-100 px-1 rounded">{'{nombre}'}</code> para personalizar</span>
          </label>
          <textarea className={INPUT} rows={6} value={message} onChange={e => setMessage(e.target.value)}
            placeholder={'Hola {nombre},\n\nQuiero recordarte que...'} />
        </div>
      </div>

      {/* Enviar */}
      <div className="bg-white rounded-xl border border-gray-200 p-4 md:p-6 space-y-3">
        <h2 className="font-bold text-base" style={{ color: '#10253f' }}>3. Enviar</h2>
        <div className="flex flex-wrap gap-2">
          <button onClick={send} disabled={sending || !preview?.withEmail}
            className="px-5 py-2 rounded-lg text-white font-semibold text-sm disabled:opacity-50"
            style={{ background: '#2a6496' }}>
            {sending ? 'Enviando...' : `📧 Enviar por email${preview ? ` (${Math.min(preview.withEmail, 60)})` : ''}`}
          </button>
          <button onClick={generateWhatsApp} disabled={!preview?.withPhone || !message.trim()}
            className="px-5 py-2 rounded-lg font-semibold text-sm text-white disabled:opacity-50"
            style={{ background: '#25d366' }}>
            💬 Generar enlaces de WhatsApp
          </button>
        </div>
        {result && (
          <div className="text-sm px-3 py-2 rounded-lg" style={{ background: result.startsWith('✅') ? '#f0fdf4' : '#fef2f2', color: result.startsWith('✅') ? '#065f46' : '#b91c1c', border: `1px solid ${result.startsWith('✅') ? '#a7f3d0' : '#fecaca'}` }}>
            {result}
          </div>
        )}
        <p className="text-xs text-gray-400">
          El email tiene un tope de 60 por envío (límite de Gmail y del servidor). Para listas más grandes, envía en tandas. Cada correo incluye una opción de baja.
        </p>
      </div>

      {/* Enlaces WhatsApp generados */}
      {waLinks && (
        <div className="bg-white rounded-xl border border-gray-200 p-4 md:p-6">
          <h2 className="font-bold text-base mb-1" style={{ color: '#10253f' }}>Enlaces de WhatsApp ({waLinks.length})</h2>
          <p className="text-xs text-gray-500 mb-3">WhatsApp no permite envío automático masivo. Abre cada chat con el mensaje ya escrito y solo presiona enviar.</p>
          {waLinks.length === 0 ? (
            <p className="text-sm text-gray-400">Ningún cliente del segmento tiene teléfono.</p>
          ) : (
            <div className="flex flex-col gap-2 max-h-96 overflow-y-auto">
              {waLinks.map((l, i) => (
                <a key={i} href={l.url} target="_blank" rel="noopener noreferrer"
                  className="flex items-center justify-between px-3 py-2 rounded-lg border border-gray-100 hover:bg-gray-50 text-sm">
                  <span style={{ color: '#10253f' }}>{l.name}</span>
                  <span className="text-xs font-semibold" style={{ color: '#25d366' }}>Abrir chat →</span>
                </a>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
