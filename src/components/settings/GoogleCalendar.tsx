'use client'

// Sección de Configuración: conectar / desconectar Google Calendar (OAuth).
// La sincronización de dos vías corre en segundo plano una vez conectado.

import { useEffect, useState } from 'react'
import { backupHealth } from '@/lib/backupHealth'

interface Status {
  configured: boolean
  connected: boolean
  email: string | null
  // Existe la conexión pero Google ya no acepta el permiso de largo plazo.
  // Sin esto la pantalla decía "✅ Conectado" con el respaldo llevando dos
  // semanas fallando, que es la peor forma de informar: parece que todo va bien.
  authBroken?: { at: string; error: string } | null
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

interface LastBackup {
  at: string
  ok: boolean
  fileName: string | null
  deleted: number
  error: string | null
}

function formatWhen(iso: string): string {
  const d = new Date(iso)
  return d.toLocaleString('es', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })
}

export default function GoogleCalendar() {
  const [status, setStatus] = useState<Status | null>(null)
  const [busy, setBusy] = useState(false)
  const [syncing, setSyncing] = useState(false)
  const [syncMsg, setSyncMsg] = useState<string | null>(null)
  const [result, setResult] = useState<{ text: string; ok: boolean } | null>(null)
  const [lastBackup, setLastBackup] = useState<LastBackup | null>(null)
  const [backingUp, setBackingUp] = useState(false)
  const [backupMsg, setBackupMsg] = useState<string | null>(null)
  const [folderName, setFolderName] = useState('')
  const [savingFolder, setSavingFolder] = useState(false)
  const [folderMsg, setFolderMsg] = useState<string | null>(null)
  const health = backupHealth(lastBackup)

  async function saveFolder() {
    setSavingFolder(true); setFolderMsg(null)
    try {
      const res = await fetch('/api/settings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ driveBackupFolder: folderName.trim() }),
      })
      if (!res.ok) throw new Error()
      setFolderMsg('✅ Guardado. La carpeta se renombrará en el próximo respaldo.')
    } catch {
      setFolderMsg('❌ No se pudo guardar el nombre de la carpeta.')
    }
    setSavingFolder(false)
  }

  useEffect(() => {
    fetch('/api/google/status').then(r => r.json()).then(setStatus).catch(() => setStatus({ configured: false, connected: false, email: null }))
    fetch('/api/google/backup').then(r => r.json()).then(d => setLastBackup(d.last ?? null)).catch(() => {})
    fetch('/api/settings').then(r => r.json()).then(s => setFolderName(s.driveBackupFolder || 'CRM Seguros - Backups')).catch(() => {})
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
    setSyncMsg(null)
  }

  async function syncNow() {
    setSyncing(true)
    setSyncMsg(null)
    try {
      const res = await fetch('/api/google/sync', { method: 'POST' })
      const data = await res.json()
      if (!res.ok) {
        setSyncMsg(`❌ ${data.error || 'Error al sincronizar'}`)
      } else if (Array.isArray(data.errors) && data.errors.length > 0) {
        setSyncMsg(`⚠️ Sincronización con errores: ${data.errors.join(' · ')}`)
      } else {
        setSyncMsg(`✅ Sincronizado — ${data.applied ?? 0} cambio(s) traído(s) de Google.`)
      }
    } catch {
      setSyncMsg('❌ No se pudo sincronizar. Intenta de nuevo.')
    }
    setSyncing(false)
  }

  async function backupNow() {
    setBackingUp(true)
    setBackupMsg(null)
    try {
      const res = await fetch('/api/google/backup', { method: 'POST' })
      const data = await res.json()
      if (!res.ok) {
        setBackupMsg(`❌ ${data.error || 'No se pudo respaldar'}`)
      } else {
        setBackupMsg(`✅ Respaldo creado en Google Drive: ${data.fileName}`)
        setLastBackup({ at: new Date().toISOString(), ok: true, fileName: data.fileName, deleted: data.deleted ?? 0, error: null })
      }
    } catch {
      setBackupMsg('❌ No se pudo respaldar. Intenta de nuevo.')
    }
    setBackingUp(false)
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
        <div>
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 p-4 rounded-xl border"
            style={status.authBroken
              ? { background: '#fef2f2', borderColor: '#fecaca' }
              : { background: '#f0fdf4', borderColor: '#a7f3d0' }}>
            <div>
              <div className="text-sm font-semibold" style={{ color: status.authBroken ? '#991b1b' : '#065f46' }}>
                {status.authBroken ? '⚠️ Conexión caducada' : '✅ Conectado'}
              </div>
              {status.email && <div className="text-xs text-gray-500 mt-0.5">{status.email}</div>}
            </div>
            <div className="flex gap-2">
              <button onClick={syncNow} disabled={syncing}
                className="text-xs px-3 py-2 rounded-lg border font-medium disabled:opacity-50"
                style={{ color: '#0369a1', borderColor: '#bae6fd', background: '#f0f9ff' }}>
                {syncing ? 'Sincronizando...' : '🔄 Sincronizar ahora'}
              </button>
              <button onClick={disconnect} disabled={busy}
                className="text-xs px-3 py-2 rounded-lg border font-medium disabled:opacity-50"
                style={{ color: '#ef4444', borderColor: '#fca5a5' }}>
                {busy ? 'Desconectando...' : 'Desconectar'}
              </button>
            </div>
          </div>
          {syncMsg && <p className="text-xs mt-2" style={{ color: syncMsg.startsWith('✅') ? '#065f46' : syncMsg.startsWith('⚠️') ? '#92400e' : '#b91c1c' }}>{syncMsg}</p>}
          {status.authBroken && (
            <div className="mt-3 px-3 py-2.5 rounded-lg text-xs"
              style={{ background: '#fef2f2', border: '1px solid #fecaca', color: '#991b1b' }}>
              <strong>Google dejó de aceptar el permiso.</strong> Ni el respaldo ni la sincronización del calendario funcionan hasta reconectar.
              <div className="mt-1.5" style={{ color: '#b91c1c' }}>
                Si esto se repite cada ~7 días, primero arregla la causa: en Google Cloud Console → Google Auth Platform → <strong>Público</strong>, el Estado de publicación debe decir <strong>&quot;En producción&quot;</strong>, no &quot;Prueba&quot;. Después pulsa <strong>Desconectar</strong> aquí arriba y vuelve a conectar.
              </div>
            </div>
          )}
          <p className="text-xs text-gray-400 mt-2">
            Tus citas y eventos del CRM se envían a Google al instante. Los eventos que creas en Google llegan al CRM cada pocos minutos (o al presionar &quot;Sincronizar ahora&quot;).
          </p>

          {/* ── Respaldo automático a Google Drive ─────────────────────────── */}
          <div className="mt-4 pt-4 border-t border-gray-100">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
              <div>
                <div className="text-sm font-semibold" style={{ color: '#10253f' }}>💾 Respaldo automático en Drive</div>
                <div className="text-xs text-gray-500 mt-0.5">
                  {lastBackup
                    ? `${lastBackup.ok ? 'Último respaldo' : 'Último intento'}: ${formatWhen(lastBackup.at)}`
                    : 'Aún no se ha creado ningún respaldo.'}
                </div>
              </div>
              <button onClick={backupNow} disabled={backingUp}
                className="text-xs px-3 py-2 rounded-lg border font-medium disabled:opacity-50 whitespace-nowrap"
                style={{ color: '#0369a1', borderColor: '#bae6fd', background: '#f0f9ff' }}>
                {backingUp ? 'Respaldando...' : '💾 Respaldar ahora'}
              </button>
            </div>
            {/* Un respaldo caído tiene que verse en ROJO y decir qué hacer. Antes
                se mostraba el último respaldo bueno y parecía que todo iba bien. */}
            {health.alarm && (
              <div className="mt-2.5 px-3 py-2.5 rounded-lg text-xs"
                style={{ background: '#fef2f2', border: '1px solid #fecaca', color: '#991b1b' }}>
                <strong>⚠️ El respaldo automático no está funcionando.</strong>
                <div className="mt-1" style={{ color: '#b91c1c' }}>{health.message}</div>
              </div>
            )}
            {backupMsg && <p className="text-xs mt-2" style={{ color: backupMsg.startsWith('✅') ? '#065f46' : '#b91c1c' }}>{backupMsg}</p>}

            {/* Nombre de la carpeta. Al cambiarlo se RENOMBRA la carpeta que ya
                existe, así los respaldos anteriores siguen todos juntos. */}
            <div className="mt-3">
              <label className="block text-xs font-medium text-gray-600 mb-1">Carpeta en Google Drive</label>
              <div className="flex gap-2">
                <input value={folderName} onChange={e => setFolderName(e.target.value)}
                  placeholder="CRM Seguros - Backups" maxLength={100}
                  className="flex-1 border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#507b88]" />
                <button onClick={saveFolder} disabled={savingFolder || !folderName.trim()}
                  className="text-xs px-3 py-2 rounded-lg border font-medium disabled:opacity-50 whitespace-nowrap"
                  style={{ color: '#0369a1', borderColor: '#bae6fd', background: '#f0f9ff' }}>
                  {savingFolder ? 'Guardando...' : 'Guardar'}
                </button>
              </div>
              {folderMsg && <p className="text-xs mt-1.5" style={{ color: folderMsg.startsWith('✅') ? '#065f46' : '#b91c1c' }}>{folderMsg}</p>}
            </div>

            <p className="text-xs text-gray-400 mt-3">
              Cada día se guarda una copia de todos tus datos (clientes, pólizas, comisiones, campañas, reclamos…) en esa carpeta de tu Google Drive. Se conservan los últimos 30. Los datos sensibles (SSN, banco) se guardan cifrados. Puedes mover la carpeta a donde quieras dentro de tu Drive: el CRM la seguirá encontrando. El CRM solo ve los archivos que él mismo crea, nunca el resto de tu Drive.
            </p>
          </div>
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
