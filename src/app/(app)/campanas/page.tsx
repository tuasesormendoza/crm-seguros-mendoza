'use client'

// Campañas — envío masivo por email a un segmento de clientes (o a uno solo),
// con imágenes, historial, edición y reenvío.

import { useEffect, useState, useCallback } from 'react'
import { useRole } from '@/hooks/useRole'
import AccessDenied from '@/components/AccessDenied'
import { renderCampaignHtml, renderCampaignSubject, type CampaignImage, type CampaignBrand } from '@/lib/campaignRender'
import { formatDateTime } from '@/lib/utils'

// Plantillas listas: llenan asunto + mensaje + botón con un clic (luego editas).
const TEMPLATES: { icon: string; name: string; subject: string; message: string; buttonText?: string }[] = [
  {
    icon: '📅', name: 'Inscripción Abierta',
    subject: '¡Ya viene la Inscripción Abierta, {nombre}!',
    message: 'Hola {nombre},\n\nSe acerca el período de Inscripción Abierta y quiero ayudarte a revisar tu cobertura para el próximo año: comparar planes, tu crédito fiscal y asegurarnos de que sigas con el mejor precio.\n\nAgenda unos minutos conmigo y lo vemos juntos.',
    buttonText: 'Agendar mi cita',
  },
  {
    icon: '🔄', name: 'Renovación',
    subject: 'Es hora de renovar tu póliza, {nombre}',
    message: 'Hola {nombre},\n\nSe acerca la renovación de tu póliza. Quiero asegurarme de que sigas con la mejor cobertura y el mejor precio para tu familia.\n\nResponde este correo o escríbeme y lo revisamos sin compromiso.',
    buttonText: 'Quiero revisar mi póliza',
  },
  {
    icon: '🦷', name: 'Plan Dental',
    subject: '{nombre}, protege tu sonrisa desde $25/mes',
    message: 'Hola {nombre},\n\n¿Sabías que tu plan de salud no cubre limpiezas ni tratamientos dentales? Tengo opciones de plan dental desde $25 al mes que incluyen limpiezas, radiografías y más.\n\nTe preparo una cotización sin compromiso.',
    buttonText: 'Ver mi cotización dental',
  },
  {
    icon: '🎂', name: 'Cumpleaños',
    subject: '¡Feliz cumpleaños, {nombre}! 🎉',
    message: '¡Hola {nombre}!\n\nTodo mi equipo te desea un muy feliz cumpleaños. 🎂 Que este nuevo año te traiga salud y muchas bendiciones.\n\nGracias por confiar en nosotros para cuidar lo más importante: tu bienestar y el de tu familia.',
  },
  {
    icon: '⭐', name: 'Reseña Google',
    subject: '{nombre}, ¿nos regalas 1 minuto?',
    message: 'Hola {nombre},\n\nFue un placer ayudarte con tu seguro. Si quedaste contento con el servicio, una reseña en Google me ayudaría muchísimo a llegar a más familias como la tuya.\n\nSolo toma 1 minuto. ¡Gracias de corazón! 🙏',
    buttonText: 'Dejar mi reseña',
  },
  {
    icon: '👋', name: 'Bienvenida',
    subject: '¡Bienvenido/a, {nombre}!',
    message: 'Hola {nombre},\n\n¡Gracias por confiar en mí como tu agente de seguros! Estoy aquí para ayudarte en todo lo que necesites: dudas de tu póliza, citas médicas, reclamos o cualquier cambio.\n\nGuarda mi contacto y escríbeme cuando quieras. Estoy para servirte.',
  },
]

interface Recipients { total: number; withEmail: number; withPhone: number; recipients: { id: string; fullName: string; email: string | null; phone: string | null }[] }
interface CampaignRow {
  id: string; subject: string; message: string; segment: string
  sentAt: string | null; sentCount: number; failedCount: number; createdAt: string; hasImages: boolean
}
interface ClientOption { id: string; fullName: string }
interface Segment { status: string; state: string; missing: string; clientId: string }

