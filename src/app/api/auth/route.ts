import { NextRequest, NextResponse } from 'next/server'
import bcrypt from 'bcryptjs'
import { getSession } from '@/lib/session'
import { prisma } from '@/lib/prisma'
import { checkRateLimit, recordFailedAttempt, clearAttempts } from '@/lib/rateLimit'
import { logAudit } from '@/lib/audit'

function getIP(request: NextRequest): string {
  return request.headers.get('x-forwarded-for')?.split(',')[0]?.trim()
    || request.headers.get('x-real-ip')
    || 'unknown'
}

// Returns the current session info (role, name, email) so client components
// can decide what to render — e.g. gate the Settings page for non-admins.
export async function GET() {
  const session = await getSession()
  if (!session.isLoggedIn) {
    return NextResponse.json({ isLoggedIn: false }, { status: 401 })
  }
  return NextResponse.json({
    isLoggedIn: true,
    name: session.name,
    email: session.email,
    role: session.role || 'agent',
  })
}

export async function POST(request: NextRequest) {
  const ip = getIP(request)

  // ── Rate limit check ──────────────────────────────────────────────────────
  const rateCheck = await checkRateLimit(ip)
  if (!rateCheck.allowed) {
    return NextResponse.json({
      error: `Demasiados intentos fallidos. Intenta de nuevo en ${rateCheck.retryAfter} minuto(s).`
    }, { status: 429 })
  }

  const { email, password } = await request.json()
  if (!email || !password) {
    return NextResponse.json({ error: 'Email y contraseña requeridos' }, { status: 400 })
  }

  // ── Look up user ──────────────────────────────────────────────────────────
  const user = await prisma.user.findUnique({
    where: { email: email.trim().toLowerCase() }
  }).catch(() => null)

  // Sin usuario → credenciales inválidas. (Se eliminó el fallback con contraseña
  // hardcodeada 'admin123'; los usuarios se administran en la tabla User.)
  if (!user) {
    await recordFailedAttempt(ip)
    return NextResponse.json({ error: 'Credenciales incorrectas' }, { status: 401 })
  }

  // ── Check active ──────────────────────────────────────────────────────────
  if (!user.active) {
    return NextResponse.json({ error: 'Usuario inactivo. Contacta al administrador.' }, { status: 401 })
  }

  // ── Verify password (supports both bcrypt hash and plain text for migration) ─
  let passwordOk = false
  if (user.password.startsWith('$2')) {
    // Already hashed with bcrypt
    passwordOk = await bcrypt.compare(password, user.password)
  } else {
    // Plain text (legacy) — compare directly then upgrade to bcrypt
    passwordOk = user.password === password
    if (passwordOk) {
      // Silently upgrade to bcrypt hash
      const hashed = await bcrypt.hash(password, 12)
      await prisma.user.update({ where: { id: user.id }, data: { password: hashed } })
    }
  }

  if (!passwordOk) {
    const result = await recordFailedAttempt(ip)
    const remaining = result.remaining
    return NextResponse.json({
      error: remaining > 0
        ? `Credenciales incorrectas. ${remaining} intento(s) restante(s).`
        : 'Cuenta bloqueada temporalmente por múltiples intentos fallidos.'
    }, { status: 401 })
  }

  // ── Login successful ──────────────────────────────────────────────────────
  await clearAttempts(ip)
  const session = await getSession()
  session.isLoggedIn = true
  session.userId = user.id
  session.email = user.email
  session.name = user.name
  session.role = user.role
  session.agencyId = user.agencyId ?? undefined  // inquilino para aislamiento multi-tenant
  await session.save()

  if (user.agencyId) {
    await logAudit(
      { agencyId: user.agencyId, userId: user.id, name: user.name, email: user.email },
      { action: 'login', entity: 'session', entityLabel: user.name, ip }
    )
  }

  return NextResponse.json({ success: true, name: user.name, role: user.role })
}

export async function DELETE() {
  const session = await getSession()
  session.destroy()
  return NextResponse.json({ success: true })
}
