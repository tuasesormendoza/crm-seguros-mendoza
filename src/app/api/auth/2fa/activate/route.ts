import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getSession } from '@/lib/session'
import { decrypt } from '@/lib/encrypt'
import { verifyTotp, generateBackupCodes } from '@/lib/totp'
import { getPendingUser, completeLogin, hashBackupCodes } from '@/lib/twoFactor'

// POST /api/auth/2fa/activate — confirma el código del autenticador y ACTIVA la
// verificación en dos pasos. Devuelve los códigos de respaldo UNA sola vez
// (se guardan hasheados). Si venía del login, deja la sesión ya iniciada.
export async function POST(request: NextRequest) {
  const session = await getSession()
  const { code } = await request.json().catch(() => ({}))

  // Usuario en registro (tras contraseña) o ya logueado (reconfigurando).
  let user: { id: string; email: string; name: string; role: string; agencyId: string | null; totpSecret: string | null } | null = null
  let fromLogin = false
  if (session.isLoggedIn && session.userId) {
    user = await prisma.user.findUnique({
      where: { id: session.userId },
      select: { id: true, email: true, name: true, role: true, agencyId: true, totpSecret: true },
    }).catch(() => null)
  } else {
    const pending = await getPendingUser(session, 'enroll')
    if (pending) { user = pending; fromLogin = true }
  }
  if (!user) {
    return NextResponse.json({ error: 'Sesión no válida. Vuelve a iniciar sesión.' }, { status: 401 })
  }

  const secret = decrypt(user.totpSecret)
  if (!secret) {
    return NextResponse.json({ error: 'Primero genera el código QR.' }, { status: 400 })
  }
  if (!verifyTotp(secret, String(code || ''))) {
    return NextResponse.json({ error: 'El código no es válido. Revisa la app e intenta de nuevo.' }, { status: 400 })
  }

  // Activar + generar códigos de respaldo (se muestran una única vez).
  const backupCodes = generateBackupCodes(8)
  await prisma.user.update({
    where: { id: user.id },
    data: { totpEnabled: true, backupCodes: await hashBackupCodes(backupCodes) },
  })

  if (fromLogin) await completeLogin(session, user)

  return NextResponse.json({ success: true, backupCodes, loggedIn: fromLogin })
}
