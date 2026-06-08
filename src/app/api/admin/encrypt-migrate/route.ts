// ONE-TIME migration endpoint: encrypts any plaintext portalPassword / bankAccount / bankRouting
// values still stored in the DB.
//
// HOW TO USE:
//   1. Add ENCRYPTION_KEY to Netlify env vars first (otherwise this is a no-op).
//   2. Make a POST request to /api/admin/encrypt-migrate (requires admin session).
//   3. Run it once. It is safe to call multiple times — already-encrypted values
//      (starting with "enc:") are skipped automatically.
//
// After running, all sensitive fields will be encrypted in the database.

import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getSession } from '@/lib/session'
import { encrypt } from '@/lib/encrypt'

const SENSITIVE_FIELDS = ['portalPassword', 'bankAccount', 'bankRouting'] as const

export async function POST() {
  // Admin-only
  const session = await getSession()
  if (!session.isLoggedIn || session.role !== 'admin') {
    return NextResponse.json({ error: 'No autorizado' }, { status: 403 })
  }

  // Check that ENCRYPTION_KEY is set (encrypt() is a no-op without it)
  if (!process.env.ENCRYPTION_KEY || process.env.ENCRYPTION_KEY.length !== 64) {
    return NextResponse.json(
      { error: 'ENCRYPTION_KEY no está configurada o es inválida. Agrega una clave de 64 caracteres hex en Netlify antes de migrar.' },
      { status: 400 }
    )
  }

  // Load all clients that have at least one sensitive field that is NOT already encrypted
  const clients = await prisma.client.findMany({
    where: {
      OR: [
        { portalPassword: { not: null } },
        { bankAccount: { not: null } },
        { bankRouting: { not: null } },
      ],
    },
    select: { id: true, portalPassword: true, bankAccount: true, bankRouting: true },
  })

  let migrated = 0
  let skipped = 0

  for (const client of clients) {
    const update: Partial<Record<typeof SENSITIVE_FIELDS[number], string | null>> = {}
    let needsUpdate = false

    for (const field of SENSITIVE_FIELDS) {
      const value = client[field]
      if (value && !value.startsWith('enc:')) {
        // Plaintext — encrypt it
        update[field] = encrypt(value)
        needsUpdate = true
      }
      // Already encrypted or null → skip
    }

    if (needsUpdate) {
      await prisma.client.update({ where: { id: client.id }, data: update })
      migrated++
    } else {
      skipped++
    }
  }

  return NextResponse.json({
    success: true,
    message: `Migración completa. ${migrated} cliente(s) actualizados, ${skipped} ya estaban encriptados o sin datos.`,
    migrated,
    skipped,
    total: clients.length,
  })
}
