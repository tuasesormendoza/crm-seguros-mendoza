import { NextResponse } from 'next/server'
import QRCode from 'qrcode'
import { prisma } from '@/lib/prisma'
import { getSession } from '@/lib/session'
import { encrypt } from '@/lib/encrypt'
import { generateTotpSecret, otpauthUrl } from '@/lib/totp'
import { getPendingUser } from '@/lib/twoFactor'

// POST /api/auth/2fa/setup — genera un secreto nuevo y devuelve el código QR
// para escanear con Google Authenticator. El secreto se guarda CIFRADO pero
// `totpEnabled` sigue en false hasta confirmar un código (ver /activate).
//
// Acceso: usuarios en el paso de registro (tras validar contraseña) o ya
// logueados (si quieren reconfigurar su autenticador).
export async function POST() {
  const session = await getSession()

  let userId: string | null = null
  let email = ''
  if (session.isLoggedIn && session.userId) {
    userId = session.userId
    email = session.email || ''
  } else {
    const pending = await getPendingUser(session, 'enroll')
    if (pending) { userId = pending.id; email = pending.email }
  }
  if (!userId) {
    return NextResponse.json({ error: 'Sesión no válida. Vuelve a iniciar sesión.' }, { status: 401 })
  }

  const secret = generateTotpSecret()
  await prisma.user.update({
    where: { id: userId },
    data: { totpSecret: encrypt(secret), totpEnabled: false },
  })

  const url = otpauthUrl(secret, email || 'usuario')
  const qrDataUrl = await QRCode.toDataURL(url, { width: 240, margin: 1 })

  // `secret` se devuelve para poder escribirlo a mano si la cámara falla.
  return NextResponse.json({ qr: qrDataUrl, secret, otpauth: url })
}
