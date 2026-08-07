'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import {
  REQUIRED_PROFILE_FIELDS,
  missingProfileFields,
  type ProfileField,
} from '@/lib/agentProfile'

// Aviso de "completa tu perfil". Aparece donde el CRM iba a escribir en nombre
// de la agencia y todavía no sabe quién es. Es preferible este hueco visible a
// rellenarlo con los datos de otro agente (ver src/lib/agentProfile.ts).

interface Props {
  /** Configuración ya cargada. Si no se pasa, el aviso la pide él mismo. */
  settings?: Record<string, string>
  /** Campos a exigir. Por defecto, solo los imprescindibles. */
  fields?: ProfileField[]
  /** Frase que explica para qué hacen falta AQUÍ. */
  context?: string
  className?: string
}

export default function ProfileNotice({ settings, fields = REQUIRED_PROFILE_FIELDS, context, className = '' }: Props) {
  // Solo se pide la configuración cuando no nos la han pasado ya hecha.
  const [fetched, setFetched] = useState<Record<string, string> | null>(null)

  useEffect(() => {
    if (settings) return
    fetch('/api/settings').then(r => r.json()).then(setFetched).catch(() => setFetched({}))
  }, [settings])

  const loaded = settings ?? fetched

  // Mientras no se sabe, no se avisa: un parpadeo de alarma falsa asusta más
  // de lo que ayuda.
  if (!loaded) return null

  const missing = missingProfileFields(loaded, fields)
  if (missing.length === 0) return null

  return (
    <div className={`rounded-xl p-4 ${className}`} style={{ background: '#fffbeb', border: '1px solid #fde68a' }}>
      <div className="flex items-start gap-3">
        <span className="text-lg leading-none mt-0.5">⚠️</span>
        <div className="min-w-0">
          <p className="text-sm font-semibold" style={{ color: '#92400e' }}>Completa tu perfil</p>
          <p className="text-xs mt-1" style={{ color: '#b45309' }}>
            {context || 'El CRM todavía no sabe con qué datos firmar lo que envía en tu nombre.'} Falta:
          </p>
          <ul className="text-xs mt-1.5 space-y-0.5" style={{ color: '#b45309' }}>
            {missing.map(f => (
              <li key={f.key}>• <strong>{f.label}</strong> — {f.usedFor}</li>
            ))}
          </ul>
          <Link href="/settings" className="text-xs font-semibold underline mt-2 inline-block" style={{ color: '#92400e' }}>
            Ir a Configuración → Perfil del Agente →
          </Link>
        </div>
      </div>
    </div>
  )
}
