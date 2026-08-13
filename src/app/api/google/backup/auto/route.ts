import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getAuth } from '@/lib/auth'
import { backupAgencies } from '@/lib/driveBackup'
import { shouldAutoBackup, type LastBackup } from '@/lib/backupHealth'

// POST /api/google/backup/auto — respaldo automático disparado por la propia app.
//
// La tarea programada de Netlify aparece como activa pero no produce respaldos
// (entre el 05/08 y el 13/08/2026 no hizo ninguno; todos los que hay son de
// pulsar el botón a mano). Un respaldo que depende de una sola pieza que falla
// en silencio no sirve.
//
// Por eso el panel llama aquí al cargar: si ya toca, se respalda. Como el
// agente entra a diario, hay copia a diario aunque la tarea nunca se arregle.
//
// No requiere ser admin —cualquier usuario de la agencia sirve de disparador—
// pero solo respalda SU agencia y nunca devuelve datos: solo si se hizo o no.
export async function POST() {
  const auth = await getAuth()
  if (auth instanceof NextResponse) return auth

  const rows = await prisma.settings.findMany({
    where: { agencyId: auth.agencyId, key: { in: ['driveLastBackup', 'driveLastAttempt'] } },
  })
  const byKey = Object.fromEntries(rows.map(r => [r.key, r.value]))

  let last: LastBackup | null = null
  if (byKey.driveLastBackup) {
    try { last = JSON.parse(byKey.driveLastBackup) } catch { /* valor inválido */ }
  }

  if (!shouldAutoBackup(last, byKey.driveLastAttempt)) {
    return NextResponse.json({ ran: false, reason: 'al día' })
  }

  // Sin Google conectado no hay nada que hacer; no es un error.
  const connected = await prisma.googleAccount.count({ where: { agencyId: auth.agencyId } })
  if (!connected) return NextResponse.json({ ran: false, reason: 'sin Google conectado' })

  const result = await backupAgencies(auth.agencyId)
  const mine = result.results.find(r => r.agencyId === auth.agencyId)
  return NextResponse.json({ ran: true, ok: !!mine?.ok, fileName: mine?.fileName ?? null })
}
