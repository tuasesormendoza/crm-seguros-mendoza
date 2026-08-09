import { NextRequest, NextResponse } from 'next/server'
import { sealData, unsealData } from 'iron-session'

// La sesión dura 8 horas, pero se renueva en cada petición: caduca por
// inactividad, no por reloj desde que se inició sesión. Antes era fijo, y
// quien dejaba una pestaña abierta se encontraba de golpe con la pantalla
// de login al pulsar cualquier sección — parecía que la app se cerrara.
const DURACION_SESION = 60 * 60 * 8

// Debe coincidir con lo que pone iron-session en src/lib/session.ts, o el
// navegador acabaría con dos cookies distintas.
function opcionesCookie() {
  return {
    httpOnly: true,
    sameSite: 'lax' as const,
    path: '/',
    secure: process.env.NODE_ENV === 'production',
    maxAge: DURACION_SESION,
  }
}

// Paths that do NOT require authentication
// OJO: una ruta declarada como pública en PUBLIC_ROUTES (src/lib/tenancy.test.ts)
// también tiene que estar aquí, o este proxy la bloqueará con 401 antes de
// que su código llegue a ejecutarse. El test "las rutas públicas atraviesan el
// proxy" comprueba que las dos listas no se desincronicen.
const PUBLIC_PATHS = [
  '/login', '/api/auth', '/api/ping', '/api/theme', '/encuesta', '/api/survey', '/api/logo',
  '/api/google/sync-cron',
  '/api/google/backup-cron',   // cron de respaldo a Drive; lleva su propia clave
  '/api/campaigns/cron',       // cron de campañas; lleva su propia cronKey
  '/api/campaigns/track',      // píxel de apertura, público por diseño
  '/api/public',               // entrada de leads desde la web de la agencia
]

// Recursos estáticos: el proxy no se ejecuta para ellos
const STATIC_REGEX = /^\/_next\/|^\/favicon\.ico|^\/logo\.png|^\/icons\//

export async function proxy(request: NextRequest) {
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
      : NextResponse.redirect(alLogin(request, pathname))
  }

  try {
    // Se usa Record para no perder campos al volver a sellar: unsealData
    // devuelve la sesión completa (userId, agencyId, rol…), y tiparla
    // estrecha aquí haría que el resellado la vaciara.
    const session = await unsealData<Record<string, unknown>>(cookieValue, {
      password: sessionSecret,
      ttl: DURACION_SESION,
    })

    if (!session.isLoggedIn) {
      return isApiRoute(pathname)
        ? NextResponse.json({ error: 'No autorizado' }, { status: 401 })
        : NextResponse.redirect(alLogin(request, pathname))
    }

    // Sesión válida: se renueva el plazo. Sellar es cuestión de
    // microsegundos, así que sale más barato que perder al usuario.
    const respuesta = NextResponse.next()
    const renovada = await sealData(session, {
      password: sessionSecret,
      ttl: DURACION_SESION,
    })
    respuesta.cookies.set('crm-session', renovada, opcionesCookie())
    return respuesta
  } catch {
    // Cookie caducada o manipulada
    return isApiRoute(pathname)
      ? NextResponse.json({ error: 'Sesión inválida' }, { status: 401 })
      : NextResponse.redirect(alLogin(request, pathname))
  }
}

/** Manda al login, avisando si venía de una sesión que caducó.
 *  Quien entra directo a la raíz es una visita normal y no necesita aviso;
 *  quien intentaba abrir una sección concreta sí estaba dentro y se quedó
 *  fuera a media faena. */
function alLogin(request: NextRequest, pathname: string) {
  const destino = new URL('/login', request.url)
  if (pathname !== '/' && pathname !== '/login') destino.searchParams.set('expirada', '1')
  return destino
}

function isApiRoute(pathname: string) {
  return pathname.startsWith('/api/')
}

export const config = {
  // Run on all routes except Next.js internals and static files
  matcher: ['/((?!_next/static|_next/image|favicon.ico|logo.png|icons/).*)'],
}