const STATUSES = ['Activo', 'Pendiente', 'Cancelado', 'Con otro agente']
const SPECIAL = [
  { key: '', label: 'Ninguno (todo el segmento)' },
  { key: 'dental', label: 'Solo los que NO tienen plan dental' },
  { key: 'wn', label: 'Solo los que NO tienen seguro suplementario' },
]
const EMPTY_SEGMENT: Segment = { status: 'Activo', state: '', missing: '', clientId: '' }

const INPUT = 'w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#507b88] bg-white'
const LABEL = 'block text-xs font-semibold text-gray-600 mb-1'

export default function CampanasPage() {
  const role = useRole()

  const [states, setStates] = useState<string[]>([])
  const [segment, setSegment] = useState<Segment>(EMPTY_SEGMENT)
  const [preview, setPreview] = useState<Recipients | null>(null)
  const [subject, setSubject] = useState('')
  const [message, setMessage] = useState('')
  const [buttonText, setButtonText] = useState('')
  const [buttonUrl, setButtonUrl] = useState('')
  const [brand, setBrand] = useState<CampaignBrand>({ agencyName: 'tu agente de seguros' })
  const [images, setImages] = useState<CampaignImage[]>([])
  const [imgError, setImgError] = useState('')
  const [sending, setSending] = useState(false)
  const [result, setResult] = useState<string | null>(null)
  const [waLinks, setWaLinks] = useState<{ name: string; url: string }[] | null>(null)
  const [agentName, setAgentName] = useState('tu agente de seguros')
  const [showPreview, setShowPreview] = useState(false)

  // Historial + edición
  const [history, setHistory] = useState<CampaignRow[]>([])
  const [editingId, setEditingId] = useState<string | null>(null)
  const [savingDraft, setSavingDraft] = useState(false)

  // Cliente específico
  const [clients, setClients] = useState<ClientOption[]>([])
  const [clientSearch, setClientSearch] = useState('')
  const [selectedClient, setSelectedClient] = useState<ClientOption | null>(null)

  const loadHistory = useCallback(() => {
    fetch('/api/campaigns').then(r => r.json()).then(d => setHistory(Array.isArray(d) ? d : [])).catch(() => {})
  }, [])

  useEffect(() => {
    fetch('/api/clients?paginated=1&pageSize=1')
      .then(r => r.json())
      .then(d => setStates(Array.isArray(d.states) ? d.states : []))
      .catch(() => {})
    fetch('/api/settings').then(r => r.json()).then(s => {
      if (s.agentName) setAgentName(s.agentName)
      setBrand({
        agencyName: s.agentName || 'tu agente de seguros',
        logoUrl: s.logoUrl && s.agencyId ? `/api/logo/${s.agencyId}` : '',
        headerColor: s.themeBrand800 || '#0D2A4A',
        accentColor: s.themeAccent || '#2a6496',
        phone: s.agentPhone || '',
        whatsapp: s.agentWhatsApp || '',
        email: s.agentEmail || '',
      })
    }).catch(() => {})
    fetch('/api/clients')
      .then(r => r.json())
      .then((res: ClientOption[]) => setClients(Array.isArray(res) ? res.map(c => ({ id: c.id, fullName: c.fullName })) : []))
      .catch(() => {})
    loadHistory()
  }, [loadHistory])

  const loadPreview = useCallback(() => {
    const params = new URLSearchParams()
    if (segment.clientId) params.set('clientId', segment.clientId)
    else {
      if (segment.status) params.set('status', segment.status)
      if (segment.state) params.set('state', segment.state)
      if (segment.missing) params.set('missing', segment.missing)
    }
    fetch(`/api/campaigns/recipients?${params}`)
      .then(r => r.json())
      .then(setPreview)
      .catch(() => setPreview(null))
  }, [segment])

  useEffect(() => { loadPreview() }, [loadPreview])

  const clientMatches = clientSearch.trim().length >= 2 && !selectedClient
    ? clients.filter(c => c.fullName.toLowerCase().includes(clientSearch.toLowerCase())).slice(0, 8)
    : []

  function pickClient(c: ClientOption) {
    setSelectedClient(c)
    setClientSearch('')
    setSegment(s => ({ ...s, clientId: c.id }))
  }
  function clearClient() {
    setSelectedClient(null)
    setClientSearch('')
    setSegment(s => ({ ...s, clientId: '' }))
  }

  // ── Imágenes ────────────────────────────────────────────────────────────────
  function addImages(files: FileList | null) {
    if (!files) return
    setImgError('')
    const remaining = 3 - images.length
    Array.from(files).slice(0, remaining).forEach(file => {
      if (!file.type.startsWith('image/')) { setImgError('Solo se permiten imágenes.'); return }
      if (file.size > 1_500_000) { setImgError(`"${file.name}" pesa más de 1.5 MB.`); return }
      const reader = new FileReader()
      reader.onload = () => {
        setImages(prev => prev.length < 3 ? [...prev, { name: file.name, dataUrl: String(reader.result) }] : prev)
      }
      reader.readAsDataURL(file)
    })
  }

  // ── Enviar / guardar / editar ───────────────────────────────────────────────
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
        body: JSON.stringify({ subject, message, segment, images, buttonText, buttonUrl, campaignId: editingId }),
      })
      const data = await res.json()
      if (!res.ok) { setResult(`❌ ${data.error || 'Error al enviar'}`) }
      else {
        let msg = `✅ Enviados: ${data.sent}`
        if (data.failed) msg += ` · Fallidos: ${data.failed}`
        if (data.limitados) msg += ` · ${data.limitados} quedaron para una próxima tanda (máx. ${data.maxPorEnvio} por envío)`
        setResult(msg)
        setEditingId(data.campaignId || null)
        loadHistory()
      }
    } catch {
      setResult('❌ No se pudo conectar con el servidor.')
    }
    setSending(false)
  }

  async function saveDraft() {
    setSavingDraft(true)
    setResult(null)
    try {
      const payload = { subject, message, segment, images, buttonText, buttonUrl }
      const res = editingId
        ? await fetch(`/api/campaigns/${editingId}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) })
        : await fetch('/api/campaigns', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) })
      const data = await res.json()
      if (!res.ok) setResult(`❌ ${data.error || 'Error al guardar'}`)
      else {
        if (data.id) setEditingId(data.id)
        setResult('✅ Campaña guardada.')
        loadHistory()
      }
    } catch {
      setResult('❌ No se pudo guardar.')
    }
    setSavingDraft(false)
  }

  async function loadCampaign(id: string) {
    const res = await fetch(`/api/campaigns/${id}`)
    if (!res.ok) return
    const c = await res.json()
    setEditingId(c.id)
    setSubject(c.subject || '')
    setMessage(c.message || '')
    setButtonText(c.buttonText || '')
    setButtonUrl(c.buttonUrl || '')
    try {
      const seg = JSON.parse(c.segment || '{}')
      const next: Segment = { status: seg.status || '', state: seg.state || '', missing: seg.missing || '', clientId: seg.clientId || '' }
      setSegment(next)
      if (next.clientId) {
        const found = clients.find(cl => cl.id === next.clientId)
        setSelectedClient(found || { id: next.clientId, fullName: '(cliente del historial)' })
      } else {
        setSelectedClient(null)
      }
    } catch { /* segmento ilegible: se conserva el actual */ }
    try { setImages(c.images ? JSON.parse(c.images) : []) } catch { setImages([]) }
    setResult(null)
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  function newCampaign() {
    setEditingId(null)
    setSubject('')
    setMessage('')
    setButtonText('')
    setButtonUrl('')
    setImages([])
    setSegment(EMPTY_SEGMENT)
    setSelectedClient(null)
    setResult(null)
  }

  function applyTemplate(t: typeof TEMPLATES[number]) {
    setSubject(t.subject)
    setMessage(t.message)
    if (t.buttonText) setButtonText(t.buttonText)
    setResult(null)
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  async function deleteCampaign(id: string) {
    if (!confirm('¿Eliminar esta campaña del historial?')) return
    await fetch(`/api/campaigns/${id}`, { method: 'DELETE' })
    if (editingId === id) newCampaign()
    loadHistory()
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
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div>
          <h1 className="text-2xl font-bold" style={{ color: '#10253f' }}>📣 Campañas</h1>
          <p className="text-sm text-gray-500 mt-1">Envía un mensaje a un segmento de tus clientes o a uno en específico.</p>
        </div>
        {editingId && (
          <button onClick={newCampaign} className="text-xs px-3 py-2 rounded-lg border font-semibold" style={{ color: '#475569', borderColor: '#cbd5e1' }}>
            + Nueva campaña
          </button>
        )}
      </div>

      {editingId && (
        <div className="text-xs px-3 py-2 rounded-lg" style={{ background: '#fef9c3', border: '1px solid #fde68a', color: '#92400e' }}>
          ✏️ Editando una campaña del historial — al enviar o guardar, se actualiza esa campaña.
        </div>
      )}

      {/* Segmento */}
      <div className="bg-white rounded-xl border border-gray-200 p-4 md:p-6 space-y-4">
        <h2 className="font-bold text-base" style={{ color: '#10253f' }}>1. ¿A quién?</h2>

        {/* Cliente específico */}
        <div>
          <label className={LABEL}>Cliente específico (opcional — ignora los filtros de abajo)</label>
          {selectedClient ? (
            <div className="flex items-center justify-between px-3 py-2 rounded-lg border" style={{ background: '#f0f7fb', borderColor: '#b8d4e8' }}>
              <span className="text-sm font-semibold" style={{ color: '#0369a1' }}>👤 {selectedClient.fullName}</span>
              <button type="button" onClick={clearClient} className="text-xs text-gray-500 hover:text-red-600">Quitar ✕</button>
            </div>
          ) : (
            <div className="relative">
              <input type="text" value={clientSearch} onChange={e => setClientSearch(e.target.value)}
                className={INPUT} placeholder="Escribe el nombre para buscar un cliente..." />
              {clientMatches.length > 0 && (
                <div className="absolute z-10 mt-1 w-full bg-white border rounded-lg shadow-lg max-h-48 overflow-y-auto">
                  {clientMatches.map(c => (
                    <button key={c.id} type="button" onClick={() => pickClient(c)}
                      className="block w-full text-left px-3 py-2 text-sm hover:bg-gray-50 border-b last:border-0">
                      {c.fullName}
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>

        <div className={`grid grid-cols-1 sm:grid-cols-3 gap-4 ${selectedClient ? 'opacity-40 pointer-events-none' : ''}`}>
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

      {/* Plantillas */}
      <div className="bg-white rounded-xl border border-gray-200 p-4 md:p-6">
        <h2 className="font-bold text-base mb-1" style={{ color: '#10253f' }}>✨ Plantillas rápidas</h2>
        <p className="text-xs text-gray-500 mb-3">Empieza con una plantilla lista y edítala a tu gusto.</p>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
          {TEMPLATES.map(t => (
            <button key={t.name} type="button" onClick={() => applyTemplate(t)}
              className="flex items-center gap-2 px-3 py-2.5 rounded-lg border border-gray-200 hover:border-[#2a6496] hover:bg-[#f0f7fb] text-left transition-colors">
              <span className="text-lg shrink-0">{t.icon}</span>
              <span className="text-sm font-medium truncate" style={{ color: '#10253f' }}>{t.name}</span>
            </button>
          ))}
        </div>
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

        {/* Imágenes */}
        <div>
          <label className={LABEL}>Imágenes (opcional — hasta 3, máx. 1.5 MB c/u; van dentro del email)</label>
          <div className="flex flex-wrap gap-3 items-start">
            {images.map((img, i) => (
              <div key={i} className="relative">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={img.dataUrl} alt={img.name} className="w-24 h-24 object-cover rounded-lg border border-gray-200" />
                <button type="button" onClick={() => setImages(prev => prev.filter((_, j) => j !== i))}
                  className="absolute -top-2 -right-2 w-5 h-5 rounded-full bg-red-500 text-white text-xs leading-none">×</button>
              </div>
            ))}
            {images.length < 3 && (
              <label className="w-24 h-24 rounded-lg border-2 border-dashed border-gray-300 flex flex-col items-center justify-center cursor-pointer hover:border-[#2a6496] text-gray-400 hover:text-[#2a6496] transition-colors">
                <span className="text-xl">+</span>
                <span className="text-[10px]">Agregar</span>
                <input type="file" accept="image/png,image/jpeg,image/gif,image/webp" multiple className="hidden"
                  onChange={e => { addImages(e.target.files); e.target.value = '' }} />
              </label>
            )}
          </div>
          {imgError && <p className="text-xs text-red-600 mt-1">⚠️ {imgError}</p>}
        </div>

        {/* Botón de acción (CTA) */}
        <div>
          <label className={LABEL}>Botón de acción (opcional)</label>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <input className={INPUT} value={buttonText} onChange={e => setButtonText(e.target.value)} placeholder="Texto — ej. Cotiza ahora" />
            <input className={INPUT} value={buttonUrl} onChange={e => setButtonUrl(e.target.value)} placeholder="Enlace — ej. https://wa.me/1..." />
          </div>
          <p className="text-xs text-gray-400 mt-1">Aparece como un botón grande y llamativo en el correo. Déjalo vacío si no lo necesitas.</p>
        </div>
      </div>

      {/* Enviar */}
      <div className="bg-white rounded-xl border border-gray-200 p-4 md:p-6 space-y-3">
        <h2 className="font-bold text-base" style={{ color: '#10253f' }}>3. Enviar</h2>
        <div className="flex flex-wrap gap-2">
          <button onClick={() => setShowPreview(true)} disabled={!subject.trim() || !message.trim()}
            className="px-5 py-2 rounded-lg font-semibold text-sm border disabled:opacity-50"
            style={{ color: '#10253f', borderColor: '#cbd5e1', background: '#fff' }}>
            👁 Vista previa
          </button>
          <button onClick={send} disabled={sending || !preview?.withEmail}
            className="px-5 py-2 rounded-lg text-white font-semibold text-sm disabled:opacity-50"
            style={{ background: '#2a6496' }}>
            {sending ? 'Enviando...' : `📧 Enviar por email${preview ? ` (${Math.min(preview.withEmail, 60)})` : ''}`}
          </button>
          <button onClick={saveDraft} disabled={savingDraft || (!subject.trim() && !message.trim())}
            className="px-5 py-2 rounded-lg font-semibold text-sm border disabled:opacity-50"
            style={{ color: '#475569', borderColor: '#cbd5e1' }}>
            {savingDraft ? 'Guardando...' : '💾 Guardar sin enviar'}
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

      {/* Historial */}
      <div className="bg-white rounded-xl border border-gray-200 p-4 md:p-6">
        <h2 className="font-bold text-base mb-1" style={{ color: '#10253f' }}>🗂 Mis campañas</h2>
        <p className="text-xs text-gray-500 mb-4">Edita una campaña anterior o reenvíala (por ejemplo, a un segmento nuevo).</p>
        {history.length === 0 ? (
          <p className="text-sm text-gray-400">Aún no has creado campañas.</p>
        ) : (
          <div className="flex flex-col gap-2">
            {history.map(c => (
              <div key={c.id} className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 px-3 py-2.5 rounded-lg border"
                style={{ borderColor: editingId === c.id ? '#2a6496' : '#f1f5f9', background: editingId === c.id ? '#f0f7fb' : '#fff' }}>
                <div className="min-w-0">
                  <div className="text-sm font-semibold truncate" style={{ color: '#10253f' }}>
                    {c.subject || '(sin asunto)'} {c.hasImages && <span title="Incluye imágenes">🖼</span>}
                  </div>
                  <div className="text-xs text-gray-400">
                    {c.sentAt
                      ? <>Enviada {formatDateTime(c.sentAt)} · ✅ {c.sentCount}{c.failedCount ? ` · ❌ ${c.failedCount}` : ''}</>
                      : <span className="font-semibold text-amber-600">Borrador</span>}
                  </div>
                </div>
                <div className="flex gap-2 shrink-0">
                  <button onClick={() => loadCampaign(c.id)}
                    className="text-xs px-3 py-1.5 rounded-lg border font-medium hover:bg-gray-50" style={{ color: '#0369a1', borderColor: '#bae6fd' }}>
                    ✏️ {c.sentAt ? 'Editar / Reenviar' : 'Continuar'}
                  </button>
                  <button onClick={() => deleteCampaign(c.id)}
                    className="text-xs px-2 py-1.5 rounded-lg border font-medium hover:bg-red-50" style={{ color: '#ef4444', borderColor: '#fca5a5' }}>
                    🗑
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Modal de vista previa — HTML idéntico al que se enviará */}
      {showPreview && (() => {
        const sample = preview?.recipients.find(r => r.fullName)?.fullName?.split(' ')[0] || 'Cliente'
        return (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={() => setShowPreview(false)}>
            <div className="bg-white rounded-2xl w-full max-w-lg max-h-[85vh] overflow-hidden flex flex-col shadow-2xl" onClick={e => e.stopPropagation()}>
              <div className="flex items-center justify-between px-5 py-3 border-b border-gray-100">
                <h3 className="font-bold text-base" style={{ color: '#10253f' }}>👁 Vista previa del email</h3>
                <button onClick={() => setShowPreview(false)} className="text-gray-400 hover:text-gray-600 text-xl leading-none">×</button>
              </div>
              <div className="px-5 py-2 border-b border-gray-100 text-xs text-gray-500 bg-gray-50">
                Ejemplo con el nombre <strong>{sample}</strong> · así lo verá cada cliente con su propio nombre.
              </div>
              <div className="overflow-y-auto">
                <div className="px-5 py-3 border-b border-gray-100">
                  <div className="text-xs text-gray-400">De: {agentName}</div>
                  <div className="text-sm font-semibold mt-0.5" style={{ color: '#10253f' }}>
                    {renderCampaignSubject(subject, sample) || '(sin asunto)'}
                  </div>
                </div>
                <div className="px-5 py-4"
                  dangerouslySetInnerHTML={{ __html: renderCampaignHtml(message, sample, brand, images.map(i => i.dataUrl), buttonText.trim() && buttonUrl.trim() ? { text: buttonText, url: buttonUrl } : null) }} />
              </div>
              <div className="px-5 py-3 border-t border-gray-100 flex justify-end gap-2">
                <button onClick={() => setShowPreview(false)}
                  className="px-4 py-2 rounded-lg text-sm font-semibold border" style={{ color: '#475569', borderColor: '#e2e8f0' }}>
                  Cerrar
                </button>
                <button onClick={() => { setShowPreview(false); send() }} disabled={!preview?.withEmail}
                  className="px-4 py-2 rounded-lg text-white text-sm font-semibold disabled:opacity-50" style={{ background: '#2a6496' }}>
                  📧 Enviar ahora
                </button>
              </div>
            </div>
          </div>
        )
      })()}
    </div>
  )
}
