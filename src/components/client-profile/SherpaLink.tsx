'use client'

import { useState } from 'react'

// ── HealthSherpa inline link ─────────────────────────────────────────────────

export default function SherpaLink({ clientId, initialUrl, onSaved }: {
  clientId: string | null
  initialUrl?: string | null
  onSaved: (url: string | null) => void
}) {
  const [editing, setEditing] = useState(false)
  const [url, setUrl] = useState(initialUrl || '')
  const [saving, setSaving] = useState(false)

  async function save() {
    if (!clientId) return
    setSaving(true)
    await fetch(`/api/clients/${clientId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ sherpaUrl: url || null }),
    })
    setSaving(false)
    setEditing(false)
    onSaved(url || null)
  }

  return (
    <div>
      <dt className="text-xs font-medium uppercase tracking-wide mb-1.5" style={{ color: '#507b88' }}>HealthSherpa</dt>
      {editing ? (
        <div className="flex gap-2">
          <input
            autoFocus
            type="url"
            value={url}
            onChange={e => setUrl(e.target.value)}
            placeholder="https://www.healthsherpa.com/agents/..."
            className="flex-1 text-xs border rounded-lg px-2.5 py-1.5 outline-none"
            style={{ borderColor: '#4a90b8', background: '#f0f7fb', color: '#0f172a' }}
            onKeyDown={e => { if (e.key === 'Enter') save(); if (e.key === 'Escape') setEditing(false) }}
          />
          <button onClick={save} disabled={saving}
            className="px-3 py-1.5 rounded-lg text-xs font-semibold text-white disabled:opacity-50"
            style={{ background: '#2a6496' }}>
            {saving ? '...' : 'Guardar'}
          </button>
          <button onClick={() => { setEditing(false); setUrl(initialUrl || '') }}
            className="px-3 py-1.5 rounded-lg text-xs border"
            style={{ color: '#64748b', borderColor: '#e2e8f0' }}>
            Cancelar
          </button>
        </div>
      ) : (
        <div className="flex items-center gap-2">
          {url ? (
            <>
              <a href={url} target="_blank" rel="noopener noreferrer"
                className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm font-semibold text-white transition-all hover:opacity-90"
                style={{ background: 'linear-gradient(135deg, #16a34a, #15803d)', boxShadow: '0 2px 6px rgba(22,163,74,.3)' }}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/>
                  <polyline points="15 3 21 3 21 9"/>
                  <line x1="10" y1="14" x2="21" y2="3"/>
                </svg>
                Abrir en Sherpa
              </a>
              <button onClick={() => setEditing(true)}
                className="text-xs px-2 py-1.5 rounded-lg border transition-colors hover:bg-gray-50"
                style={{ color: '#64748b', borderColor: '#e2e8f0' }}>
                ✏️ Editar
              </button>
            </>
          ) : (
            <button onClick={() => setEditing(true)}
              className="inline-flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg border transition-colors hover:bg-gray-50"
              style={{ color: '#64748b', borderColor: '#e2e8f0', borderStyle: 'dashed' }}>
              + Agregar link de Sherpa
            </button>
          )}
        </div>
      )}
    </div>
  )
}
