'use client'

// Configuración → Cuenta: estado de la verificación en dos pasos del usuario
// actual, con opción de reconfigurar el autenticador (p. ej. cambió de teléfono)
// y de generar códigos de respaldo nuevos.

import { useEffect, useState, useCallback } from 'react'

export default function TwoFactorPanel() {
  const [status, setStatus] = useState<{ enabled: boolean; backupRemaining: number } | null>(null)
  const [qr, setQr] = useState('')
  const [secret, setSecret] = useState('')
  const [code, setCode] = useState('')
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState('')
  const [newCodes, setNewCodes] = useState<string[] | null>(null)

  const load = useCallback(() => {
    fetch('/api/auth/2fa/status').then(r => r.json()).then(setStatus).catch(() => {})
  }, [])
  useEffect(() => { load() }, [load])

  async function startSetup() {
    setBusy(true); setMsg(''); setNewCodes(null)
    try {
      const res = await fetch('/api/auth/2fa/setup', { method: 'POST' })
      const data = await res.json()
      if (!res.ok) { setMsg(`❌ ${data.error || 'Error'}`) }
      else { setQr(data.qr); setSecret(data.secret) }
    } catch { setMsg('❌ No se pudo conectar.') }
    setBusy(false)
  }

  async function activate() {
    setBusy(true); setMsg('')
    try {
      const res = await fetch('/api/auth/2fa/activate', {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ code }),
      })
      const data = await res.json()
      if (!res.ok) { setMsg(`❌ ${data.error || 'Código incorrecto'}`) }
      else {
        setNewCodes(data.backupCodes || null)
        setQr(''); setSecret(''); setCode('')
        setMsg('✅ Verificación en dos pasos activada.')
        load()
      }
    } catch { setMsg('❌ No se pudo conectar.') }
    setBusy(false)
  }

  return (
    <div className="bg-white rounded-xl border border-gray-200 p-4 md:p-6">
      <h2 className="font-bold text-base mb-1" style={{ color: '#10253f' }}>🔐 Verificación en dos pasos</h2>
      <p className="text-xs text-gray-500 mb-4">
        Obligatoria para todos los usuarios: además de tu contraseña, se pide un código de 6 dígitos de tu app de autenticación (Google Authenticator, Authy, Microsoft Authenticator…).
      </p>

      {status && (
        <div className="flex items-center justify-between gap-3 p-3 rounded-lg mb-4"
          style={{ background: status.enabled ? '#f0fdf4' : '#fef9c3', border: `1px solid ${status.enabled ? '#a7f3d0' : '#fde68a'}` }}>
          <div>
            <div className="text-sm font-semibold" style={{ color: status.enabled ? '#065f46' : '#92400e' }}>
              {status.enabled ? '✅ Activada' : '⚠️ Sin configurar'}
            </div>
            {status.enabled && (
              <div className="text-xs text-gray-500 mt-0.5">
                Te quedan <strong>{status.backupRemaining}</strong> código(s) de respaldo.
              </div>
            )}
          </div>
          {!qr && (
            <button onClick={startSetup} disabled={busy}
              className="text-xs px-3 py-2 rounded-lg border font-medium disabled:opacity-50 whitespace-nowrap"
              style={{ color: '#0369a1', borderColor: '#bae6fd', background: '#f0f9ff' }}>
              {status.enabled ? '🔄 Reconfigurar' : '🔐 Activar ahora'}
            </button>
          )}
        </div>
      )}

      {/* Registro / reconfiguración */}
      {qr && (
        <div className="rounded-xl border border-gray-200 p-4 mb-3">
          <p className="text-xs text-gray-600 mb-3">
            Escanea este código con tu app de autenticación y escribe el código de 6 dígitos para confirmar.
            {status?.enabled && <strong> Esto reemplazará tu configuración anterior.</strong>}
          </p>
          <div className="flex flex-col sm:flex-row gap-4 items-center">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={qr} alt="Código QR" width={180} height={180} className="rounded-lg border border-gray-200" />
            <div className="flex-1 w-full">
              <details className="mb-3">
                <summary className="text-xs text-gray-500 cursor-pointer">¿No puedes escanear? Escribe la clave</summary>
                <code className="block mt-1 text-xs break-all bg-gray-100 p-2 rounded">{secret}</code>
              </details>
              <input value={code} onChange={e => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                placeholder="000000" inputMode="numeric"
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-center text-lg font-bold tracking-widest" />
              <div className="flex gap-2 mt-2">
                <button onClick={() => { setQr(''); setSecret(''); setCode('') }}
                  className="flex-1 text-xs px-3 py-2 rounded-lg border text-gray-600">Cancelar</button>
                <button onClick={activate} disabled={busy || code.length !== 6}
                  className="flex-1 text-xs px-3 py-2 rounded-lg text-white font-semibold disabled:opacity-50"
                  style={{ background: '#10253f' }}>
                  {busy ? 'Verificando...' : 'Confirmar'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Códigos de respaldo nuevos (se muestran una sola vez) */}
      {newCodes && (
        <div className="rounded-xl p-4 mb-3" style={{ background: '#f8fafc', border: '1px solid #e2e8f0' }}>
          <p className="text-sm font-semibold mb-1" style={{ color: '#10253f' }}>🔑 Tus códigos de respaldo</p>
          <p className="text-xs text-gray-500 mb-3">Guárdalos en un lugar seguro. Cada uno sirve una sola vez y no se volverán a mostrar.</p>
          <div className="grid grid-cols-2 gap-2 mb-3">
            {newCodes.map(c => (
              <code key={c} className="bg-white border border-gray-200 rounded-lg py-1.5 text-center text-sm font-bold tracking-wide">{c}</code>
            ))}
          </div>
          <button onClick={() => navigator.clipboard?.writeText(newCodes.join('\n'))}
            className="text-xs px-3 py-1.5 rounded-lg border text-gray-600">📋 Copiar todos</button>
        </div>
      )}

      {msg && <p className="text-xs mt-1" style={{ color: msg.startsWith('✅') ? '#059669' : '#b91c1c' }}>{msg}</p>}
    </div>
  )
}
