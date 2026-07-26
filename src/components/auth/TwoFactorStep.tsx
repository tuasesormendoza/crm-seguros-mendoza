'use client'

// Segundo paso del inicio de sesión: verificar el código del autenticador o,
// si el usuario aún no lo tiene, registrarlo (escanear el QR) — 2FA obligatorio.

import { useState, useEffect, useCallback } from 'react'

const BOX: React.CSSProperties = {
  width: '100%', padding: '0.75rem 1rem', borderRadius: 12, fontSize: '1.15rem',
  letterSpacing: '0.35em', textAlign: 'center', fontWeight: 700,
  background: 'rgba(255,255,255,0.85)', border: '1.5px solid rgba(var(--brand-500-rgb), 0.25)',
  color: '#0f172a', outline: 'none', boxSizing: 'border-box',
}
const BTN: React.CSSProperties = {
  width: '100%', padding: '0.85rem', borderRadius: 12, border: 'none', fontWeight: 700,
  fontSize: '0.9rem', color: 'white', cursor: 'pointer',
  background: 'linear-gradient(135deg, var(--brand-800), var(--brand-500))',
  boxShadow: '0 4px 20px rgba(var(--brand-800-rgb), .35)',
}
const ERR: React.CSSProperties = {
  display: 'flex', alignItems: 'center', gap: 8, padding: '0.6rem 0.875rem', borderRadius: 10,
  background: 'rgba(220,38,38,0.08)', color: '#dc2626', fontSize: '0.8rem', border: '1px solid rgba(220,38,38,0.20)',
}

