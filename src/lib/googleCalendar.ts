// ─────────────────────────────────────────────────────────────────────────────
// Llamadas de bajo nivel a la API de Google Calendar (eventos).
// Todas reciben un access token ya válido (ver getValidAccessToken).
// ─────────────────────────────────────────────────────────────────────────────

const API = 'https://www.googleapis.com/calendar/v3'
const TIME_ZONE = 'America/New_York'
const DEFAULT_DURATION_MIN = 30

export interface CrmEventPayload {
  title: string
  date: Date          // fecha/hora de inicio
  notes?: string | null
  durationMin?: number
}

// Convierte un registro del CRM al formato de evento de Google (evento con hora).
function toGoogleEvent(p: CrmEventPayload) {
  const start = p.date
  const end = new Date(start.getTime() + (p.durationMin ?? DEFAULT_DURATION_MIN) * 60_000)
  return {
    summary: p.title,
    description: p.notes || undefined,
    start: { dateTime: start.toISOString(), timeZone: TIME_ZONE },
    end: { dateTime: end.toISOString(), timeZone: TIME_ZONE },
  }
}

// Crea un evento en Google y devuelve su id.
export async function insertGoogleEvent(accessToken: string, calendarId: string, p: CrmEventPayload): Promise<string> {
  const res = await fetch(`${API}/calendars/${encodeURIComponent(calendarId)}/events`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(toGoogleEvent(p)),
  })
  if (!res.ok) throw new Error(`insertGoogleEvent ${res.status}: ${await res.text()}`)
  const data = await res.json() as { id: string }
  return data.id
}

// Actualiza (reemplaza) un evento existente en Google.
export async function patchGoogleEvent(accessToken: string, calendarId: string, googleEventId: string, p: CrmEventPayload): Promise<void> {
  const res = await fetch(`${API}/calendars/${encodeURIComponent(calendarId)}/events/${googleEventId}`, {
    method: 'PATCH',
    headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(toGoogleEvent(p)),
  })
  // 404/410 = el evento ya no existe en Google; lo tratamos como "nada que hacer"
  if (!res.ok && res.status !== 404 && res.status !== 410) {
    throw new Error(`patchGoogleEvent ${res.status}: ${await res.text()}`)
  }
}

// Borra un evento en Google. 404/410 = ya no existe (ok).
export async function deleteGoogleEvent(accessToken: string, calendarId: string, googleEventId: string): Promise<void> {
  const res = await fetch(`${API}/calendars/${encodeURIComponent(calendarId)}/events/${googleEventId}`, {
    method: 'DELETE',
    headers: { Authorization: `Bearer ${accessToken}` },
  })
  if (!res.ok && res.status !== 404 && res.status !== 410) {
    throw new Error(`deleteGoogleEvent ${res.status}: ${await res.text()}`)
  }
}

export interface GoogleEventItem {
  id: string
  status: string                 // 'confirmed' | 'cancelled' | ...
  summary?: string
  description?: string
  start?: { dateTime?: string; date?: string }
  end?: { dateTime?: string; date?: string }
}

interface ListResult {
  items: GoogleEventItem[]
  nextSyncToken?: string
}

// Lista cambios de eventos. Con syncToken hace sincronización incremental (solo
// lo que cambió). Sin él, trae desde `timeMin` y devuelve un nuevo syncToken.
// Si el syncToken expiró (410), Google exige resincronizar desde cero: se
// devuelve expired=true para que el llamador reintente sin token.
export async function listGoogleEvents(
  accessToken: string,
  calendarId: string,
  opts: { syncToken?: string | null; timeMin?: Date }
): Promise<ListResult & { expired?: boolean }> {
  const items: GoogleEventItem[] = []
  let pageToken: string | undefined
  let nextSyncToken: string | undefined

  do {
    const params = new URLSearchParams({ singleEvents: 'true', maxResults: '250' })
    if (opts.syncToken) params.set('syncToken', opts.syncToken)
    else if (opts.timeMin) params.set('timeMin', opts.timeMin.toISOString())
    if (pageToken) params.set('pageToken', pageToken)

    const res = await fetch(`${API}/calendars/${encodeURIComponent(calendarId)}/events?${params}`, {
      headers: { Authorization: `Bearer ${accessToken}` },
    })
    if (res.status === 410) return { items: [], expired: true } // syncToken caducó
    if (!res.ok) throw new Error(`listGoogleEvents ${res.status}: ${await res.text()}`)

    const data = await res.json() as { items?: GoogleEventItem[]; nextPageToken?: string; nextSyncToken?: string }
    if (data.items) items.push(...data.items)
    pageToken = data.nextPageToken
    if (data.nextSyncToken) nextSyncToken = data.nextSyncToken
  } while (pageToken)

  return { items, nextSyncToken }
}
