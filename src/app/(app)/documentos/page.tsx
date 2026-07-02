'use client'

import { useEffect, useState, useRef } from 'react'
import { TEMPLATES, generateDoc, type Client } from '@/lib/documentTemplates'

export default function DocumentosPage() {
  const [clients, setClients] = useState<Client[]>([])
  const [search, setSearch] = useState('')
  const [selectedClient, setSelectedClient] = useState<Client | null>(null)
  const [templateId, setTemplateId] = useState('welcome')
  const [agent, setAgent] = useState<Record<string, string>>({})
  const [copied, setCopied] = useState<'text' | 'whatsapp' | null>(null)
  const [sendDate, setSendDate] = useState('')
  const previewRef = useRef<HTMLDivElement>(null)

  // Email modal state
  const [showEmailModal, setShowEmailModal] = useState(false)
  const [emailTo, setEmailTo] = useState('')
  const [emailSubject, setEmailSubject] = useState('')
  const [emailSending, setEmailSending] = useState(false)
  const [emailResult, setEmailResult] = useState<{ success?: boolean; error?: string } | null>(null)

  useEffect(() => {
    fetch('/api/clients').then(r => r.json()).then(setClients)
    fetch('/api/settings').then(r => r.json()).then(setAgent)
  }, [])

  const filtered = search.length >= 2 ? clients.filter(c => c.fullName.toLowerCase().includes(search.toLowerCase())).slice(0, 10) : []
  const appUrl = typeof window !== 'undefined' ? window.location.origin : ''
  const doc = selectedClient ? generateDoc(templateId, selectedClient, agent, sendDate || undefined, appUrl) : null
  const template = TEMPLATES.find(t => t.id === templateId)!

  async function copyText() {
    if (!doc) return
    await navigator.clipboard.writeText(doc.text)
    setCopied('text'); setTimeout(() => setCopied(null), 2000)
  }

  async function copyWhatsApp() {
    if (!doc) return
    await navigator.clipboard.writeText(doc.whatsapp)
    setCopied('whatsapp'); setTimeout(() => setCopied(null), 2000)
  }

  function print() {
    if (!previewRef.current) return
    const w = window.open('', '_blank')
    if (!w) return
    w.document.write(`<html><head><title>Documento</title><style>body{margin:0;padding:0}@media print{body{margin:0}}</style></head><body>${previewRef.current.innerHTML}</body></html>`)
    w.document.close()
    w.focus()
    w.print()
  }

  async function sendEmail() {
    if (!doc || !selectedClient) return
    setEmailSending(true)
    setEmailResult(null)
    const res = await fetch('/api/documents/send', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        toEmail: emailTo,
        toName: selectedClient.fullName,
        subject: emailSubject,
        html: doc.html,
      }),
    })
    const data = await res.json()
    setEmailSending(false)
    setEmailResult(data)

    // Log activity in client profile when email is sent successfully
    if (data.success) {
      fetch(`/api/clients/${selectedClient.id}/activities`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: 'email',
          content: `📧 Email enviado: "${emailSubject}" → ${emailTo}`,
        }),
      }).catch(() => {})
    }
  }

  return (
    <div className="space-y-5 animate-fade-in">
      <div>
        <h1 className="text-2xl font-bold" style={{ color: '#10253f' }}>📄 Generador de Documentos</h1>
        <p className="text-sm text-gray-500 mt-1">Genera cartas y documentos personalizados para tus clientes</p>
      </div>

      {/* ── Email Modal ── */}
      {showEmailModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-6">
            <h3 className="text-lg font-bold mb-1" style={{ color: '#10253f' }}>📧 Enviar por Email</h3>
            <p className="text-sm text-gray-500 mb-4">
              Se enviará: <strong>{template?.name}</strong> a <strong>{selectedClient?.fullName}</strong>
            </p>

            <div className="space-y-3">
              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1">Email del destinatario</label>
                <input
                  type="email" value={emailTo} onChange={e => setEmailTo(e.target.value)}
                  placeholder="cliente@email.com"
                  className="w-full border border-gray-300 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#2a6496]"
                />
                {!selectedClient?.email && (
                  <p className="text-xs text-amber-600 mt-1">⚠️ Este cliente no tiene email guardado en su perfil</p>
                )}
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1">Asunto</label>
                <input
                  type="text" value={emailSubject} onChange={e => setEmailSubject(e.target.value)}
                  className="w-full border border-gray-300 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#2a6496]"
                />
              </div>

              {/* Result */}
              {emailResult?.success && (
                <div className="flex items-center gap-2 px-3 py-2.5 rounded-xl text-sm font-semibold"
                  style={{ background: '#d1fae5', color: '#065f46' }}>
                  ✅ Email enviado correctamente a {emailTo}
                </div>
              )}
              {emailResult?.error && (
                <div className="px-3 py-2.5 rounded-xl text-sm" style={{ background: '#fee2e2', color: '#dc2626' }}>
                  ⚠️ {emailResult.error}
                  {emailResult.error.includes('SMTP') && (
                    <a href="/settings" className="block mt-1 text-xs underline font-semibold">
                      Ir a Configuración → Notificaciones por Email →
                    </a>
                  )}
                </div>
              )}
            </div>

            <div className="flex gap-2 mt-5">
              {!emailResult?.success ? (
                <button onClick={sendEmail} disabled={emailSending || !emailTo || !emailSubject}
                  className="flex-1 py-2.5 rounded-xl text-sm font-bold text-white disabled:opacity-50"
                  style={{ background: emailSending ? '#64748b' : 'linear-gradient(135deg, #2a6496, #0891b2)' }}>
                  {emailSending ? '⏳ Enviando...' : '📧 Enviar email'}
                </button>
              ) : (
                <button onClick={() => { setShowEmailModal(false); setEmailResult(null) }}
                  className="flex-1 py-2.5 rounded-xl text-sm font-bold text-white"
                  style={{ background: '#059669' }}>
                  ✓ Cerrar
                </button>
              )}
              {!emailResult?.success && (
                <button onClick={() => { setShowEmailModal(false); setEmailResult(null) }}
                  className="px-5 py-2.5 rounded-xl text-sm border border-gray-200 text-gray-600">
                  Cancelar
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      <div className="flex gap-5 items-start flex-col lg:flex-row">
        {/* Left panel */}
        <div className="w-full lg:w-80 shrink-0 space-y-4">
          {/* Client selector */}
          <div className="bg-white rounded-xl border border-gray-200 p-5">
            <h3 className="font-semibold text-sm mb-3" style={{ color: '#10253f' }}>1. Selecciona el cliente</h3>
            <div className="relative">
              <input
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#0891b2]"
                placeholder="Buscar cliente..."
                value={selectedClient ? selectedClient.fullName : search}
                onChange={e => { setSearch(e.target.value); if (selectedClient) setSelectedClient(null) }}
              />
              {filtered.length > 0 && !selectedClient && (
                <div className="absolute top-full left-0 right-0 mt-1 bg-white rounded-lg border border-gray-200 shadow-lg z-20 overflow-hidden max-h-52 overflow-y-auto">
                  {filtered.map(c => (
                    <button key={c.id} onClick={() => { setSelectedClient(c); setSearch('') }}
                      className="w-full px-3 py-2.5 text-left hover:bg-gray-50 transition-colors border-b border-gray-100">
                      <div className="text-sm font-medium" style={{ color: '#0f172a' }}>{c.fullName}</div>
                      <div className="text-xs text-gray-500">{c.insurer || '—'} · {c.planName || '—'}</div>
                    </button>
                  ))}
                </div>
              )}
            </div>
            {selectedClient && (
              <div className="mt-3 p-3 rounded-lg" style={{ background: '#f0f9ff', border: '1px solid #bae6fd' }}>
                <div className="text-sm font-semibold" style={{ color: '#0369a1' }}>{selectedClient.fullName}</div>
                <div className="text-xs text-gray-500 mt-0.5">{selectedClient.insurer} · {selectedClient.planName}</div>
                <button onClick={() => { setSelectedClient(null); setSearch('') }}
                  className="text-xs mt-2" style={{ color: '#dc2626' }}>✕ Cambiar cliente</button>
              </div>
            )}
          </div>

          {/* Template selector */}
          <div className="bg-white rounded-xl border border-gray-200 p-5">
            <h3 className="font-semibold text-sm mb-3" style={{ color: '#10253f' }}>2. Elige el documento</h3>
            <div className="space-y-2">
              {TEMPLATES.map(t => (
                <button key={t.id} onClick={() => setTemplateId(t.id)}
                  className="w-full text-left px-3 py-3 rounded-lg border transition-all"
                  style={templateId === t.id
                    ? { background: '#f0f9ff', border: '1.5px solid #0891b2', color: '#0369a1' }
                    : { background: '#f8fafc', border: '1px solid #e2e8f0', color: '#475569' }}>
                  <div className="flex items-center gap-2">
                    <span className="text-base">{t.icon}</span>
                    <div>
                      <div className="text-xs font-semibold">{t.name}</div>
                      <div className="text-xs mt-0.5 opacity-70">{t.desc}</div>
                    </div>
                  </div>
                </button>
              ))}
            </div>
          </div>

          {/* Extra fields */}
          <div className="bg-white rounded-xl border border-gray-200 p-5">
            <h3 className="font-semibold text-sm mb-3" style={{ color: '#10253f' }}>3. Opciones adicionales</h3>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Fecha del documento</label>
              <input type="date" className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#0891b2]"
                value={sendDate} onChange={e => setSendDate(e.target.value)} />
              <p className="text-xs text-gray-400 mt-1">Deja vacío para usar la fecha actual</p>
            </div>
          </div>
        </div>

        {/* Right panel: preview */}
        <div className="flex-1 min-w-0">
          {!selectedClient ? (
            <div className="bg-white rounded-xl border border-gray-200 p-12 text-center">
              <div className="text-4xl mb-3">📄</div>
              <div className="font-semibold text-gray-600">Selecciona un cliente para generar el documento</div>
              <div className="text-sm text-gray-400 mt-1">Elige el cliente y el tipo de documento en el panel izquierdo</div>
            </div>
          ) : (
            <div className="space-y-3">
              {/* Actions bar */}
              <div className="bg-white rounded-xl border border-gray-200 px-4 py-3 flex items-center gap-3 flex-wrap">
                <div className="flex items-center gap-2 flex-1 min-w-0">
                  <span className="text-lg">{template.icon}</span>
                  <div className="min-w-0">
                    <div className="text-sm font-semibold truncate" style={{ color: '#10253f' }}>{template.name}</div>
                    <div className="text-xs text-gray-500 truncate">{selectedClient.fullName}</div>
                  </div>
                </div>
                <div className="flex items-center gap-2 shrink-0 flex-wrap">
                  <button onClick={print}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold border transition-all hover:bg-gray-50"
                    style={{ border: '1px solid #cbd5e1', color: '#334155' }}>
                    🖨️ Imprimir
                  </button>
                  <button onClick={() => {
                    setEmailTo(selectedClient.email || '')
                    setEmailSubject(`${template.name} — ${selectedClient.fullName}`)
                    setEmailResult(null)
                    setShowEmailModal(true)
                  }}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold text-white transition-all hover:opacity-90"
                    style={{ background: '#2a6496' }}>
                    📧 Enviar por Email
                  </button>
                  <button onClick={copyText}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all"
                    style={{ background: copied === 'text' ? '#d1fae5' : '#f1f5f9', color: copied === 'text' ? '#065f46' : '#334155' }}>
                    {copied === 'text' ? '✓ Copiado' : '📋 Copiar texto'}
                  </button>
                  <button onClick={copyWhatsApp}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold text-white transition-all"
                    style={{ background: copied === 'whatsapp' ? '#059669' : '#25d366' }}>
                    {copied === 'whatsapp' ? '✓ Copiado' : '💬 WhatsApp'}
                  </button>
                </div>
              </div>

              {/* Document preview */}
              <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
                <div ref={previewRef} dangerouslySetInnerHTML={{ __html: doc?.html || '' }}
                  className="p-2" style={{ minHeight: 400 }} />
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
