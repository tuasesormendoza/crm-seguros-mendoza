import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getAuth, requireAdmin } from '@/lib/auth'
import { backupAgencies } from '@/lib/driveBackup'
import { logAudit } from '@/lib/audit'

// GET /api/google/backup — estado del último respaldo automático a Drive
// (bitácora guardada en Settings por la tarea programada / el botón manual).
export async function GET() {
  const auth = await getAuth()
  if (auth instanceof NextResponse) return auth

  const row = await prisma.settings.findFirst({
    where: { agencyId: auth.agencyId, key: 'driveLastBackup' },
    select: { value: true },
  })
  let last: unknown = null
  if (row?.value) { try { last = JSON.parse(row.value) } catch { /* valor inválido */ } }
  return NextResponse.json({ last })
}

// POST /api/google/backup — "Respaldar ahora": corre el respaldo de la agencia
// actual de inmediato (solo admin).
export async function POST() {
  const auth = await requireAdmin()
  if (auth instanceof NextResponse) return auth

  const result = await backupAgencies(auth.agencyId)
  const mine = result.results.find(r => r.agencyId === auth.agencyId)

  await logAudit(auth, {
    action: 'backup', entity: 'data', entityLabel: 'Respaldo a Google Drive',
    metadata: { ok: mine?.ok ?? false, fileName: mine?.fileName, deleted: mine?.deleted },
  })

  if (!mine) {
    return NextResponse.json({ error: 'No hay una cuenta de Google conectada en esta agencia.' }, { status: 400 })
  }
  if (!mine.ok) {
    return NextResponse.json({ error: mine.error || 'No se pudo respaldar.' }, { status: 400 })
  }
  return NextResponse.json({ ok: true, fileName: mine.fileName, deleted: mine.deleted ?? 0 })
}
