import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getAuth } from '@/lib/auth'

// Desconecta Google Calendar del usuario actual (borra sus tokens).
export async function POST() {
  const auth = await getAuth()
  if (auth instanceof NextResponse) return auth

  await prisma.googleAccount.deleteMany({
    where: { userId: auth.userId!, agencyId: auth.agencyId },
  })

  return NextResponse.json({ ok: true })
}
