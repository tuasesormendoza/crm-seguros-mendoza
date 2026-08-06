'use client'

import { useEffect, useState, useCallback } from 'react'
import { INPUT, LABEL, SECTION, TITLE } from '@/components/settings/shared'

// ─────────────────────────────────────────────────────────────────────────────
// Entrada pública de leads: conecta la web de la agencia con el CRM.
// El agente genera su clave, indica desde qué dominios acepta leads y enciende
// la entrada. Cada agencia tiene lo suyo; nada de esto vive en el código.
// ─────────────────────────────────────────────────────────────────────────────

interface Config { key: string | null; origins: string; enabled: boolean }

export default function PublicIntakePanel() {
  const [cfg, setCfg] = useState<Config>({ key: null, origins: '', enabled: false })
  const [origins, setOrigins] = useState('')
  const [cargando, setCargando] = useState(true)
  const [guardando, setGuardando] = useState(false)
  const [copiado, setCopiado] = useState<string | null>(null)

  const cargar = useCallback(async () => {
    try {
      const r = await fetch('/api/settings/public-intake')
      if (r.ok) {
        const d = await r.json() as Config
        setCfg(d); setOrigins(d.origins || '')
      }
    } finally { setCargando(false) }
  }, [])

  useEffect(() => { cargar() }, [cargar])

  async function guardar(cambios: { enabled?: boolean; origins?: string; regenerate?: boolean }) {
    setGuardando(true)
    try {
      const r = await fetch('/api/settings/public-intake', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(cambios),
      })
      if (r.ok) {
        const d = await r.json() as Config
        setCfg(d); setOrigins(d.origins || '')
      }
    } finally { setGuardando(false) }
  }

  function copiar(texto: string, etiqueta: string) {
    navigator.clipboard.writeText(texto)
    setCopiado(etiqueta)
    setTimeout(() => setCopiado(null), 2000)
  }

  if (cargando) return null

  const snippet = `var CRM_URL = '${typeof window !== 'undefined' ? window.location.origin : ''}';
var CRM_KEY = '${cfg.key ?? 'genera-tu-clave-primero'}';`

  return (
    <div className={SECTION}>
      <h2 className={TITLE} style={{ color: '#10253f' }}>🔌 Entrada de leads desde tu web</h2>
      <p className="text-xs text-gray-500 mb-4">
        Permite que el formulario de tu página web cree prospectos aquí automáticamente,
        sin que tengas que copiarlos a mano.
      </p>

      {!cfg.key ? (
        <button
          onClick={() => guardar({})}
          disabled={guardando}
          className="rounded-lg px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
          style={{ background: '#429EBD' }}
        >
          {guardando ? 'Generando…' : 'Generar mi clave de conexión'}
        </button>
      ) : (
        <div className="space-y-4">

          <div>
            <label className={LABEL}>Tu clave de conexión</label>
            <div className="flex gap-2">
              <input className={INPUT} readOnly value={cfg.key} onFocus={e => e.target.select()} />
              <button type="button" onClick={() => copiar(cfg.key!, 'clave')}
                className="whitespace-nowrap rounded-lg border px-3 text-sm font-semibold"
                style={{ borderColor: '#429EBD', color: '#429EBD' }}>
                {copiado === 'clave' ? '✓ Copiada' : 'Copiar'}
              </button>
            </div>
            <p className="mt-1 text-xs text-gray-500">
              Esta clave <strong>no es una contraseña</strong>: va visible en el código de tu web y
              cualquiera puede leerla. Solo sirve para que los leads lleguen a tu cuenta y no a otra.
              Lo que de verdad protege es la lista de dominios de abajo.
            </p>
          </div>

          <div>
            <label className={LABEL}>Dominios autorizados</label>
            <div className="flex gap-2">
              <input className={INPUT} value={origins} onChange={e => setOrigins(e.target.value)}
                placeholder="miagencia.com, otrodominio.com" />
              <button type="button" onClick={() => guardar({ origins })} disabled={guardando}
                className="whitespace-nowrap rounded-lg px-3 text-sm font-semibold text-white disabled:opacity-50"
                style={{ background: '#429EBD' }}>
                Guardar
              </button>
            </div>
            <p className="mt-1 text-xs text-gray-500">
              Solo se aceptarán leads enviados desde estos dominios. Separa varios con comas.
              No hace falta poner <code>www.</code>: se acepta con y sin él.
            </p>
          </div>

          <div className="flex items-center justify-between rounded-lg border p-3"
            style={{ borderColor: cfg.enabled ? '#bbf7d0' : '#e5e7eb', background: cfg.enabled ? '#f0fdf4' : '#fafafa' }}>
            <div>
              <div className="text-sm font-semibold" style={{ color: '#10253f' }}>
                {cfg.enabled ? 'Entrada activada' : 'Entrada desactivada'}
              </div>
              <div className="text-xs text-gray-500">
                {cfg.enabled
                  ? 'Tu web puede crear prospectos en el CRM.'
                  : 'Actívala cuando tu web esté lista. Mientras, se rechaza todo.'}
              </div>
            </div>
            <button onClick={() => guardar({ enabled: !cfg.enabled, origins })}
              disabled={guardando || (!cfg.enabled && !origins.trim())}
              className="rounded-lg px-4 py-2 text-sm font-semibold text-white disabled:opacity-40"
              style={{ background: cfg.enabled ? '#dc2626' : '#16a34a' }}>
              {cfg.enabled ? 'Desactivar' : 'Activar'}
            </button>
          </div>
          {!cfg.enabled && !origins.trim() && (
            <p className="text-xs" style={{ color: '#b45309' }}>
              Añade al menos un dominio autorizado antes de activar la entrada.
            </p>
          )}

          <div>
            <label className={LABEL}>Configuración para tu web</label>
            <pre className="overflow-x-auto rounded-lg border p-3 text-xs"
              style={{ background: '#0D2A4A', color: '#e6edf3', borderColor: '#0D2A4A' }}>{snippet}</pre>
            <button type="button" onClick={() => copiar(snippet, 'snippet')}
              className="mt-2 text-xs font-semibold" style={{ color: '#429EBD' }}>
              {copiado === 'snippet' ? '✓ Copiado' : 'Copiar configuración'}
            </button>
            <p className="mt-1 text-xs text-gray-500">
              Pega esto en el archivo <code>js/crm-config.js</code> de tu página web.
            </p>
          </div>

          <details className="text-xs text-gray-500">
            <summary className="cursor-pointer font-semibold">Rotar la clave</summary>
            <p className="mt-2">
              Si sospechas que alguien está enviando leads falsos, genera una clave nueva.
              La anterior deja de funcionar al instante y tendrás que actualizar tu web.
            </p>
            <button onClick={() => guardar({ regenerate: true, origins })} disabled={guardando}
              className="mt-2 rounded-lg border px-3 py-1.5 font-semibold disabled:opacity-50"
              style={{ borderColor: '#dc2626', color: '#dc2626' }}>
              Generar clave nueva
            </button>
          </details>

        </div>
      )}
    </div>
  )
}
