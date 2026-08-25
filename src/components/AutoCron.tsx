'use client'

// Tareas de fondo del CRM, disparadas por el USO (las tareas programadas de
// Netlify dejaron de ejecutarse en silencio — ver src/app/api/cron/auto).
//
// Hace dos cosas mientras el CRM está abierto:
//
// 1. /api/cron/auto al montar: sync de calendario, campañas programadas y
//    respaldo, si tocan. El servidor tiene el freno; montarse mucho no repite.
//
// 2. Mantener DESPIERTA la base de datos. El plan de Neon la suspende a los
//    ~5 minutos de inactividad y despertarla cuesta 1-3 segundos: esa es la
//    lentitud que se siente al volver al CRM tras un rato. Antes lo evitaba
//    la función keepalive de Netlify (cada 4 min); muerta esa, lo hace el
//    propio navegador mientras haya una pestaña abierta:
//      • un ping ligero cada 4 minutos, y
//      • un ping INMEDIATO al volver a la pestaña (visibilitychange): así la
//        base despierta mientras el agente mira la pantalla, y su primer clic
//        ya la encuentra lista.
//    Con la pestaña cerrada no hay quien pinge: el primer arranque de la
//    mañana será frío una vez, y de ahí en adelante todo va caliente.

import { useEffect } from 'react'

const PING_MS = 4 * 60 * 1000

export default function AutoCron() {
  useEffect(() => {
    fetch('/api/cron/auto', { method: 'POST' }).catch(() => {})

    const ping = () => { fetch('/api/ping').catch(() => {}) }
    const interval = setInterval(ping, PING_MS)

    // Al volver a la pestaña tras estar en otra cosa, calentar de inmediato.
    const onVisible = () => { if (document.visibilityState === 'visible') ping() }
    document.addEventListener('visibilitychange', onVisible)

    return () => {
      clearInterval(interval)
      document.removeEventListener('visibilitychange', onVisible)
    }
  }, [])
  return null
}
