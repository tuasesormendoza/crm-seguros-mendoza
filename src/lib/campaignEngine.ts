// Motor de campañas: entrega de una campaña a su segmento (con pixel de
// apertura), procesamiento de campañas PROGRAMADAS vencidas y de las
// AUTOMATIZACIONES (cumpleaños / renovación / bienvenida). Vive en lib para que
// las consultas intencionalmente multi-agencia (cron) no crucen datos vía una
// ruta: cada consulta filtra por la agencia dueña de la campaña/automatización.

import { prisma } from '@/lib/prisma'
import { sendCampaign, type CampaignRecipient } from '@/lib/email'
import { getCampaignBrand } from '@/lib/campaignBrand'
import { buildSegmentWhere, smartPostFilter, type SegmentParams } from '@/lib/campaignFilters'
import type { CampaignImage } from '@/lib/campaignRender'

const MAX_PER_SEND = 60

function parseImages(json: string | null | undefined): CampaignImage[] {
  if (!json) return []
  try { const a = JSON.parse(json); return Array.isArray(a) ? a : [] } catch { return [] }
}
function parseSegment(json: string | null | undefined): SegmentParams {
  if (!json) return {}
  try { return JSON.parse(json) as SegmentParams } catch { return {} }
}

const CLIENT_SELECT = { id: true, fullName: true, email: true, insurer: true, planName: true, state: true, birthDate: true } as const
function toRecipient(c: { fullName: string; email: string | null; insurer: string | null; planName: string | null; state: string | null }): CampaignRecipient {
  return { email: (c.email || '').trim(), name: c.fullName, insurer: c.insurer, planName: c.planName, state: c.state }
}

interface DeliverableCampaign {
  id: string; agencyId: string; subject: string; message: string
  segment: string; images: string | null; buttonText: string | null; buttonUrl: string | null
}

// Envía una campaña YA guardada a su segmento, con pixel de apertura, y marca
// sentAt/sentCount/failedCount. Limpia scheduledAt (ya se envió).
export async function deliverCampaign(campaign: DeliverableCampaign, origin: string): Promise<{ sent: number; failed: number }> {
  const agencyId = campaign.agencyId
  const segment = parseSegment(campaign.segment)
  const where = buildSegmentWhere(agencyId, segment)
  const all = await prisma.client.findMany({ where, select: CLIENT_SELECT, orderBy: { fullName: 'asc' } })
  const recipients = smartPostFilter(all, segment)
    .filter(c => c.email && c.email.trim())
    .map(toRecipient)
    .slice(0, MAX_PER_SEND)

  let result = { sent: 0, failed: 0, errors: [] as string[] }
  if (recipients.length > 0) {
    const brand = await getCampaignBrand(agencyId, origin)
    const button = campaign.buttonText?.trim() && campaign.buttonUrl?.trim() ? { text: campaign.buttonText, url: campaign.buttonUrl } : null
    const trackUrl = `${origin}/api/campaigns/track/${campaign.id}`
    result = await sendCampaign(agencyId, recipients, campaign.subject, campaign.message, brand, parseImages(campaign.images), button, trackUrl)
  }
  await prisma.campaign.update({
    where: { id: campaign.id },
    data: { sentAt: new Date(), sentCount: result.sent, failedCount: result.failed, scheduledAt: null },
  }).catch(() => {})
  return { sent: result.sent, failed: result.failed }
}

// Envía las campañas PROGRAMADAS cuya hora ya pasó (y aún no se enviaron).
export async function runDueScheduledCampaigns(origin: string): Promise<{ processed: number; sent: number }> {
  const due = await prisma.campaign.findMany({
    where: { scheduledAt: { not: null, lte: new Date() }, sentAt: null },
    take: 25,
  })
  let sent = 0
  for (const c of due) {
    if (!c.agencyId) continue
    try { sent += (await deliverCampaign(c as DeliverableCampaign, origin)).sent } catch (e) { console.error('scheduled campaign failed', c.id, e) }
  }
  return { processed: due.length, sent }
}

// Procesa las AUTOMATIZACIONES habilitadas. Anti-duplicado con NotificationLog
// (unique agencyId+type+refId): se "reclama" antes de enviar, así nunca se manda
// dos veces el mismo correo al mismo cliente/período.
export async function runAutomations(origin: string): Promise<{ byType: Record<string, number> }> {
  const autos = await prisma.automation.findMany({ where: { enabled: true } })
  const now = new Date()
  const byType: Record<string, number> = {}

  for (const a of autos) {
    if (!a.agencyId) continue
    const brand = await getCampaignBrand(a.agencyId, origin)
    const button = a.buttonText?.trim() && a.buttonUrl?.trim() ? { text: a.buttonText, url: a.buttonUrl } : null
    const images = parseImages(a.images)
    const logType = `auto-${a.type}`

    let targets: { id: string; fullName: string; email: string | null; insurer: string | null; planName: string | null; state: string | null }[] = []
    let refIdFor: (id: string) => string = id => id

    if (a.type === 'birthday') {
      const cands = await prisma.client.findMany({ where: { agencyId: a.agencyId, status: 'Activo', email: { not: null } }, select: CLIENT_SELECT })
      targets = cands.filter(c => {
        if (!c.birthDate) return false
        const d = new Date(c.birthDate)
        return !isNaN(d.getTime()) && d.getUTCMonth() === now.getMonth() && d.getUTCDate() === now.getDate()
      })
      refIdFor = id => `${id}:${now.getFullYear()}`
    } else if (a.type === 'renewal') {
      const days = a.daysBefore ?? 30
      const t = new Date(now); t.setDate(t.getDate() + days)
      const start = new Date(t.getFullYear(), t.getMonth(), t.getDate())
      const end = new Date(start.getTime() + 24 * 60 * 60 * 1000)
      targets = await prisma.client.findMany({ where: { agencyId: a.agencyId, status: 'Activo', email: { not: null }, renewalDate: { gte: start, lt: end } }, select: CLIENT_SELECT })
      refIdFor = id => `${id}:${start.getFullYear()}`
    } else if (a.type === 'welcome') {
      const since = new Date(now.getTime() - 24 * 60 * 60 * 1000)
      targets = await prisma.client.findMany({ where: { agencyId: a.agencyId, email: { not: null }, createdAt: { gte: since } }, select: CLIENT_SELECT })
      refIdFor = id => id
    } else {
      continue
    }

    let sent = 0
    for (const c of targets) {
      if (!c.email || !c.email.trim()) continue
      const refId = refIdFor(c.id)
      // Reclamar el envío de forma atómica: si ya existe el log, se salta.
      try {
        await prisma.notificationLog.create({ data: { agencyId: a.agencyId, type: logType, refId } })
      } catch { continue }
      try {
        const r = await sendCampaign(a.agencyId, [toRecipient(c)], a.subject, a.message, brand, images, button)
        sent += r.sent
      } catch (e) { console.error('automation send failed', a.type, c.id, e) }
    }
    byType[a.type] = (byType[a.type] || 0) + sent
  }
  return { byType }
}