export default function TwoFactorStep({ mode, onDone }: {
  mode: 'verify' | 'enroll'
  onDone: () => void
}) {
  const [code, setCode] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [qr, setQr] = useState('')
  const [secret, setSecret] = useState('')
  const [backupCodes, setBackupCodes] = useState<string[] | null>(null)
  const [savedAck, setSavedAck] = useState(false)

  // En modo registro: pedir el QR al entrar.
  const loadSetup = useCallback(async () => {
    setError('')
    try {
      const res = await fetch('/api/auth/2fa/setup', { method: 'POST' })
      const data = await res.json()
      if (!res.ok) { setError(data.error || 'No se pudo generar el código QR.'); return }
      setQr(data.qr); setSecret(data.secret)
    } catch { setError('No se pudo conectar con el servidor.') }
  }, [])

  useEffect(() => { if (mode === 'enroll') loadSetup() }, [mode, loadSetup])

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true); setError('')
    try {
      const url = mode === 'enroll' ? '/api/auth/2fa/activate' : '/api/auth/2fa/verify'
      const res = await fetch(url, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code }),
      })
      const data = await res.json()
      if (!res.ok) { setError(data.error || 'Código incorrecto.'); setCode(''); setLoading(false); return }
      if (mode === 'enroll' && Array.isArray(data.backupCodes)) {
        setBackupCodes(data.backupCodes)   // mostrarlos antes de entrar
        setLoading(false)
        return
      }
      onDone()
    } catch {
      setError('No se pudo conectar con el servidor.')
      setLoading(false)
    }
  }

  // ── Pantalla final del registro: códigos de respaldo ───────────────────────
  if (backupCodes) {
    return (
      <div>
        <h2 style={{ fontSize: '1.35rem', fontWeight: 800, color: 'var(--brand-800)', marginBottom: '0.4rem' }}>
          🔑 Guarda tus códigos de respaldo
        </h2>
        <p style={{ color: '#64748b', fontSize: '0.85rem', marginBottom: '1rem' }}>
          Si pierdes el teléfono, estos códigos son la única forma de entrar. Cada uno sirve <strong>una sola vez</strong>. Guárdalos en un lugar seguro — no se volverán a mostrar.
        </p>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: '1rem' }}>
          {backupCodes.map(c => (
            <code key={c} style={{ background: '#f1f5f9', border: '1px solid #e2e8f0', borderRadius: 8, padding: '0.5rem', textAlign: 'center', fontSize: '0.85rem', fontWeight: 700, color: '#0f172a', letterSpacing: '0.05em' }}>
              {c}
            </code>
          ))}
        </div>
        <div style={{ display: 'flex', gap: 8, marginBottom: '1rem' }}>
          <button type="button" onClick={() => navigator.clipboard?.writeText(backupCodes.join('\n'))}
            style={{ flex: 1, padding: '0.6rem', borderRadius: 10, border: '1px solid #cbd5e1', background: '#fff', color: '#475569', fontSize: '0.8rem', fontWeight: 600, cursor: 'pointer' }}>
            📋 Copiar
          </button>
          <button type="button" onClick={() => {
            const blob = new Blob([`Códigos de respaldo — CRM Seguros\n\n${backupCodes.join('\n')}\n\nCada código sirve una sola vez.`], { type: 'text/plain' })
            const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = 'codigos-respaldo-crm.txt'; a.click(); URL.revokeObjectURL(a.href)
          }}
            style={{ flex: 1, padding: '0.6rem', borderRadius: 10, border: '1px solid #cbd5e1', background: '#fff', color: '#475569', fontSize: '0.8rem', fontWeight: 600, cursor: 'pointer' }}>
            ⬇️ Descargar
          </button>
        </div>
        <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: '0.8rem', color: '#334155', marginBottom: '1rem', cursor: 'pointer' }}>
          <input type="checkbox" checked={savedAck} onChange={e => setSavedAck(e.target.checked)} />
          Ya los guardé en un lugar seguro
        </label>
        <button onClick={onDone} disabled={!savedAck}
          style={{ ...BTN, opacity: savedAck ? 1 : 0.5, cursor: savedAck ? 'pointer' : 'not-allowed' }}>
          Entrar al sistema →
        </button>
      </div>
    )
  }

  // ── Pantalla de verificación / registro ───────────────────────────────────
  return (
    <div>
      <h2 style={{ fontSize: '1.5rem', fontWeight: 800, color: 'var(--brand-800)', marginBottom: '0.4rem' }}>
        {mode === 'enroll' ? '🔐 Activa tu verificación' : '🔐 Verificación en dos pasos'}
      </h2>
      <p style={{ color: '#64748b', fontSize: '0.85rem', marginBottom: '1.25rem' }}>
        {mode === 'enroll'
          ? 'Por seguridad, tu cuenta necesita un segundo paso. Escanea este código con Google Authenticator (o Authy, Microsoft Authenticator…) y escribe el código de 6 dígitos.'
          : 'Escribe el código de 6 dígitos que muestra tu app de autenticación.'}
      </p>

      {mode === 'enroll' && (
        <div style={{ textAlign: 'center', marginBottom: '1rem' }}>
          {qr ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={qr} alt="Código QR para el autenticador" width={200} height={200}
              style={{ borderRadius: 12, border: '1px solid #e2e8f0', background: '#fff' }} />
          ) : (
            <div style={{ height: 200, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#94a3b8', fontSize: '0.85rem' }}>
              Generando código QR...
            </div>
          )}
          {secret && (
            <details style={{ marginTop: 8 }}>
              <summary style={{ fontSize: '0.75rem', color: '#64748b', cursor: 'pointer' }}>¿No puedes escanear? Escribe la clave</summary>
              <code style={{ display: 'block', marginTop: 6, fontSize: '0.7rem', wordBreak: 'break-all', color: '#334155', background: '#f1f5f9', padding: '0.5rem', borderRadius: 8 }}>{secret}</code>
            </details>
          )}
        </div>
      )}

      <form onSubmit={submit} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
        <input
          type="text" inputMode="numeric" autoComplete="one-time-code" autoFocus
          value={code}
          onChange={e => setCode(e.target.value.replace(/[^0-9A-Za-z-]/g, '').slice(0, 11))}
          placeholder="000000" maxLength={11} style={BOX}
        />
        {error && (
          <div style={ERR}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
            {error}
          </div>
        )}
        <button type="submit" disabled={loading || code.length < 6}
          style={{ ...BTN, opacity: loading || code.length < 6 ? 0.6 : 1, cursor: loading || code.length < 6 ? 'not-allowed' : 'pointer' }}>
          {loading ? 'Verificando...' : mode === 'enroll' ? 'Activar y entrar →' : 'Verificar →'}
        </button>
        {mode === 'verify' && (
          <p style={{ fontSize: '0.75rem', color: '#94a3b8', textAlign: 'center' }}>
            ¿Perdiste el teléfono? Escribe aquí uno de tus <strong>códigos de respaldo</strong>.
          </p>
        )}
      </form>
    </div>
  )
}
