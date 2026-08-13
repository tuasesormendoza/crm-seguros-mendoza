// ─────────────────────────────────────────────────────────────────────────────
// SALUD DEL RESPALDO AUTOMÁTICO
//
// El respaldo diario a Google Drive estuvo caído 30 días sin que nadie se
// enterara: la pantalla seguía mostrando el último respaldo BUENO (de hace un
// mes) como si todo fuera bien. Un respaldo que falla en silencio es peor que
// no tener respaldo, porque da falsa tranquilidad.
//
// Aquí se decide cuándo hay que dar la alarma. Se avisa por DOS motivos
// distintos, porque se arreglan de forma distinta:
//   • el último intento FALLÓ            → casi siempre hay que reconectar Google
//   • hace demasiado que no hay intento  → la tarea programada no está corriendo
// ─────────────────────────────────────────────────────────────────────────────

/** Horas sin un respaldo correcto a partir de las cuales se avisa. */
export const STALE_HOURS = 48

/** A partir de estas horas sin respaldo, la propia app lo dispara. */
export const AUTO_AFTER_HOURS = 20

/**
 * Espera mínima entre intentos automáticos. Evita que, si el respaldo está
 * fallando, cada carga del panel lance uno nuevo y se martillee a Google.
 */
export const RETRY_AFTER_MIN = 30

export interface LastBackup {
  at: string
  ok: boolean
  fileName?: string | null
  error?: string | null
}

export type BackupState = 'ok' | 'failed' | 'stale' | 'never'

export interface BackupHealth {
  state: BackupState
  /** Horas desde el último intento (null si nunca hubo uno). */
  hoursAgo: number | null
  /** Mensaje corto y accionable, listo para mostrar. */
  message: string
  /** true cuando hay que enseñarlo en rojo y sin que el usuario lo busque. */
  alarm: boolean
}

function human(hours: number): string {
  if (hours < 1) return 'hace menos de una hora'
  if (hours < 24) return `hace ${Math.round(hours)} h`
  const days = Math.round(hours / 24)
  return `hace ${days} día${days === 1 ? '' : 's'}`
}

export function backupHealth(last: LastBackup | null, now: Date = new Date()): BackupHealth {
  if (!last?.at) {
    return {
      state: 'never', hoursAgo: null, alarm: true,
      message: 'Nunca se ha hecho un respaldo automático en Google Drive.',
    }
  }

  const at = new Date(last.at)
  if (isNaN(at.getTime())) {
    return {
      state: 'never', hoursAgo: null, alarm: true,
      message: 'No se puede leer la fecha del último respaldo.',
    }
  }

  const hoursAgo = (now.getTime() - at.getTime()) / 36e5

  // Un intento fallido es alarma inmediata, sin esperar a que se ponga viejo.
  if (!last.ok) {
    return {
      state: 'failed', hoursAgo, alarm: true,
      message: `El último intento de respaldo falló (${human(hoursAgo)}). ${
        (last.error || '').includes('invalid_grant')
          ? 'El permiso de Google caducó: ve a Configuración → Integraciones y Respaldo, pulsa "Desconectar" y vuelve a conectar.'
          : last.error || 'Sin detalle del error.'
      }`,
    }
  }

  if (hoursAgo > STALE_HOURS) {
    return {
      state: 'stale', hoursAgo, alarm: true,
      message: `El último respaldo correcto fue ${human(hoursAgo)}. Debería hacerse a diario, así que el respaldo automático NO está corriendo.`,
    }
  }

  return {
    state: 'ok', hoursAgo, alarm: false,
    message: `Último respaldo ${human(hoursAgo)}.`,
  }
}

/**
 * ¿Debe la propia aplicación disparar el respaldo ahora?
 *
 * La tarea programada de Netlify aparece como activa pero no está surtiendo
 * efecto: entre el 05/08 y el 13/08/2026 no produjo ni un respaldo (todos los
 * que hay son de pulsar el botón a mano). Un respaldo que depende de una sola
 * pieza que puede fallar en silencio no es un respaldo.
 *
 * Así que el CRM también lo dispara solo: cuando el agente entra y ve que ya
 * toca, se hace. Como usa el CRM a diario, hay copia a diario aunque la tarea
 * programada nunca se arregle.
 *
 * `lastAttempt` es el último INTENTO (salga bien o mal) y sirve de freno: sin
 * él, con el respaldo fallando, cada carga del panel lanzaría otro intento.
 */
export function shouldAutoBackup(
  last: LastBackup | null,
  lastAttempt: string | null | undefined,
  now: Date = new Date(),
): boolean {
  if (lastAttempt) {
    const t = new Date(lastAttempt)
    if (!isNaN(t.getTime()) && now.getTime() - t.getTime() < RETRY_AFTER_MIN * 60_000) return false
  }

  if (!last?.at) return true              // nunca se ha respaldado
  const at = new Date(last.at)
  if (isNaN(at.getTime())) return true    // fecha corrupta: mejor respaldar
  if (!last.ok) return true               // el último falló; se reintenta (con el freno de arriba)

  return (now.getTime() - at.getTime()) / 36e5 >= AUTO_AFTER_HOURS
}
