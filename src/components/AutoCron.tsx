'use client'

// Dispara las tareas periódicas del CRM (sync de calendario, campañas
// programadas, respaldo) al navegar. Vive en el layout: cualquier página
// sirve de disparador. El servidor decide si ya toca (freno de 3 minutos),
// así que montarse muchas veces no repite trabajo.
//
// Existe porque las tareas programadas de Netlify dejaron de ejecutarse en
// silencio (ver src/app/api/cron/auto/route.ts). Fire-and-forget: si falla,
// los avisos del panel (respaldo caído, etc.) ya se encargan de contarlo.

import { useEffect } from 'react'

export default function AutoCron() {
  useEffect(() => {
    fetch('/api/cron/auto', { method: 'POST' }).catch(() => {})
  }, [])
  return null
}
