import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getAuth } from '@/lib/auth'
import { googleConfigured } from '@/lib/google'

// Estado de la conexión de Google Calendar del usuario actual (para Configuración).
export async function GET() {
  const auth = await getAuth()
  if (auth instanceof NextResponse) return auth

  const account = await prisma.googleAccount.findFirst({
    where: { userId: auth.userId!, agencyId: auth.agencyId },
    select: { email: true, createdAt: true },
  })

  return NextResponse.json({
    configured: googleConfigured(), // ¿el admin de la app puso las credenciales?
    connected: !!account,
    email: account?.email ?? null,
  })
}
