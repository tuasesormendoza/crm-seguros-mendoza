// Netlify Scheduled Function — campañas programadas y automáticas.
//
// Cada 30 minutos llama a /api/campaigns/cron, que envía las campañas cuya hora
// programada ya pasó y dispara las automáticas (cumpleaños, renovación,
// bienvenida) sin repetir envíos.

import { callCron } from './_cron.mts'

export default async () => callCron('campaigns', '/api/campaigns/cron')

export const config = {
  schedule: '*/30 * * * *',
}
