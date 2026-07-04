// ─────────────────────────────────────────────────────────────────────────────
// Sincronización de dos vías CRM ⇄ Google Calendar.
//
// PUSH (CRM → Google): al crear/editar/borrar una cita o evento, se refleja en
//   el Google Calendar de cada cuenta conectada de la agencia. El mapeo se
//   guarda en GoogleEventLink para poder actualizar/borrar el espejo correcto.
//
// PULL (Google → CRM): una función programada trae los cambios de Google y crea/
//   actualiza/borra los CalendarEvent con source='google'. Los eventos que el
//   propio CRM empujó a Google (tienen link) se ignoran para no duplicar (evita
//   el "eco").
//
// Regla de oro: si Google falla, NUNCA se rompe la operación del CRM — todo va
// envuelto en try/catch y los errores solo se registran.
// ─────────────────────────────────────────────────────────────────────────────

import { prisma } from '@/lib/prisma'
import { getValidAccessToken } from '@/lib/google'
import {
  insertGoogleEvent, patchGoogleEvent, deleteGoogleEvent, listGoogleEvents,
  type CrmEventPayload,
} from '@/lib/googleCalendar'

type Kind = 'event' | 'appointment'

// ── PUSH ─────────────────────────────────────────────────────────────────────

// Refleja en Google (crear o actualizar) un registro del CRM, en todas las
// cuentas conectadas de la agencia. Seguro de llamar aunque no haya ninguna.
export async function pushToGoogle(agencyId: string | null | undefined, kind: Kind, crmId: string, payload: CrmEventPayload): Promise<void> {
  if (!agencyId) return
  const accounts = await prisma.googleAccount.findMany({ where: { agencyId } }).catch(() => [])
  for (const acct of accounts) {
    try {
      const token = await getValidAccessToken(acct)
      const link = await prisma.googleEventLink.findUnique({
        where: { googleAccountId_kind_crmId: { googleAccountId: acct.id, kind, crmId } },
      })
      if (link) {
        await patchGoogleEvent(token, acct.calendarId, link.googleEventId, payload)
      } else {
        const googleEventId = await insertGoogleEvent(token, acct.calendarId, payload)
        await prisma.googleEventLink.create({
          data: { agencyId, googleAccountId: acct.id, kind, crmId, googleEventId },
        })
      }
    } catch (err) {
      console.error(`pushToGoogle (${kind} ${crmId}) falló para la cuenta ${acct.id}:`, err)
    }
  }
}

// Borra en Google el espejo de un registro del CRM que se eliminó.
export async function deleteFromGoogle(agencyId: string | null | undefined, kind: Kind, crmId: string): Promise<void> {
  if (!agencyId) return
  const links = await prisma.googleEventLink.findMany({ where: { agencyId, kind, crmId } }).catch(() => [])
  for (const link of links) {
    try {
      const acct = await prisma.googleAccount.findUnique({ where: { id: link.googleAccountId } })
      if (acct) {
        const token = await getValidAccessToken(acct)
        await deleteGoogleEvent(token, acct.calendarId, link.googleEventId)
      }
    } catch (err) {
      console.error(`deleteFromGoogle (${kind} ${crmId}) falló:`, err)
    }
    await prisma.googleEventLink.delete({ where: { id: link.id } }).catch(() => {})
  }
}

// ── PULL ─────────────────────────────────────────────────────────────────────

function startDate(item: { start?: { dateTime?: string; date?: string } }): Date | null {
  const s = item.start?.dateTime || item.start?.date
  return s ? new Date(s) : null
}

// Ventana del barrido completo: últimos 7 días + todo el futuro. Cubre eventos
// creados ANTES de la primera sincronización (que un timeMin de "ahora" dejaría
// invisibles para siempre, porque el sync incremental solo ve cambios nuevos).
const FULL_SYNC_WINDOW_MS = 7 * 24 * 60 * 60 * 1000

