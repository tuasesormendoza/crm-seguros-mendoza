import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getAuth } from '@/lib/auth'
import { googleConfigured } from '@/lib/google'

// Estado de la conexión de Google Calendar del usuario actual (para Configuración).
//
// "connected" solo dice que existe la fila; NO que el permiso siga vivo. Por eso
// se devuelve además "authBroken": Google puede haber revocado el permiso de
// largo plazo y la fila seguir ahí tal cual. Antes la pantalla mostraba
// "✅ Conectado" mientras el respaldo llevaba dos semanas fallando.
export async function GET() {
  const auth = await getAuth()
  if (auth instanceof NextResponse) return auth

  const [account, broken] = await Promise.all([
    prisma.googleAccount.findFirst({
      where: { userId: auth.userId!, agencyId: auth.agencyId },
      select: { email: true, createdAt: true },
    }),
    prisma.settings.findFirst({
      where: { agencyId: auth.agencyId, key: 'googleAuthBroken' },
      select: { value: true },
    }),
  ])

  let authBroken: { at: string; error: string } | null = null
  if (account && broken?.value) {
    try { authBroken = JSON.parse(broken.value) } catch { /* valor inválido */ }
  }

  return NextResponse.json({
    configured: googleConfigured(), // ¿el admin de la app puso las credenciales?
    connected: !!account,
    email: account?.email ?? null,
    authBroken,
  })
}
