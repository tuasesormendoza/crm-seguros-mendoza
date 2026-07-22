import { NextRequest, NextResponse } from 'next/server'
import { verifyCronKey } from '@/lib/cronKey'
import { runDueScheduledCampaigns, runAutomations } from '@/lib/campaignEngine'

// Endpoint SIN sesión que dispara: (1) las campañas PROGRAMADAS vencidas y (2)
// las AUTOMATIZACIONES (cumpleaños/renovación/bienvenida). Lo llama la función
// programada de Netlify. Protegido por la clave derivada del SESSION_SECRET.
export async function POST(request: NextRequest) {
  if (!verifyCronKey(request.headers.get('x-cron-key'))) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
  }
  const origin = request.nextUrl.origin
  const scheduled = await runDueScheduledCampaigns(origin)
  const automations = await runAutomations(origin)
  return NextResponse.json({ ok: true, scheduled, automations })
}
