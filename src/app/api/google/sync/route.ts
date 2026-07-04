import { NextResponse } from 'next/server'
import { getAuth } from '@/lib/auth'
import { pullAccounts } from '@/lib/calendarSync'

// Sincronización manual ("Sincronizar ahora") — trae de Google los cambios de
// la agencia del usuario actual. El push CRM→Google ocurre en tiempo real al
// crear/editar; esto es para el sentido Google→CRM sin esperar al cron.
export async function POST() {
  const auth = await getAuth()
  if (auth instanceof NextResponse) return auth
  const result = await pullAccounts(auth.agencyId)
  return NextResponse.json({ ok: true, ...result })
}
