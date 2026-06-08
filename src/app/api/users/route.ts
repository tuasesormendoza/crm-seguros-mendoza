import { NextRequest, NextResponse } from 'next/server'
import bcrypt from 'bcryptjs'
import { prisma } from '@/lib/prisma'
import { getSession } from '@/lib/session'

export async function GET() {
  const session = await getSession()
  if (!session.isLoggedIn || session.role !== 'admin') {
    return NextResponse.json({ error: 'No autorizado' }, { status: 403 })
  }

  const users = await prisma.user.findMany({
    select: { id: true, email: true, name: true, role: true, active: true, createdAt: true },
    orderBy: { createdAt: 'asc' },
  })
  return NextResponse.json(users)
}

export async function POST(request: NextRequest) {
  const session = await getSession()
  if (!session.isLoggedIn || session.role !== 'admin') {
    return NextResponse.json({ error: 'No autorizado' }, { status: 403 })
  }

  const { email, name, password, role } = await request.json()

  if (!email || !name || !password) {
    return NextResponse.json({ error: 'Email, nombre y contraseña son requeridos' }, { status: 400 })
  }
  if (password.length < 8) {
    return NextResponse.json({ error: 'La contraseña debe tener al menos 8 caracteres' }, { status: 400 })
  }

  // Max 3 users
  const count = await prisma.user.count()
  if (count >= 3) {
    return NextResponse.json({ error: 'Máximo 3 usuarios permitidos' }, { status: 400 })
  }

  // Check email not taken
  const existing = await prisma.user.findUnique({ where: { email: email.trim().toLowerCase() } })
  if (existing) {
    return NextResponse.json({ error: 'Este email ya está registrado' }, { status: 400 })
  }

  const user = await prisma.user.create({
    data: { email: email.trim().toLowerCase(), name, password: await bcrypt.hash(password, 12), role: role === 'admin' ? 'admin' : 'agent', active: true },
    select: { id: true, email: true, name: true, role: true, active: true, createdAt: true },
  })
  return NextResponse.json(user, { status: 201 })
}
