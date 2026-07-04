'use client'

// Sección de Configuración: conectar / desconectar Google Calendar (OAuth).
// La sincronización de dos vías corre en segundo plano una vez conectado.

import { useEffect, useState } from 'react'

interface Status {
  configured: boolean
  connected: boolean
  email: string | null
}

// Mensajes de retorno del flujo OAuth (?google=... en la URL)
const RESULT_MESSAGES: Record<string, { text: string; ok: boolean }> = {
  connected: { text: '✅ Google Calendar conectado correctamente.', ok: true },
  denied:    { text: 'Cancelaste la autorización de Google.', ok: false },
  error:     { text: '❌ Hubo un error al conectar con Google. Intenta de nuevo.', ok: false },
  badstate:  { text: '❌ La sesión de autorización expiró. Intenta de nuevo.', ok: false },
  norefresh: { text: '⚠️ Google no envió el permiso de largo plazo. Quita el acceso en tu cuenta de Google y vuelve a conectar.', ok: false },
  noconfig:  { text: '⚠️ Falta configurar las credenciales de Google en el servidor.', ok: false },
}

export default function GoogleCalendar() {
  const [status, setStatus] = useState<Status | null>(null)
  const [busy, setBusy] = useState(false)
  const [result, setResult] = useState<{ text: string; ok: boolean } | null>(null)

  useEffect(() => {
    fetch('/api/google/status').then(r => r.json()).then(setStatus).catch(() => setStatus({ configured: false, connected: false, email: null }))
    // Leer el resultado del redirect de OAuth y limpiar la URL
    const params = new URLSearchParams(window.location.search)
    const g = params.get('google')
    if (g && RESULT_MESSAGES[g]) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setResult(RESULT_MESSAGES[g])
      const url = new URL(window.location.href)
      url.searchParams.delete('google')
      window.history.replaceState({}, '', url.toString())
    }
  }, [])

  async function disconnect() {
    if (!confirm('¿Desconectar Google Calendar? Tus eventos ya sincronizados no se borran.')) return
    setBusy(true)
    await fetch('/api/google/disconnect', { method: 'POST' })
    setBusy(false)
    setStatus(s => s ? { ...s, connected: false, email: null } : s)
    setResult(null)
  }

  return (
    <div className="bg-white rounded-xl border border-gray-200 p-4 md:p-6">
      <h2 className="font-bold text-base mb-1" style={{ color: '#10253f' }}>📆 Google Calendar</h2>
      <p className="text-xs text-gray-500 mb-4">
        Conecta tu Google Calendar para sincronizar en ambos sentidos: tus citas y eventos del CRM aparecen en Google (y en tu teléfono), y tus eventos de Google aparecen en el CRM.
      </p>

      {result && (
        <div className="text-sm px-3 py-2 rounded-lg mb-4"
          style={{ background: result.ok ? '#f0fdf4' : '#fef2f2', color: result.ok ? '#065f46' : '#b91c1c', border: `1px solid ${result.ok ? '#a7f3d0' : '#fecaca'}` }}>
          {result.text}
        </div>
      )}

      {status === null ? (
        <p className="text-sm text-gray-400">Cargando...</p>
      ) : !status.configured ? (
        <div className="text-sm px-3 py-3 rounded-lg" style={{ background: '#fef9c3', border: '1px solid #fde68a', color: '#92400e' }}>
          La conexión con Google aún no está habilitada en el servidor. Se requiere configurar las credenciales de Google (GOOGLE_CLIENT_ID y GOOGLE_CLIENT_SECRET) en las variables de entorno.
        </div>
      ) : status.connected ? (
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 p-4 rounded-xl border" style={{ background: '#f0fdf4', borderColor: '#a7f3d0' }}>
          <div>
            <div className="text-sm font-semibold" style={{ color: '#065f46' }}>✅ Conectado</div>
            {status.email && <div className="text-xs text-gray-500 mt-0.5">{status.email}</div>}
          </div>
          <button onClick={disconnect} disabled={busy}
            className="text-xs px-3 py-2 rounded-lg border font-medium disabled:opacity-50"
            style={{ color: '#ef4444', borderColor: '#fca5a5' }}>
            {busy ? 'Desconectando...' : 'Desconectar'}
          </button>
        </div>
      ) : (
        <a href="/api/google/connect"
          className="inline-flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-semibold text-white transition-all hover:opacity-90"
          style={{ background: '#2a6496' }}>
          📆 Conectar Google Calendar
        </a>
      )}
    </div>
  )
}
