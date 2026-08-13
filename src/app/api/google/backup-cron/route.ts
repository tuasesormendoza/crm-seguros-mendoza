import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { backupAgencies } from '@/lib/driveBackup'
import { verifyCronKey } from '@/lib/cronKey'

// Endpoint SIN sesión que dispara el respaldo automático a Google Drive de todas
// las agencias con Google conectado. Lo llama la función programada de Netlify
// (netlify/functions/drive-backup.mts), una vez al día. Protegido por la clave
// derivada del SESSION_SECRET, así que solo el propio servidor puede invocarlo.
export async function POST(request: NextRequest) {
  if (!verifyCronKey(request.headers.get('x-cron-key'))) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
  }

  // Testigo: se apunta que la tarea LLEGÓ hasta aquí, antes de hacer nada.
  // Sin esto no se puede distinguir "Netlify no ejecuta la tarea" de "la
  // ejecuta pero el respaldo falla", que fue justo lo que costó semanas de
  // diagnóstico. Es un dato de plataforma, sin agencia (agencyId vacío).
  await prisma.settings.upsert({
    where: { agencyId_key: { agencyId: '', key: 'driveLastCronRun' } },
    create: { agencyId: '', key: 'driveLastCronRun', value: new Date().toISOString() },
    update: { value: new Date().toISOString() },
  }).catch(() => {})

  const result = await backupAgencies()
  return NextResponse.json({ ok: true, ...result })
}
