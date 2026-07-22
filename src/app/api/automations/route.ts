import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireRole, COMMISSIONS_ROLES } from '@/lib/auth'
import { validateCampaignImages } from '@/lib/campaignImages'

const TYPES = ['birthday', 'renewal', 'welcome']

// GET /api/automations — automatizaciones de la agencia.
export async function GET() {
  const auth = await requireRole(COMMISSIONS_ROLES)
  if (auth instanceof NextResponse) return auth
  const rows = await prisma.automation.findMany({ where: { agencyId: auth.agencyId } })
  return NextResponse.json(rows)
}

// PUT /api/automations — crea/actualiza una automatización (por tipo).
export async function PUT(request: NextRequest) {
  const auth = await requireRole(COMMISSIONS_ROLES)
  if (auth instanceof NextResponse) return auth

  const b = await request.json().catch(() => ({}))
  const { type, enabled, subject, message, buttonText, buttonUrl, images, daysBefore } = b
  if (!TYPES.includes(type)) {
    return NextResponse.json({ error: 'Tipo de automatización inválido.' }, { status: 400 })
  }
  const imgCheck = validateCampaignImages(images)
  if (imgCheck.error) return NextResponse.json({ error: imgCheck.error }, { status: 400 })

  // Para activarla, el asunto y el mensaje son obligatorios.
  if (enabled && (!subject?.trim() || !message?.trim())) {
    return NextResponse.json({ error: 'Para activar la automatización escribe el asunto y el mensaje.' }, { status: 400 })
  }

  const data = {
    enabled: !!enabled,
    subject: (subject || '').trim(),
    message: (message || '').trim(),
    buttonText: buttonText?.trim() || null,
    buttonUrl: buttonUrl?.trim() || null,
    images: imgCheck.images.length ? JSON.stringify(imgCheck.images) : null,
    daysBefore: type === 'renewal' ? (parseInt(String(daysBefore), 10) || 30) : null,
  }

  const saved = await prisma.automation.upsert({
    where: { agencyId_type: { agencyId: auth.agencyId, type } },
    update: data,
    create: { agencyId: auth.agencyId, type, ...data },
  })
  return NextResponse.json(saved)
}