// Trae los cambios de Google de UNA cuenta y los aplica al CRM.
// `full=true` ignora el syncToken y hace un barrido completo de la ventana —
// lo usa el botón "Sincronizar ahora" para recuperar eventos perdidos; el cron
// usa el modo incremental (barato). El mapeo en GoogleEventLink evita duplicados
// en ambos modos.
async function pullAccount(acct: {
  id: string; agencyId: string | null; calendarId: string; syncToken: string | null
  accessToken: string; refreshToken: string; expiresAt: Date
}, full = false): Promise<number> {
  const token = await getValidAccessToken(acct)
  const windowStart = new Date(Date.now() - FULL_SYNC_WINDOW_MS)

  let result = await listGoogleEvents(token, acct.calendarId, (!full && acct.syncToken)
    ? { syncToken: acct.syncToken }
    : { timeMin: windowStart })

  // Si el token incremental caducó, resincronizamos desde cero.
  if (result.expired) {
    result = await listGoogleEvents(token, acct.calendarId, { timeMin: windowStart })
  }

  let applied = 0
  for (const item of result.items) {
    // ¿Este evento de Google ya está mapeado a un registro del CRM?
    const link = await prisma.googleEventLink.findFirst({
      where: { googleAccountId: acct.id, googleEventId: item.id },
    })

    if (item.status === 'cancelled') {
      // Borrado en Google → si lo habíamos importado (evento origen 'google'),
      // borramos el CalendarEvent espejo en el CRM.
      if (link && link.kind === 'event') {
        await prisma.calendarEvent.deleteMany({ where: { id: link.crmId, agencyId: acct.agencyId, source: 'google' } })
        await prisma.googleEventLink.delete({ where: { id: link.id } }).catch(() => {})
        applied++
      }
      continue
    }

    // Evento que el propio CRM empujó a Google → ya existe aquí, no duplicar.
    if (link) {
      // Si es un evento importado de Google, mantenemos el CRM al día.
      if (link.kind === 'event') {
        const date = startDate(item)
        if (date) {
          await prisma.calendarEvent.updateMany({
            where: { id: link.crmId, agencyId: acct.agencyId, source: 'google' },
            data: { title: item.summary || '(sin título)', date, notes: item.description || null },
          })
        }
      }
      continue
    }

    // Evento nuevo creado directamente en Google → lo traemos al CRM.
    const date = startDate(item)
    if (!date) continue
    const created = await prisma.calendarEvent.create({
      data: {
        agencyId: acct.agencyId,
        title: item.summary || '(sin título)',
        date,
        notes: item.description || null,
        source: 'google',
        googleEventId: item.id,
      },
    })
    await prisma.googleEventLink.create({
      data: { agencyId: acct.agencyId, googleAccountId: acct.id, kind: 'event', crmId: created.id, googleEventId: item.id },
    })
    applied++
  }

  // Guardar el nuevo syncToken para la próxima sincronización incremental.
  if (result.nextSyncToken) {
    await prisma.googleAccount.update({ where: { id: acct.id }, data: { syncToken: result.nextSyncToken } })
  }
  return applied
}

// Sincroniza Google → CRM para las cuentas conectadas. Sin agencyId sincroniza
// TODAS (lo usa la función programada, modo incremental); con agencyId solo esa
// agencia. `full=true` fuerza el barrido completo de la ventana (botón
// "Sincronizar ahora"). Los errores por cuenta se devuelven para que el usuario
// los VEA en vez de quedar solo en el log del servidor.
export async function pullAccounts(agencyId?: string, opts?: { full?: boolean }): Promise<{ accounts: number; applied: number; errors: string[] }> {
  const accounts = await prisma.googleAccount.findMany({
    where: agencyId ? { agencyId } : undefined,
    select: { id: true, agencyId: true, calendarId: true, syncToken: true, accessToken: true, refreshToken: true, expiresAt: true, email: true },
  })
  let applied = 0
  const errors: string[] = []
  for (const acct of accounts) {
    try {
      applied += await pullAccount(acct, opts?.full)
    } catch (err) {
      console.error(`pullAccount ${acct.id} falló:`, err)
      errors.push(`${acct.email}: ${err instanceof Error ? err.message : 'error desconocido'}`)
    }
  }
  return { accounts: accounts.length, applied, errors }
}
