import { NextResponse } from 'next/server'
import { getAuth } from '@/lib/auth'
import { pullAccounts } from '@/lib/calendarSync'

// Sincronización manual ("Sincronizar ahora") — barrido COMPLETO (últimos 7
// días + futuro) de Google hacia el CRM para la agencia del usuario actual.
// Recupera eventos que el sync incremental del cron pudiera haberse perdido
// (p. ej. los creados antes de la primera sincronización). El push CRM→Google
// ocurre en tiempo real al crear/editar; esto cubre el sentido contrario.
export async function POST() {
  const auth = await getAuth()
  if (auth instanceof NextResponse) return auth
  const result = await pullAccounts(auth.agencyId, { full: true })
  return NextResponse.json({ ok: true, ...result })
}
