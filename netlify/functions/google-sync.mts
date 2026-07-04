// Netlify Scheduled Function — sincronización Google Calendar → CRM.
//
// Cada 3 minutos llama al endpoint interno /api/google/sync-cron, que trae los
// cambios de Google Calendar de todas las cuentas conectadas y los aplica al
// CRM (crea/actualiza/borra eventos con source='google'). El sentido inverso
// (CRM → Google) ocurre en tiempo real al crear/editar en el CRM.
//
// El endpoint está protegido por una clave derivada del SESSION_SECRET; aquí la
// recalculamos para autenticar la llamada sin exponer el secreto en crudo.

import { createHash } from 'node:crypto'

export default async () => {
  const base = process.env.URL || process.env.DEPLOY_PRIME_URL || ''
  const secret = process.env.SESSION_SECRET || ''
  if (!base || !secret) return new Response('faltan URL o SESSION_SECRET', { status: 500 })

  const key = createHash('sha256').update(`${secret}:google-sync`).digest('hex')
  try {
    const res = await fetch(`${base}/api/google/sync-cron`, {
      method: 'POST',
      headers: { 'x-cron-key': key },
    })
    return new Response(`google-sync → ${res.status}: ${await res.text()}`)
  } catch {
    return new Response('google-sync failed', { status: 502 })
  }
}

export const config = {
  schedule: '*/3 * * * *',
}
