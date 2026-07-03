'use client'

// Asistente virtual del CRM — burbuja flotante + panel de chat.
// Vive en el layout de la app, así que la conversación sobrevive al navegar
// entre páginas. Habla con /api/assistant (herramientas de solo lectura).

import { useEffect, useRef, useState } from 'react'

interface Msg { role: 'user' | 'assistant'; content: string }

const SUGERENCIAS = [
  '¿Qué tengo para hoy?',
  '¿Qué renovaciones vienen en 30 días?',
  '¿Cómo van mis comisiones?',
  '¿Cuántos clientes activos tengo?',
]

// Render ligero: **negritas**, saltos de línea y viñetas — sin dependencias.
function renderContent(text: string) {
  return text.split('\n').map((line, i) => {
    const parts = line.split(/(\*\*[^*]+\*\*)/g).map((part, j) =>
      part.startsWith('**') && part.endsWith('**')
        ? <strong key={j}>{part.slice(2, -2)}</strong>
        : <span key={j}>{part}</span>
    )
    const isBullet = /^\s*[-•*]\s+/.test(line)
    return (
      <div key={i} className={isBullet ? 'pl-3' : ''} style={{ minHeight: line.trim() ? undefined : '0.5rem' }}>
        {parts}
      </div>
    )
  })
}

export default function AssistantChat() {
  const [open, setOpen] = useState(false)
  const [messages, setMessages] = useState<Msg[]>([])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const bottomRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (open) {
      bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
      inputRef.current?.focus()
    }
  }, [open, messages, loading])

  async function send(text: string) {
    const question = text.trim()
    if (!question || loading) return
    setError('')
    setInput('')
    const next: Msg[] = [...messages, { role: 'user', content: question }]
    setMessages(next)
    setLoading(true)
    try {
      const res = await fetch('/api/assistant', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messages: next }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        setError(data.error || 'Error al consultar el asistente.')
      } else {
        setMessages(m => [...m, { role: 'assistant', content: data.reply || '...' }])
      }
    } catch {
      setError('No se pudo conectar. Revisa tu internet e intenta de nuevo.')
    }
    setLoading(false)
  }

  return (
    <>
      {/* Burbuja flotante */}
      {!open && (
        <button
          onClick={() => setOpen(true)}
          aria-label="Abrir asistente virtual"
          className="fixed bottom-5 right-5 z-40 w-14 h-14 rounded-full shadow-lg flex items-center justify-center text-2xl transition-transform hover:scale-110 print:hidden"
          style={{ background: 'linear-gradient(135deg, #10253f, #2a6496)' }}
        >
          ✨
        </button>
      )}

      {/* Panel de chat */}
      {open && (
        <div className="fixed z-50 inset-0 md:inset-auto md:bottom-5 md:right-5 md:w-[400px] md:h-[600px] md:max-h-[85vh] flex flex-col bg-white md:rounded-2xl shadow-2xl md:border md:border-gray-200 print:hidden">
          {/* Header */}
          <div className="flex items-center justify-between px-4 py-3 md:rounded-t-2xl"
            style={{ background: 'linear-gradient(135deg, #10253f, #2a6496)' }}>
            <div className="flex items-center gap-2">
              <span className="text-xl">✨</span>
              <div>
                <div className="text-white font-bold text-sm">Asistente del CRM</div>
                <div className="text-white/70 text-[11px]">Consulta tus datos en lenguaje natural</div>
              </div>
            </div>
            <div className="flex items-center gap-1">
              {messages.length > 0 && (
                <button onClick={() => { setMessages([]); setError('') }}
                  className="text-white/70 hover:text-white text-xs px-2 py-1 rounded"
                  title="Nueva conversación">
                  🗑
                </button>
              )}
              <button onClick={() => setOpen(false)}
                className="text-white/80 hover:text-white text-xl leading-none px-2 py-1"
                aria-label="Cerrar">
                ×
              </button>
            </div>
          </div>

          {/* Mensajes */}
          <div className="flex-1 overflow-y-auto px-4 py-3 space-y-3" style={{ background: '#f8fafc' }}>
            {messages.length === 0 && (
              <div className="pt-6 text-center">
                <div className="text-3xl mb-2">👋</div>
                <p className="text-sm font-semibold text-gray-700 mb-1">¡Hola! Soy tu asistente.</p>
                <p className="text-xs text-gray-500 mb-4">Pregúntame por tus clientes, renovaciones, comisiones o tu agenda.</p>
                <div className="flex flex-col gap-2 items-stretch px-2">
                  {SUGERENCIAS.map(s => (
                    <button key={s} onClick={() => send(s)}
                      className="text-xs px-3 py-2 rounded-lg border border-gray-200 bg-white text-gray-600 hover:border-[#2a6496] hover:text-[#2a6496] transition-colors text-left">
                      {s}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {messages.map((m, i) => (
              <div key={i} className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                <div
                  className="max-w-[85%] px-3 py-2 rounded-2xl text-sm leading-relaxed"
                  style={m.role === 'user'
                    ? { background: '#10253f', color: 'white', borderBottomRightRadius: 6 }
                    : { background: 'white', color: '#1f2937', border: '1px solid #e5e7eb', borderBottomLeftRadius: 6 }}
                >
                  {m.role === 'assistant' ? renderContent(m.content) : m.content}
                </div>
              </div>
            ))}

            {loading && (
              <div className="flex justify-start">
                <div className="px-4 py-2.5 rounded-2xl bg-white border border-gray-200 text-sm text-gray-400">
                  <span className="inline-flex gap-1">
                    <span className="animate-bounce" style={{ animationDelay: '0ms' }}>●</span>
                    <span className="animate-bounce" style={{ animationDelay: '150ms' }}>●</span>
                    <span className="animate-bounce" style={{ animationDelay: '300ms' }}>●</span>
                  </span>
                </div>
              </div>
            )}

            {error && (
              <div className="text-xs text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
                ⚠️ {error}
              </div>
            )}
            <div ref={bottomRef} />
          </div>

          {/* Input */}
          <form
            onSubmit={e => { e.preventDefault(); send(input) }}
            className="flex items-center gap-2 px-3 py-3 border-t border-gray-200 bg-white md:rounded-b-2xl"
          >
            <input
              ref={inputRef}
              value={input}
              onChange={e => setInput(e.target.value)}
              placeholder="Escribe tu pregunta..."
              disabled={loading}
              className="flex-1 border border-gray-300 rounded-full px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#507b88] disabled:opacity-60"
            />
            <button
              type="submit"
              disabled={loading || !input.trim()}
              className="w-10 h-10 rounded-full text-white flex items-center justify-center disabled:opacity-40 transition-opacity shrink-0"
              style={{ background: '#2a6496' }}
              aria-label="Enviar"
            >
              ➤
            </button>
          </form>
        </div>
      )}
    </>
  )
}
