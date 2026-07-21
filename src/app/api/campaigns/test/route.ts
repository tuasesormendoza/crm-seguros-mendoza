import { NextRequest, NextResponse } from 'next/server'
import { requireRole, COMMISSIONS_ROLES } from '@/lib/auth'
import { getEmailConfig, sendCampaign } from '@/lib/email'
import { getCampaignBrand } from '@/lib/campaignBrand'
import { validateCampaignImages } from '@/lib/campaignImages'

// POST /api/campaigns/test — envía UNA prueba de la campaña al email del agente
// (el configurado en Notificaciones), con datos de muestra, para revisarla en su
// bandeja antes del envío masivo. No guarda historial ni cuenta como envío.
export async function POST(request: NextRequest) {
  const auth = await requireRole(COMMISSIONS_ROLES)
  if (auth instanceof NextResponse) return auth

  const body = await request.json().catch(() => ({}))
  const { subject, message, images, buttonText, buttonUrl } = body as {
    subject?: string; message?: string; images?: unknown; buttonText?: string; buttonUrl?: string
  }
  if (!subject?.trim() || !message?.trim()) {
    return NextResponse.json({ error: 'El asunto y el mensaje son obligatorios.' }, { status: 400 })
  }
  const imgCheck = validateCampaignImages(images)
  if (imgCheck.error) return NextResponse.json({ error: imgCheck.error }, { status: 400 })

  const cfg = await getEmailConfig(auth.agencyId)
  if (!cfg.enabled || !cfg.to) {
    return NextResponse.json({ error: 'Configura tu email en Configuración → Mensajería → Notificaciones por Email.' }, { status: 400 })
  }

  const brand = await getCampaignBrand(auth.agencyId, request.nextUrl.origin)
  const button = buttonText?.trim() && buttonUrl?.trim() ? { text: buttonText.trim(), url: buttonUrl.trim() } : null

  // Destinatario de muestra: tu propio email, con datos ficticios para que veas
  // cómo se resuelven las variables ({aseguradora}, {plan}, etc.).
  const sample = { email: cfg.to, name: 'María González', insurer: 'Ambetter', planName: 'Silver 5', state: 'FL' }
  const result = await sendCampaign(auth.agencyId, [sample], `[PRUEBA] ${subject.trim()}`, message.trim(), brand, imgCheck.images, button)

  if (result.sent === 0) {
    return NextResponse.json({ error: result.errors[0] || 'No se pudo enviar la prueba.' }, { status: 400 })
  }
  return NextResponse.json({ ok: true, to: cfg.to })
}
