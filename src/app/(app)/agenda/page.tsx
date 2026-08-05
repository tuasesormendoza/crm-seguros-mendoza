'use client'

import { useEffect, useState, useCallback, useRef } from 'react'

interface Contact {
  id: string
  name: string
  phone: string | null
  email: string | null
  company: string | null
  category: string | null
  notes: string | null
  docCount?: number
}

interface Doc {
  id: string; fileName: string; fileSize: number; mimeType: string
  category: string; notes: string | null; uploadedAt: string
}

// Categorías útiles para un contacto (no para un cliente): lo que se le manda
// o se recibe de una aseguradora, un broker o un médico.
const DOC_CATEGORIES = ['ETF', 'Formulario', 'Carta', 'Email', 'Factura Médica', 'Póliza', 'Otro']
const DOC_ICON: Record<string, string> = {
  'ETF': '🏧', 'Formulario': '📝', 'Carta': '✉️', 'Email': '📧',
  'Factura Médica': '🧾', 'Póliza': '📄', 'Otro': '📎',
}

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

const CATEGORIES = ['Cliente', 'Broker', 'Médico', 'Proveedor', 'Aseguradora', 'Referido', 'Personal', 'Otro']
const CAT_COLOR: Record<string, string> = {
  'Cliente': '#2563eb', 'Broker': '#7c3aed', 'Médico': '#0ea5e9', 'Proveedor': '#8b5cf6',
  'Aseguradora': '#10b981', 'Referido': '#f59e0b', 'Personal': '#ec4899', 'Otro': '#6b7280',
}

const EMPTY: Omit<Contact, 'id'> = { name: '', phone: '', email: '', company: '', category: '', notes: '' }

const INPUT = 'w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#507b88]'
const LABEL = 'block text-xs font-medium text-gray-600 mb-1'

function waLink(phone: string) {
  const d = phone.replace(/\D/g, '')
  return `https://wa.me/${d.length === 10 ? '1' + d : d}`
}

