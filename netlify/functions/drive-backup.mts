// Netlify Scheduled Function — respaldo automático a Google Drive.
//
// Una vez al día llama al endpoint interno /api/google/backup-cron, que exporta
// los datos de cada agencia con Google conectado y sube un JSON a su carpeta de
// respaldos en Drive (conservando los últimos 30).
//
// Toda la lógica —URL del sitio, clave y registro— está en _cron.mts, para que
// las cuatro tareas fallen y se diagnostiquen igual.

import { callCron } from './_cron.mts'

export default async () => callCron('drive-backup', '/api/google/backup-cron')

export const config = {
  schedule: '0 8 * * *', // diario ~08:00 UTC (madrugada en horario del Este)
}
