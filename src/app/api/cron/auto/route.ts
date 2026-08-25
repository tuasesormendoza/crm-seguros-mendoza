import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getAuth } from '@/lib/auth'
import { pullAccounts } from '@/lib/calendarSync'
import { runDueScheduledCampaigns, runAutomations } from '@/lib/campaignEngine'
import { backupAgencies } from '@/lib/driveBackup'
import { shouldAutoBackup, type LastBackup } from '@/lib/backupHealth'

// POST /api/cron/auto — las tareas periódicas, disparadas por el USO del CRM.
//
// Las tareas programadas de Netlify dejaron de ejecutarse el 10/08/2026 sin
// deploy de por medio: "Run now" responde "invoked successfully", no escribe ni
// una línea de registro y el testigo del endpoint nunca llega. El código está
// bien desplegado (el paquete lista las 6 funciones) y la cuenta tiene crédito
// de sobra; la suspensión es del lado de Netlify. Un CRM cuyo calendario y
// campañas dependen de un tercero que falla en silencio no es vendible.
//
// Así que el propio CRM hace el trabajo: cada vez que alguien navega, este
// endpoint corre lo que toque. Con el CRM en uso diario, todo corre a diario:
//   • sincronización Google Calendar → CRM (como el google-sync de Netlify)
//   • campañas programadas vencidas + automatizaciones (como campaigns)
//   • respaldo a Drive de la agencia del usuario, si ya toca (ya existía)
//
// Un freno global de 3 minutos (marca en Settings con agencyId '') evita que
// cada clic repita el trabajo. Las campañas tienen además su propio candado
// anti-duplicado (NotificationLog), así que correr de más no reenvía nada.
//
// Si Netlify revive, sus crons y esto conviven sin pisarse: ambos pasan por
// las mismas marcas y candados.

const THROTTLE_MS = 3 * 60 * 1000

export async function POST(request: NextRequest) {
  const auth = await getAuth()
  if (auth instanceof NextResponse) return auth

  // ── Freno global ──────────────────────────────────────────────────────────
  const mark = await prisma.settings.findFirst({
    where: { agencyId: '', key: 'appCronLastRun' },
    select: { value: true },
  })
  const last = mark ? Date.parse(mark.value) : NaN
  const due = !Number.isFinite(last) || Date.now() - last >= THROTTLE_MS

  const out: Record<string, unknown> = { ran: due }

  if (due) {
    // La marca se escribe ANTES de trabajar: si dos pestañas llegan a la vez,
    // solo la primera pasa (la ventana de carrera restante es de milisegundos
    // y el peor caso es trabajo repetido, nunca envíos dobles).
    await prisma.settings.upsert({
      where: { agencyId_key: { agencyId: '', key: 'appCronLastRun' } },
      create: { agencyId: '', key: 'appCronLastRun', value: new Date().toISOString() },
      update: { value: new Date().toISOString() },
    })

    // Cada tarea en su propio try: que falle una no debe frenar a las demás.
    try {
      const sync = await pullAccounts()
      out.sync = sync
    } catch (err) {
      out.sync = { error: (err as Error).message.slice(0, 120) }
    }

    try {
      const origin = request.nextUrl.origin
      out.campaigns = {
        scheduled: await runDueScheduledCampaigns(origin),
        automations: await runAutomations(origin),
      }
    } catch (err) {
      out.campaigns = { error: (err as Error).message.slice(0, 120) }
    }
  }

  // ── Respaldo de la agencia del usuario (con su propio freno) ──────────────
  try {
    const rows = await prisma.settings.findMany({
      where: { agencyId: auth.agencyId, key: { in: ['driveLastBackup', 'driveLastAttempt'] } },
    })
    const byKey = Object.fromEntries(rows.map(r => [r.key, r.value]))
    let lastBackup: LastBackup | null = null
    if (byKey.driveLastBackup) { try { lastBackup = JSON.parse(byKey.driveLastBackup) } catch { /* inválido */ } }

    if (shouldAutoBackup(lastBackup, byKey.driveLastAttempt)) {
      const connected = await prisma.googleAccount.count({ where: { agencyId: auth.agencyId } })
      if (connected) {
        const result = await backupAgencies(auth.agencyId)
        const mine = result.results.find(r => r.agencyId === auth.agencyId)
        out.backup = { ran: true, ok: !!mine?.ok, fileName: mine?.fileName ?? null }
      } else {
        out.backup = { ran: false, reason: 'sin Google conectado' }
      }
    } else {
      out.backup = { ran: false, reason: 'al día' }
    }
  } catch (err) {
    out.backup = { error: (err as Error).message.slice(0, 120) }
  }

  return NextResponse.json(out)
}
