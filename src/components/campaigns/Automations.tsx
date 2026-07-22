'use client'

// Campañas AUTOMÁTICAS: cumpleaños, renovación y bienvenida. Cada una se activa
// con un interruptor y tiene su propio asunto/mensaje/botón. Se disparan solas
// en el servidor (ver src/lib/campaignEngine.ts).

import { useEffect, useState } from 'react'

interface Auto {
  type: string; enabled: boolean; subject: string; message: string
  buttonText: string; buttonUrl: string; daysBefore: number
}

const TYPES = ['birthday', 'renewal', 'welcome'] as const
const META: Record<string, { icon: string; name: string; desc: string }> = {
  birthday: { icon: '🎂', name: 'Cumpleaños', desc: 'Se envía el día del cumpleaños de cada cliente activo.' },
  renewal: { icon: '🔄', name: 'Renovación', desc: 'Se envía cierta cantidad de días antes de la renovación de la póliza.' },
  welcome: { icon: '👋', name: 'Bienvenida', desc: 'Se envía automáticamente al registrar un cliente nuevo.' },
}
const DEFAULTS: Record<string, { subject: string; message: string }> = {
  birthday: { subject: '¡Feliz cumpleaños, {nombre}! 🎉', message: '¡Hola {nombre}!\n\nTodo mi equipo te desea un muy feliz cumpleaños. 🎂 Que tengas un año lleno de salud y bendiciones.\n\nGracias por confiar en nosotros para cuidar tu bienestar.' },
  renewal: { subject: '{nombre}, se acerca tu renovación', message: 'Hola {nombre},\n\nSe acerca la renovación de tu póliza {plan} con {aseguradora}. Quiero ayudarte a revisar que sigas con la mejor cobertura y el mejor precio.\n\nEscríbeme y lo vemos juntos.' },
  welcome: { subject: '¡Bienvenido/a, {nombre}!', message: 'Hola {nombre},\n\n¡Gracias por confiar en mí como tu agente de seguros! Estoy aquí para ayudarte en todo lo que necesites. Guarda mi contacto y escríbeme cuando quieras.' },
}

const INPUT = 'w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#507b88] bg-white'
const LABEL = 'block text-xs font-semibold text-gray-600 mb-1'

function blank(type: string): Auto {
  return { type, enabled: false, subject: DEFAULTS[type].subject, message: DEFAULTS[type].message, buttonText: '', buttonUrl: '', daysBefore: 30 }
}

export default function Automations() {
  const [autos, setAutos] = useState<Record<string, Auto>>(() => Object.fromEntries(TYPES.map(t => [t, blank(t)])))
  const [saving, setSaving] = useState('')
  const [msg, setMsg] = useState<Record<string, string>>({})

  useEffect(() => {
    fetch('/api/automations').then(r => r.json()).then((rows: Auto[]) => {
      if (!Array.isArray(rows)) return
      setAutos(prev => {
        const next = { ...prev }
        for (const r of rows) {
          if (!next[r.type]) continue
          next[r.type] = {
            type: r.type, enabled: !!r.enabled,
            subject: r.subject || DEFAULTS[r.type].subject,
            message: r.message || DEFAULTS[r.type].message,
            buttonText: r.buttonText || '', buttonUrl: r.buttonUrl || '',
            daysBefore: r.daysBefore || 30,
          }
        }
        return next
      })
    }).catch(() => {})
  }, [])

  function set(type: string, patch: Partial<Auto>) {
    setAutos(prev => ({ ...prev, [type]: { ...prev[type], ...patch } }))
  }

  async function save(type: string) {
    setSaving(type); setMsg(m => ({ ...m, [type]: '' }))
    const a = autos[type]
    try {
      const res = await fetch('/api/automations', {
        method: 'PUT', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(a),
      })
      const data = await res.json()
      setMsg(m => ({ ...m, [type]: res.ok ? '✅ Guardado' : `❌ ${data.error || 'Error'}` }))
      if (res.ok) setTimeout(() => setMsg(m => ({ ...m, [type]: '' })), 3000)
    } catch {
      setMsg(m => ({ ...m, [type]: '❌ No se pudo guardar' }))
    }
    setSaving('')
  }

  return (
    <div className="bg-white rounded-xl border border-gray-200 p-4 md:p-6">
      <h2 className="font-bold text-base mb-1" style={{ color: '#10253f' }}>🤖 Campañas automáticas</h2>
      <p className="text-xs text-gray-500 mb-4">
        Actívalas una vez y se envían solas: el cumpleaños de cada cliente, X días antes de su renovación, o al registrar un cliente nuevo. Personalizadas con {'{nombre}'}, {'{aseguradora}'}, {'{plan}'}, etc. Cada cliente la recibe una sola vez por evento.
      </p>

      <div className="space-y-4">
        {TYPES.map(type => {
          const a = autos[type]
          const m = META[type]
          return (
            <div key={type} className="rounded-xl border p-4" style={{ borderColor: a.enabled ? '#a7f3d0' : '#e5e7eb', background: a.enabled ? '#f0fdf4' : '#fff' }}>
              <div className="flex items-start justify-between gap-3 mb-2">
                <div>
                  <div className="font-semibold text-sm" style={{ color: '#10253f' }}>{m.icon} {m.name}</div>
                  <div className="text-xs text-gray-500 mt-0.5">{m.desc}</div>
                </div>
                <button type="button" onClick={() => set(type, { enabled: !a.enabled })}
                  className="relative inline-flex h-6 w-11 items-center rounded-full transition-colors shrink-0"
                  style={{ background: a.enabled ? '#10b981' : '#cbd5e1' }}>
                  <span className="inline-block h-4 w-4 transform rounded-full bg-white transition-transform shadow"
                    style={{ transform: a.enabled ? 'translateX(22px)' : 'translateX(2px)' }} />
                </button>
              </div>

              <div className="space-y-2 mt-3">
                {type === 'renewal' && (
                  <div className="flex items-center gap-2">
                    <label className="text-xs text-gray-600">Enviar</label>
                    <input type="number" min={1} max={120} value={a.daysBefore}
                      onChange={e => set(type, { daysBefore: parseInt(e.target.value) || 0 })}
                      className="w-20 border border-gray-300 rounded-lg px-2 py-1 text-sm" />
                    <label className="text-xs text-gray-600">días antes de la renovación</label>
                  </div>
                )}
                <div>
                  <label className={LABEL}>Asunto</label>
                  <input className={INPUT} value={a.subject} onChange={e => set(type, { subject: e.target.value })} />
                </div>
                <div>
                  <label className={LABEL}>Mensaje</label>
                  <textarea className={INPUT} rows={4} value={a.message} onChange={e => set(type, { message: e.target.value })} />
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  <input className={INPUT} value={a.buttonText} onChange={e => set(type, { buttonText: e.target.value })} placeholder="Botón (opcional): Escríbeme" />
                  <input className={INPUT} value={a.buttonUrl} onChange={e => set(type, { buttonUrl: e.target.value })} placeholder="Enlace del botón: https://..." />
                </div>
                <div className="flex items-center gap-3 pt-1">
                  <button onClick={() => save(type)} disabled={saving === type}
                    className="text-xs px-4 py-2 rounded-lg text-white font-semibold disabled:opacity-50" style={{ background: '#2a6496' }}>
                    {saving === type ? 'Guardando...' : 'Guardar'}
                  </button>
                  {msg[type] && <span className="text-xs" style={{ color: msg[type].startsWith('✅') ? '#059669' : '#b91c1c' }}>{msg[type]}</span>}
                </div>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
