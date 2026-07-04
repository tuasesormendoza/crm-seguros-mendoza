import { NextRequest, NextResponse } from 'next/server'
import { randomBytes } from 'crypto'
import { getAuth } from '@/lib/auth'
import { getSession } from '@/lib/session'
import { googleConfigured, buildAuthUrl } from '@/lib/google'

// Inicia el flujo OAuth: guarda un state anti-CSRF en la sesión y redirige a la
// pantalla de consentimiento de Google.
export async function GET(request: NextRequest) {
  const auth = await getAuth()
  if (auth instanceof NextResponse) return auth

  if (!googleConfigured()) {
    return NextResponse.redirect(new URL('/settings?google=noconfig', request.url))
  }

  const state = randomBytes(16).toString('hex')
  const session = await getSession()
  session.googleOAuthState = state
  await session.save()

  return NextResponse.redirect(buildAuthUrl(request.nextUrl.origin, state))
}
