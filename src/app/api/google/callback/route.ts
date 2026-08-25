import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getAuth } from '@/lib/auth'
import { verifyOAuthState } from '@/lib/oauthState'
import { encrypt } from '@/lib/encrypt'
import { exchangeCodeForTokens, fetchGoogleEmail } from '@/lib/google'

// Google redirige aquí tras el consentimiento. Verifica el state, canjea el
// código por tokens y guarda la conexión (tokens CIFRADOS) para este usuario.
export async function GET(request: NextRequest) {
  const auth = await getAuth()
  if (auth instanceof NextResponse) return auth

  const { searchParams, origin } = request.nextUrl
  const settingsUrl = (status: string) => new URL(`/settings?google=${status}`, request.url)

  if (searchParams.get('error')) {
    return NextResponse.redirect(settingsUrl('denied'))
  }

  const code = searchParams.get('code')
  const state = searchParams.get('state')

  // El state se verifica por su FIRMA, sin depender de la cookie de sesión.
  if (!code || !verifyOAuthState(state, process.env.SESSION_SECRET || '')) {
    return NextResponse.redirect(settingsUrl('badstate'))
  }

  try {
    const tokens = await exchangeCodeForTokens(origin, code)
    if (!tokens.refresh_token) {
      // Sin refresh_token no podemos sincronizar a largo plazo (Google solo lo
      // envía con prompt=consent la primera vez; forzamos ese prompt).
      return NextResponse.redirect(settingsUrl('norefresh'))
    }
    const email = await fetchGoogleEmail(tokens.access_token)
    const expiresAt = new Date(Date.now() + tokens.expires_in * 1000)

    await prisma.googleAccount.upsert({
      where: { userId: auth.userId! },
      create: {
        userId: auth.userId!,
        agencyId: auth.agencyId,
        email,
        accessToken: encrypt(tokens.access_token)!,
        refreshToken: encrypt(tokens.refresh_token)!,
        expiresAt,
      },
      update: {
        agencyId: auth.agencyId,
        email,
        accessToken: encrypt(tokens.access_token)!,
        refreshToken: encrypt(tokens.refresh_token)!,
        expiresAt,
        syncToken: null, // reiniciar el sync incremental al reconectar
      },
    })

    return NextResponse.redirect(settingsUrl('connected'))
  } catch (err) {
    console.error('Google callback error:', err)
    return NextResponse.redirect(settingsUrl('error'))
  }
}
