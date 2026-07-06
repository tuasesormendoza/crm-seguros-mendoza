// Netlify Scheduled Function — respaldo automático a Google Drive.
//
// Una vez al día llama al endpoint interno /api/google/backup-cron, que exporta
// los datos de cada agencia con Google conectado y sube un JSON a su carpeta
// "CRM Seguros - Backups" en Drive (conservando los últimos 30).
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
    const res = await fetch(`${base}/api/google/backup-cron`, {
      method: 'POST',
      headers: { 'x-cron-key': key },
    })
    return new Response(`drive-backup → ${res.status}: ${await res.text()}`)
  } catch {
    return new Response('drive-backup failed', { status: 502 })
  }
}

export const config = {
  schedule: '0 8 * * *', // diario ~08:00 UTC (madrugada en horario del Este)
}
