import { NextRequest, NextResponse } from 'next/server'
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
  const result = await backupAgencies()
  return NextResponse.json({ ok: true, ...result })
}
