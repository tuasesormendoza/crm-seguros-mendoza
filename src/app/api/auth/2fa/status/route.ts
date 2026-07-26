import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getAuth } from '@/lib/auth'
import { countBackupCodes } from '@/lib/twoFactor'

// GET /api/auth/2fa/status — estado de la verificación en dos pasos del usuario
// actual (para mostrarlo en Configuración → Cuenta).
export async function GET() {
  const auth = await getAuth()
  if (auth instanceof NextResponse) return auth

  const user = await prisma.user.findUnique({
    where: { id: auth.userId! },
    select: { totpEnabled: true, backupCodes: true },
  }).catch(() => null)

  return NextResponse.json({
    enabled: !!user?.totpEnabled,
    backupRemaining: countBackupCodes(user?.backupCodes ?? null),
  })
}