// ── Documentos de un contacto ────────────────────────────────────────────────
// Sirve para guardar lo que se le manda o se recibe: el formulario ETF de
// Washington National, una carta, una factura del médico…
function ContactDocuments({ contact, onClose, onChanged }: {
  contact: Contact; onClose: () => void; onChanged: () => void
}) {
  const [docs, setDocs] = useState<Doc[]>([])
  const [loading, setLoading] = useState(true)
  const [category, setCategory] = useState('ETF')
  const [uploading, setUploading] = useState(false)
  const [error, setError] = useState('')
  const [msg, setMsg] = useState('')
  const [sending, setSending] = useState<string | null>(null)
  const fileRef = useRef<HTMLInputElement>(null)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch(`/api/contacts/${contact.id}/documents`)
      setDocs(await res.json())
    } catch { /* ignore */ }
    setLoading(false)
  }, [contact.id])

  useEffect(() => { load() }, [load])

  async function upload(file: File) {
    setUploading(true); setError(''); setMsg('')
    try {
      const fd = new FormData()
      fd.append('file', file)
      fd.append('category', category)
      const res = await fetch(`/api/contacts/${contact.id}/documents`, { method: 'POST', body: fd })
      if (!res.ok) { const d = await res.json().catch(() => ({})); throw new Error(d.error || 'No se pudo subir') }
      await load(); onChanged()
    } catch (err) { setError((err as Error).message) }
    setUploading(false)
    if (fileRef.current) fileRef.current.value = ''
  }

  async function remove(d: Doc) {
    if (!confirm(`¿Eliminar "${d.fileName}"?`)) return
    await fetch(`/api/documents/${d.id}`, { method: 'DELETE' })
    await load(); onChanged()
  }

  // Manda el archivo tal cual como adjunto al email del contacto.
  async function email(d: Doc) {
    if (!contact.email) return
    if (!confirm(`¿Enviar "${d.fileName}" a ${contact.email}?`)) return
    setSending(d.id); setError(''); setMsg('')
    try {
      const res = await fetch(`/api/documents/${d.id}/email`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ toEmail: contact.email, toName: contact.name }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(data.error || 'No se pudo enviar')
      setMsg(`✅ Enviado a ${contact.email}`)
    } catch (err) { setError((err as Error).message) }
    setSending(null)
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={onClose}>
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg p-6 max-h-[85vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
        <div className="flex items-start justify-between gap-3 mb-1">
          <h3 className="text-lg font-bold" style={{ color: '#10253f' }}>📎 Documentos</h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-700 text-xl leading-none">×</button>
        </div>
        <p className="text-sm text-gray-500 mb-4">
          {contact.name}{contact.email && <> · <span className="text-gray-400">{contact.email}</span></>}
        </p>

        {/* Subir */}
        <div className="border border-dashed border-gray-300 rounded-xl p-4 bg-gray-50">
          <label className={LABEL}>Tipo de documento</label>
          <select className={INPUT} value={category} onChange={e => setCategory(e.target.value)}>
            {DOC_CATEGORIES.map(o => <option key={o} value={o}>{DOC_ICON[o]} {o}</option>)}
          </select>
          <input ref={fileRef} type="file" disabled={uploading}
            onChange={e => { const f = e.target.files?.[0]; if (f) upload(f) }}
            className="mt-3 block w-full text-sm text-gray-600 file:mr-3 file:py-1.5 file:px-3 file:rounded-lg file:border-0 file:text-sm file:font-semibold file:text-white file:bg-[#10253f] disabled:opacity-50" />
          <p className="text-xs text-gray-400 mt-2">PDF, imágenes o Word/Excel. Máximo 10 MB.</p>
          {uploading && <p className="text-xs text-gray-500 mt-1">Subiendo...</p>}
        </div>

        {error && <div className="mt-3 text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">{error}</div>}
        {msg && <div className="mt-3 text-sm text-green-700 bg-green-50 border border-green-200 rounded-lg px-3 py-2">{msg}</div>}

        {/* Lista */}
        <div className="mt-4 space-y-2">
          {loading ? (
            <p className="text-sm text-gray-400 text-center py-4">Cargando...</p>
          ) : docs.length === 0 ? (
            <p className="text-sm text-gray-400 text-center py-4">Aún no hay documentos de este contacto.</p>
          ) : docs.map(d => (
            <div key={d.id} className="border border-gray-200 rounded-xl p-3">
              <div className="flex items-start gap-2">
                <span className="text-lg leading-none">{DOC_ICON[d.category] || '📎'}</span>
                <div className="min-w-0 flex-1">
                  <div className="text-sm font-medium text-gray-900 truncate">{d.fileName}</div>
                  <div className="text-xs text-gray-400">
                    {d.category} · {formatSize(d.fileSize)} · {new Date(d.uploadedAt).toLocaleDateString('es-US')}
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-2 mt-2 flex-wrap">
                <a href={`/api/documents/${d.id}/download`}
                  className="text-xs font-semibold px-2.5 py-1 rounded-lg text-white" style={{ background: '#305a72' }}>
                  ⬇️ Descargar
                </a>
                {contact.email ? (
                  <button onClick={() => email(d)} disabled={sending === d.id}
                    className="text-xs font-semibold px-2.5 py-1 rounded-lg text-white disabled:opacity-50" style={{ background: '#0891b2' }}>
                    {sending === d.id ? 'Enviando...' : '✉️ Enviar por email'}
                  </button>
                ) : (
                  <span className="text-xs text-gray-400">Agrega un email al contacto para poder enviarlo</span>
                )}
                <button onClick={() => remove(d)} className="text-xs text-red-400 hover:text-red-600 ml-auto">Eliminar</button>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

export default function AgendaPage() {
  const [contacts, setContacts] = useState<Contact[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [showForm, setShowForm] = useState(false)
  const [editing, setEditing] = useState<Contact | null>(null)
  const [form, setForm] = useState<Omit<Contact, 'id'>>(EMPTY)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [docsFor, setDocsFor] = useState<Contact | null>(null)

  const load = useCallback(async (q: string) => {
    setLoading(true)
    try {
      const res = await fetch(`/api/contacts${q ? `?q=${encodeURIComponent(q)}` : ''}`)
      setContacts(await res.json())
    } catch { /* ignore */ }
    setLoading(false)
  }, [])

  useEffect(() => {
    const t = setTimeout(() => load(search), 250)
    return () => clearTimeout(t)
  }, [search, load])

  function openNew() {
    setEditing(null); setForm(EMPTY); setError(''); setShowForm(true)
  }
  function openEdit(c: Contact) {
    setEditing(c)
    setForm({ name: c.name, phone: c.phone || '', email: c.email || '', company: c.company || '', category: c.category || '', notes: c.notes || '' })
    setError(''); setShowForm(true)
  }

  async function save(e: React.FormEvent) {
    e.preventDefault()
    if (!form.name.trim()) { setError('El nombre es obligatorio.'); return }
    setSaving(true); setError('')
    try {
      const url = editing ? `/api/contacts/${editing.id}` : '/api/contacts'
      const res = await fetch(url, {
        method: editing ? 'PUT' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      })
      if (!res.ok) { const d = await res.json().catch(() => ({})); throw new Error(d.error || 'No se pudo guardar') }
      setShowForm(false)
      load(search)
    } catch (err) { setError((err as Error).message) }
    setSaving(false)
  }

  async function remove(c: Contact) {
    if (!confirm(`¿Eliminar a ${c.name} de la agenda?`)) return
    await fetch(`/api/contacts/${c.id}`, { method: 'DELETE' })
    load(search)
  }

  return (
    <div className="max-w-4xl mx-auto space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold" style={{ color: '#10253f' }}>📇 Agenda Telefónica</h1>
          <p className="text-sm text-gray-500 mt-0.5">{contacts.length} contacto(s)</p>
        </div>
        <button onClick={openNew}
          className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-semibold text-white transition-all hover:opacity-90"
          style={{ background: 'linear-gradient(135deg, var(--brand-800), var(--brand-500))' }}>
          + Nuevo Contacto
        </button>
      </div>

      {/* Search */}
      <input value={search} onChange={e => setSearch(e.target.value)}
        placeholder="Buscar por nombre, teléfono, empresa o email..."
        className={INPUT} />

      {/* List */}
      {loading ? (
        <div className="text-center py-10 text-gray-400">Cargando...</div>
      ) : contacts.length === 0 ? (
        <div className="text-center py-16 bg-white rounded-2xl border border-gray-200">
          <div className="text-4xl mb-2">📇</div>
          <p className="text-gray-500 font-medium">{search ? 'Sin resultados' : 'Aún no tienes contactos'}</p>
          {!search && <p className="text-sm text-gray-400 mt-1">Agrega médicos, proveedores, referidos o contactos personales.</p>}
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {contacts.map(c => (
            <div key={c.id} className="bg-white rounded-xl border border-gray-200 p-4">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <div className="font-semibold text-gray-900 truncate">{c.name}</div>
                  {c.company && <div className="text-xs text-gray-500 truncate">{c.company}</div>}
                </div>
                {c.category && (
                  <span className="text-xs font-medium px-2 py-0.5 rounded-full shrink-0 text-white"
                    style={{ background: CAT_COLOR[c.category] || '#6b7280' }}>
                    {c.category}
                  </span>
                )}
              </div>
              {c.phone && <div className="text-sm text-gray-700 mt-2">📞 {c.phone}</div>}
              {c.email && <div className="text-sm text-gray-500 truncate">✉️ {c.email}</div>}
              {c.notes && <div className="text-xs text-gray-400 mt-1 whitespace-pre-wrap">{c.notes}</div>}

              <div className="flex items-center gap-2 mt-3 flex-wrap">
                {c.phone && (
                  <>
                    <a href={`tel:${c.phone.replace(/[^\d+]/g, '')}`}
                      className="text-xs font-semibold px-2.5 py-1 rounded-lg text-white" style={{ background: '#305a72' }}>
                      📞 Llamar
                    </a>
                    <a href={waLink(c.phone)} target="_blank" rel="noopener noreferrer"
                      className="text-xs font-semibold px-2.5 py-1 rounded-lg text-white" style={{ background: '#25d366' }}>
                      💬 WhatsApp
                    </a>
                  </>
                )}
                <button onClick={() => setDocsFor(c)}
                  className="text-xs font-semibold px-2.5 py-1 rounded-lg text-white" style={{ background: '#507b88' }}>
                  📎 Documentos{c.docCount ? ` (${c.docCount})` : ''}
                </button>
                <button onClick={() => openEdit(c)} className="text-xs text-gray-500 hover:text-gray-800 underline ml-auto">Editar</button>
                <button onClick={() => remove(c)} className="text-xs text-red-400 hover:text-red-600">Eliminar</button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Documentos del contacto */}
      {docsFor && (
        <ContactDocuments contact={docsFor} onClose={() => setDocsFor(null)} onChanged={() => load(search)} />
      )}

      {/* Form modal */}
      {showForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={() => setShowForm(false)}>
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md p-6" onClick={e => e.stopPropagation()}>
            <h3 className="text-lg font-bold mb-4" style={{ color: '#10253f' }}>{editing ? 'Editar contacto' : 'Nuevo contacto'}</h3>
            <form onSubmit={save} className="space-y-3">
              <div>
                <label className={LABEL}>Nombre *</label>
                <input className={INPUT} value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} required />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className={LABEL}>Teléfono</label>
                  <input className={INPUT} value={form.phone ?? ''} onChange={e => setForm(f => ({ ...f, phone: e.target.value }))} placeholder="(407) 555-1234" />
                </div>
                <div>
                  <label className={LABEL}>Categoría</label>
                  <select className={INPUT} value={form.category ?? ''} onChange={e => setForm(f => ({ ...f, category: e.target.value }))}>
                    <option value="">—</option>
                    {CATEGORIES.map(o => <option key={o}>{o}</option>)}
                  </select>
                </div>
              </div>
              <div>
                <label className={LABEL}>Empresa / Consultorio</label>
                <input className={INPUT} value={form.company ?? ''} onChange={e => setForm(f => ({ ...f, company: e.target.value }))} />
              </div>
              <div>
                <label className={LABEL}>Email</label>
                <input type="email" className={INPUT} value={form.email ?? ''} onChange={e => setForm(f => ({ ...f, email: e.target.value }))} />
              </div>
              <div>
                <label className={LABEL}>Notas</label>
                <textarea rows={2} className={INPUT} value={form.notes ?? ''} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} />
              </div>
              {error && <div className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">{error}</div>}
              <div className="flex gap-3 pt-1">
                <button type="button" onClick={() => setShowForm(false)} className="flex-1 border border-gray-300 text-gray-600 rounded-lg py-2 text-sm hover:bg-gray-50">
                  Cancelar
                </button>
                <button type="submit" disabled={saving}
                  className="flex-1 text-white rounded-lg py-2 text-sm font-semibold disabled:opacity-50" style={{ background: '#10253f' }}>
                  {saving ? 'Guardando...' : 'Guardar'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
