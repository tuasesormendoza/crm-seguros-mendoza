import nodemailer from 'nodemailer'
import { prisma } from './prisma'
import { renderCampaignHtml, renderCampaignSubject, type CampaignImage } from './campaignRender'

// Multi-tenant: la configuración de email (SMTP) es POR AGENCIA. Siempre se debe
// pasar el agencyId para no mezclar credenciales entre inquilinos.
export async function getEmailConfig(agencyId: string) {
  const rows = await prisma.settings.findMany({
    where: { agencyId, key: { in: ['emailEnabled','emailFrom','emailTo','smtpHost','smtpPort','smtpUser','smtpPass'] } }
  })
  const map: Record<string,string> = {}
  rows.forEach(r => { map[r.key] = r.value })
  return {
    enabled: map.emailEnabled === 'true',
    from: map.emailFrom || map.emailTo || '',
    to: map.emailTo || '',
    host: map.smtpHost || 'smtp.gmail.com',
    port: parseInt(map.smtpPort || '587'),
    user: map.smtpUser || '',
    pass: map.smtpPass || '',
  }
}

export async function sendEmail(agencyId: string, subject: string, html: string) {
  const cfg = await getEmailConfig(agencyId)
  if (!cfg.enabled || !cfg.to || !cfg.user || !cfg.pass) return { sent: false, reason: 'Email not configured' }

  const transporter = nodemailer.createTransport({
    host: cfg.host,
    port: cfg.port,
    secure: cfg.port === 465,
    auth: { user: cfg.user, pass: cfg.pass },
    tls: { rejectUnauthorized: false },
  })

  await transporter.sendMail({
    from: cfg.from || cfg.user,
    to: cfg.to,
    subject,
    html,
  })
  return { sent: true }
}

// ── Campañas (envío masivo a CLIENTES) ───────────────────────────────────────

export interface CampaignRecipient { email: string; name: string }

// Envía una campaña a varios clientes reutilizando una sola conexión SMTP en
// pool (rápido y sin abrir/cerrar por correo). Personaliza {nombre} y agrega un
// pie con opción de baja. Devuelve conteos y los primeros errores.
export async function sendCampaign(
  agencyId: string,
  recipients: CampaignRecipient[],
  subject: string,
  body: string,
  agencyName: string,
  images: CampaignImage[] = [],
): Promise<{ sent: number; failed: number; errors: string[] }> {
  const cfg = await getEmailConfig(agencyId)
  if (!cfg.enabled || !cfg.user || !cfg.pass) {
    return { sent: 0, failed: recipients.length, errors: ['El email no está configurado en Configuración → Notificaciones por Email.'] }
  }

  // Imágenes → adjuntos inline referenciados por CID en el HTML.
  const attachments = images.map((img, i) => {
    const match = /^data:([^;]+);base64,(.+)$/.exec(img.dataUrl)
    return match ? {
      filename: img.name || `imagen-${i + 1}`,
      content: Buffer.from(match[2], 'base64'),
      contentType: match[1],
      cid: `img${i}`,
    } : null
  }).filter((a): a is NonNullable<typeof a> => a !== null)
  const imageSrcs = attachments.map(a => `cid:${a.cid}`)

  const transporter = nodemailer.createTransport({
    host: cfg.host,
    port: cfg.port,
    secure: cfg.port === 465,
    auth: { user: cfg.user, pass: cfg.pass },
    pool: true,
    maxConnections: 5,
    tls: { rejectUnauthorized: false },
  })

  let sent = 0, failed = 0
  const errors: string[] = []
  await Promise.all(recipients.map(async r => {
    try {
      const first = r.name.split(' ')[0]
      await transporter.sendMail({
        from: cfg.from || cfg.user,
        to: r.email,
        subject: renderCampaignSubject(subject, first),
        html: renderCampaignHtml(body, first, agencyName, imageSrcs),
        attachments,
      })
      sent++
    } catch (err) {
      failed++
      if (errors.length < 5) errors.push(`${r.email}: ${err instanceof Error ? err.message : 'error'}`)
    }
  }))
  transporter.close()
  return { sent, failed, errors }
}
