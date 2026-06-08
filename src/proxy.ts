import { NextRequest, NextResponse } from 'next/server'
import { unsealData } from 'iron-session'

const PUBLIC_PATHS = ['/login', '/api/auth']

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl
  if (PUBLIC_PATHS.some(p => pathname.startsWith(p))) return NextResponse.next()

  const sessionSecret = process.env.SESSION_SECRET
  if (!sessionSecret) {
    console.error('SESSION_SECRET no está definido — bloqueando acceso por seguridad')
    return NextResponse.redirect(new URL('/login', request.url))
  }

  const cookieValue = request.cookies.get('crm-session')?.value
  if (!cookieValue) return NextResponse.redirect(new URL('/login', request.url))

  try {
    const session = await unsealData<{ isLoggedIn?: boolean }>(cookieValue, {
      password: sessionSecret,
    })
    if (!session.isLoggedIn) return NextResponse.redirect(new URL('/login', request.url))
    return NextResponse.next()
  } catch {
    return NextResponse.redirect(new URL('/login', request.url))
  }
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|logo.png).*)'],
}
