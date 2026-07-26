import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireAdmin } from '@/lib/auth'
import { logAudit } from '@/lib/audit'

type RouteContext = { params: Promise<{ userId: string }> }

// POST /api/users/[userId]/reset-2fa — un ADMIN reinicia la verificación en dos
// pasos de un usuario de SU agencia (p. ej. perdió el teléfono). El usuario
// tendrá que registrar el autenticador de nuevo en su próximo inicio de sesión.
export async function POST(_req: NextRequest, ctx: RouteContext) {
  const auth = await requireAdmin()
  if (auth instanceof NextResponse) return auth
  const { userId } = await ctx.params

  // Verificar-luego-actuar: solo usuarios de la misma agencia.
  const target = await prisma.user.findFirst({
    where: { id: userId, agencyId: auth.agencyId },
    select: { id: true, name: true, email: true },
  })
  if (!target) return NextResponse.json({ error: 'Usuario no encontrado.' }, { status: 404 })

  await prisma.user.update({
    where: { id: target.id },
    data: { totpSecret: null, totpEnabled: false, backupCodes: null },
  })

  await logAudit(auth, {
    action: 'update', entity: 'user', entityId: target.id, entityLabel: target.name,
    metadata: { accion: 'reinicio de verificación en dos pasos' },
  })

  return NextResponse.json({ ok: true })
}
