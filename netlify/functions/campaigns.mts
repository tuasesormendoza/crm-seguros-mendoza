// Netlify Scheduled Function — campañas programadas y automáticas.
//
// Cada 30 minutos llama a /api/campaigns/cron, que envía las campañas
// PROGRAMADAS cuya hora ya pasó y dispara las AUTOMATIZACIONES (cumpleaños,
// renovación, bienvenida). El anti-duplicado vive en el servidor.
//
// Protegido por la clave derivada del SESSION_SECRET; aquí la recalculamos.

import { createHash } from 'node:crypto'

export default async () => {
  const base = process.env.URL || process.env.DEPLOY_PRIME_URL || ''
  const secret = process.env.SESSION_SECRET || ''
  if (!base || !secret) return new Response('faltan URL o SESSION_SECRET', { status: 500 })

  const key = createHash('sha256').update(`${secret}:google-sync`).digest('hex')
  try {
    const res = await fetch(`${base}/api/campaigns/cron`, {
      method: 'POST',
      headers: { 'x-cron-key': key },
    })
    return new Response(`campaigns → ${res.status}: ${await res.text()}`)
  } catch {
    return new Response('campaigns failed', { status: 502 })
  }
}

export const config = {
  schedule: '*/30 * * * *', // cada 30 minutos
}
