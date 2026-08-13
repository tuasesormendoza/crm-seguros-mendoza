// Netlify Scheduled Function — sincronización Google Calendar → CRM.
//
// Cada 3 minutos llama al endpoint interno /api/google/sync-cron, que trae los
// cambios de Google Calendar de todas las cuentas conectadas y los aplica al
// CRM. El sentido inverso (CRM → Google) ocurre en tiempo real al crear/editar.

import { callCron } from './_cron.mts'

export default async () => callCron('google-sync', '/api/google/sync-cron')

export const config = {
  schedule: '*/3 * * * *',
}
