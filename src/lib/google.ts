// ─────────────────────────────────────────────────────────────────────────────
// Cliente de Google Calendar (OAuth 2.0 + API de eventos).
//
// La app usa un único par de credenciales (GOOGLE_CLIENT_ID / GOOGLE_CLIENT_SECRET,
// en las variables de entorno de Netlify), pero CADA usuario conecta su PROPIA
// cuenta de Google: se guarda un GoogleAccount por usuario con sus tokens
// CIFRADOS. Aquí viven el flujo OAuth y el helper que garantiza un access token
// válido (refrescándolo cuando expira).
// ─────────────────────────────────────────────────────────────────────────────

import { prisma } from '@/lib/prisma'
import { encrypt, decrypt } from '@/lib/encrypt'

// Permisos solicitados: leer/escribir eventos del calendario + el email de la
// cuenta conectada (para mostrar "Conectado como ...").
const SCOPES = [
  'https://www.googleapis.com/auth/calendar.events',
  'https://www.googleapis.com/auth/userinfo.email',
]

export function googleConfigured(): boolean {
  return !!(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET)
}

function credentials() {
  const clientId = process.env.GOOGLE_CLIENT_ID
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET
  if (!clientId || !clientSecret) {
    throw new Error('Google no está configurado: faltan GOOGLE_CLIENT_ID / GOOGLE_CLIENT_SECRET en las variables de entorno.')
  }
  return { clientId, clientSecret }
}

// La URI de redirección se deriva del origen de la petición para que funcione
// igual en local (localhost:3000) y en producción (Netlify). DEBE coincidir
// exactamente con una de las URIs registradas en Google Cloud.
export function redirectUri(origin: string): string {
  return `${origin}/api/google/callback`
}

// URL a la que enviamos al usuario para que autorice el acceso.
export function buildAuthUrl(origin: string, state: string): string {
  const { clientId } = credentials()
  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: redirectUri(origin),
    response_type: 'code',
    scope: SCOPES.join(' '),
    access_type: 'offline',      // pedir refresh_token
    prompt: 'consent',           // forzar refresh_token incluso si ya autorizó antes
    include_granted_scopes: 'true',
    state,
  })
  return `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`
}

interface TokenResponse {
  access_token: string
  refresh_token?: string
  expires_in: number
  token_type: string
}

// Intercambia el "code" del callback por tokens de acceso y refresco.
export async function exchangeCodeForTokens(origin: string, code: string): Promise<TokenResponse> {
  const { clientId, clientSecret } = credentials()
  const res = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: clientId,
      client_secret: clientSecret,
      code,
      grant_type: 'authorization_code',
      redirect_uri: redirectUri(origin),
    }),
  })
  if (!res.ok) {
    const t = await res.text()
    throw new Error(`Error al canjear el código de Google: ${t}`)
  }
  return res.json()
}

async function refreshAccessToken(refreshToken: string): Promise<TokenResponse> {
  const { clientId, clientSecret } = credentials()
  const res = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: clientId,
      client_secret: clientSecret,
      refresh_token: refreshToken,
      grant_type: 'refresh_token',
    }),
  })
  if (!res.ok) {
    const t = await res.text()
    throw new Error(`Error al refrescar el token de Google: ${t}`)
  }
  return res.json()
}

// Email de la cuenta de Google recién conectada (para mostrarlo en Configuración).
export async function fetchGoogleEmail(accessToken: string): Promise<string> {
  const res = await fetch('https://www.googleapis.com/oauth2/v2/userinfo', {
    headers: { Authorization: `Bearer ${accessToken}` },
  })
  if (!res.ok) return ''
  const data = await res.json() as { email?: string }
  return data.email || ''
}

type GoogleAccountRow = {
  id: string
  accessToken: string
  refreshToken: string
  expiresAt: Date
}

// Devuelve un access token válido para la cuenta indicada, refrescándolo y
// persistiéndolo si está por expirar (margen de 60s). Los tokens en la BD están
// cifrados; aquí se descifran para usarlos y el nuevo se vuelve a cifrar.
export async function getValidAccessToken(account: GoogleAccountRow): Promise<string> {
  const stillValid = account.expiresAt.getTime() - Date.now() > 60_000
  if (stillValid) {
    const token = decrypt(account.accessToken)
    if (token) return token
  }
  const refresh = decrypt(account.refreshToken)
  if (!refresh) throw new Error('No hay refresh token válido; reconecta Google Calendar.')
  const refreshed = await refreshAccessToken(refresh)
  const expiresAt = new Date(Date.now() + refreshed.expires_in * 1000)
  await prisma.googleAccount.update({
    where: { id: account.id },
    data: { accessToken: encrypt(refreshed.access_token)!, expiresAt },
  })
  return refreshed.access_token
}
