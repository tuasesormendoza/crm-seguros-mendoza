// ONE-TIME migration endpoint: encrypts plaintext sensitive fields in the DB.
// Covers: Client (ssn, portalPassword, bankAccount, bankRouting)
//         Dependent (ssn)
//
// HOW TO USE:
//   1. Ensure ENCRYPTION_KEY is set in Netlify env vars.
//   2. Log in as admin, then POST to /api/admin/encrypt-migrate from browser console:
//        fetch('/api/admin/encrypt-migrate', { method: 'POST' }).then(r => r.json()).then(console.log)
//   3. Run once. Already-encrypted values (starting with "enc:") are skipped.
//
// AFTER RUNNING: delete this file and redeploy.

import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getSession } from '@/lib/session'
import { encrypt } from '@/lib/encrypt'

const CLIENT_FIELDS = ['ssn', 'portalPassword', 'bankAccount', 'bankRouting'] as const

export async function POST() {
  const session = await getSession()
  if (!session.isLoggedIn || session.role !== 'admin') {
    return NextResponse.json({ error: 'No autorizado' }, { status: 403 })
  }

  if (!process.env.ENCRYPTION_KEY || process.env.ENCRYPTION_KEY.length !== 64) {
    return NextResponse.json(
      { error: 'ENCRYPTION_KEY no configurada o inválida.' },
      { status: 400 }
    )
  }

  // ── Migrate Client table ────────────────────────────────────────────────────
  const clients = await prisma.client.findMany({
    select: { id: true, ssn: true, portalPassword: true, bankAccount: true, bankRouting: true },
  })

  let clientsMigrated = 0
  for (const client of clients) {
    const update: Partial<Record<typeof CLIENT_FIELDS[number], string | null>> = {}
    let needsUpdate = false
    for (const field of CLIENT_FIELDS) {
      const value = client[field]
      if (value && !value.startsWith('enc:')) {
        update[field] = encrypt(value)
        needsUpdate = true
      }
    }
    if (needsUpdate) {
      await prisma.client.update({ where: { id: client.id }, data: update })
      clientsMigrated++
    }
  }

  // ── Migrate Dependent table ─────────────────────────────────────────────────
  const dependents = await prisma.dependent.findMany({
    where: { ssn: { not: null } },
    select: { id: true, ssn: true },
  })

  let dependentsMigrated = 0
  for (const dep of dependents) {
    if (dep.ssn && !dep.ssn.startsWith('enc:')) {
      await prisma.dependent.update({ where: { id: dep.id }, data: { ssn: encrypt(dep.ssn) } })
      dependentsMigrated++
    }
  }

  return NextResponse.json({
    success: true,
    message: `Migración completa. Clientes: ${clientsMigrated} actualizados. Dependientes: ${dependentsMigrated} actualizados.`,
    clients: { migrated: clientsMigrated, total: clients.length },
    dependents: { migrated: dependentsMigrated, total: dependents.length },
  })
}
