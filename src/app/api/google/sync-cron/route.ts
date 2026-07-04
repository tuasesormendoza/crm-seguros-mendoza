import { NextRequest, NextResponse } from 'next/server'
import { pullAccounts } from '@/lib/calendarSync'
import { cronKey } from '@/lib/cronKey'

// Endpoint SIN sesión que dispara la sincronización Google→CRM de todas las
// cuentas. Lo llama la función programada de Netlify (netlify/functions/
// google-sync.mts). Protegido por una clave derivada del SESSION_SECRET, así
// que solo quien conoce ese secreto (el propio servidor) puede invocarlo.
export async function POST(request: NextRequest) {
  const provided = request.headers.get('x-cron-key')
  if (!provided || provided !== cronKey()) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
  }
  const result = await pullAccounts()
  return NextResponse.json({ ok: true, ...result })
}
