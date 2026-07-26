import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/lib/session'
import { decrypt } from '@/lib/encrypt'
import { verifyTotp } from '@/lib/totp'
import { getPendingUser, completeLogin, consumeBackupCode, countBackupCodes } from '@/lib/twoFactor'
import { checkRateLimit, recordFailedAttempt, clearAttempts } from '@/lib/rateLimit'

function getIP(request: NextRequest): string {
  return request.headers.get('x-forwarded-for')?.split(',')[0]?.trim()
    || request.headers.get('x-real-ip')
    || 'unknown'
}

// POST /api/auth/2fa/verify — segundo paso del login: valida el código de 6
// dígitos del autenticador (o un código de respaldo) y crea la sesión.
//
// Anti-fuerza bruta: el limitador se lleva POR USUARIO (no por IP), así rotar
// de IP no sirve para adivinar el código de 6 dígitos.
export async function POST(request: NextRequest) {
  const session = await getSession()
  const pending = await getPendingUser(session, 'verify')
  if (!pending) {
    return NextResponse.json({ error: 'La sesión expiró. Vuelve a iniciar sesión.' }, { status: 401 })
  }

  const limiterKey = `2fa:${pending.id}`
  const rate = await checkRateLimit(limiterKey)
  if (!rate.allowed) {
    return NextResponse.json({
      error: `Demasiados intentos. Intenta de nuevo en ${rate.retryAfter} minuto(s).`,
    }, { status: 429 })
  }

  const { code } = await request.json().catch(() => ({}))
  const input = String(code || '').trim()
  if (!input) return NextResponse.json({ error: 'Ingresa el código.' }, { status: 400 })

  const secret = decrypt(pending.totpSecret)
  let ok = secret ? verifyTotp(secret, input) : false
  let usedBackup = false

  // Si no coincide el código del autenticador, se prueba como código de respaldo.
  if (!ok) {
    ok = await consumeBackupCode(pending.id, pending.backupCodes, input)
    usedBackup = ok
  }

  if (!ok) {
    const res = await recordFailedAttempt(limiterKey)
    return NextResponse.json({
      error: res.remaining > 0
        ? `Código incorrecto. ${res.remaining} intento(s) restante(s).`
        : 'Demasiados intentos fallidos. Espera unos minutos.',
    }, { status: 401 })
  }

  await clearAttempts(limiterKey)
  await completeLogin(session, pending, getIP(request))

  return NextResponse.json({
    success: true,
    name: pending.name,
    role: pending.role,
    usedBackup,
    // Aviso para que el usuario sepa cuántos códigos de respaldo le quedan.
    backupRemaining: usedBackup ? countBackupCodes(pending.backupCodes) - 1 : undefined,
  })
}
