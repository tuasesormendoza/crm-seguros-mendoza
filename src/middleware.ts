import { NextRequest, NextResponse } from 'next/server'
import { unsealData } from 'iron-session'

// Paths that do NOT require authentication
// OJO: una ruta declarada como pública en PUBLIC_ROUTES (src/lib/tenancy.test.ts)
// también tiene que estar aquí, o este middleware la bloqueará con 401 antes de
// que su código llegue a ejecutarse. El test "las rutas públicas atraviesan el
// middleware" comprueba que las dos listas no se desincronicen.
const PUBLIC_PATHS = [
  '/login', '/api/auth', '/api/ping', '/api/theme', '/encuesta', '/api/survey', '/api/logo',
  '/api/google/sync-cron',
  '/api/google/backup-cron',   // cron de respaldo a Drive; lleva su propia clave
  '/api/campaigns/cron',       // cron de campañas; lleva su propia cronKey
  '/api/campaigns/track',      // píxel de apertura, público por diseño
  '/api/public',               // entrada de leads desde la web de la agencia
]

// Static assets — skip middleware entirely
const STATIC_REGEX = /^\/_next\/|^\/favicon\.ico|^\/logo\.png|^\/icons\//

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl

  // Skip static assets
  if (STATIC_REGEX.test(pathname)) return NextResponse.next()

  // Skip public paths (login page + auth API)
  if (PUBLIC_PATHS.some(p => pathname.startsWith(p))) return NextResponse.next()

  const sessionSecret = process.env.SESSION_SECRET
  if (!sessionSecret) {
    // Fail closed — no secret means no access
    return isApiRoute(pathname)
      ? NextResponse.json({ error: 'Servidor mal configurado' }, { status: 500 })
      : NextResponse.redirect(new URL('/login', request.url))
  }

  const cookieValue = request.cookies.get('crm-session')?.value

  if (!cookieValue) {
    return isApiRoute(pathname)
      ? NextResponse.json({ error: 'No autorizado' }, { status: 401 })
      : NextResponse.redirect(new URL('/login', request.url))
  }

  try {
    const session = await unsealData<{ isLoggedIn?: boolean }>(cookieValue, {
      password: sessionSecret,
    })

    if (!session.isLoggedIn) {
      return isApiRoute(pathname)
        ? NextResponse.json({ error: 'No autorizado' }, { status: 401 })
        : NextResponse.redirect(new URL('/login', request.url))
    }

    return NextResponse.next()
  } catch {
    // Invalid/tampered cookie
    return isApiRoute(pathname)
      ? NextResponse.json({ error: 'Sesión inválida' }, { status: 401 })
      : NextResponse.redirect(new URL('/login', request.url))
  }
}

function isApiRoute(pathname: string) {
  return pathname.startsWith('/api/')
}

export const config = {
  // Run on all routes except Next.js internals and static files
  matcher: ['/((?!_next/static|_next/image|favicon.ico|logo.png|icons/).*)'],
}
