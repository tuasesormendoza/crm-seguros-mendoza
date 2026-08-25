import { NextRequest, NextResponse } from 'next/server'
import { getAuth } from '@/lib/auth'
import { googleConfigured, buildAuthUrl } from '@/lib/google'
import { createOAuthState } from '@/lib/oauthState'

// Inicia el flujo OAuth y redirige a la pantalla de consentimiento de Google.
//
// El "state" anti-CSRF va FIRMADO (ver src/lib/oauthState.ts), no guardado en
// la sesión: antes cada clic en "Conectar" pisaba el state anterior y el
// agente acababa viendo "La sesión de autorización expiró" sin haber hecho
// nada mal.
export async function GET(request: NextRequest) {
  const auth = await getAuth()
  if (auth instanceof NextResponse) return auth

  if (!googleConfigured()) {
    return NextResponse.redirect(new URL('/settings?google=noconfig', request.url))
  }

  const state = createOAuthState(process.env.SESSION_SECRET || '')
  return NextResponse.redirect(buildAuthUrl(request.nextUrl.origin, state))
}
