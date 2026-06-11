import { NextRequest, NextResponse } from 'next/server'
import bcrypt from 'bcryptjs'
import { prisma } from '@/lib/prisma'
import { requireAdmin } from '@/lib/auth'
import { logAudit } from '@/lib/audit'

export async function GET() {
  const auth = await requireAdmin()
  if (auth instanceof NextResponse) return auth

  const users = await prisma.user.findMany({
    where: { agencyId: auth.agencyId },
    select: { id: true, email: true, name: true, role: true, active: true, createdAt: true },
    orderBy: { createdAt: 'asc' },
  })
  return NextResponse.json(users)
}

export async function POST(request: NextRequest) {
  const auth = await requireAdmin()
  if (auth instanceof NextResponse) return auth

  const { email, name, password, role } = await request.json()

  if (!email || !name || !password) {
    return NextResponse.json({ error: 'Email, nombre y contraseña son requeridos' }, { status: 400 })
  }
  if (password.length < 8) {
    return NextResponse.json({ error: 'La contraseña debe tener al menos 8 caracteres' }, { status: 400 })
  }

  // Máximo 3 usuarios POR AGENCIA
  const count = await prisma.user.count({ where: { agencyId: auth.agencyId } })
  if (count >= 3) {
    return NextResponse.json({ error: 'Máximo 3 usuarios permitidos' }, { status: 400 })
  }

  // Email único a nivel global (la tabla User tiene email @unique)
  const existing = await prisma.user.findUnique({ where: { email: email.trim().toLowerCase() } })
  if (existing) {
    return NextResponse.json({ error: 'Este email ya está registrado' }, { status: 400 })
  }

  const user = await prisma.user.create({
    data: {
      agencyId: auth.agencyId,
      email: email.trim().toLowerCase(),
      name,
      password: await bcrypt.hash(password, 12),
      role: ['admin', 'assistant'].includes(role) ? role : 'agent',
      active: true,
    },
    select: { id: true, email: true, name: true, role: true, active: true, createdAt: true },
  })
  await logAudit(auth, { action: 'create', entity: 'user', entityId: user.id, entityLabel: user.name, metadata: { email: user.email, role: user.role } })
  return NextResponse.json(user, { status: 201 })
}
