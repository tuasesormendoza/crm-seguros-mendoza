import { NextRequest, NextResponse } from 'next/server'
import nodemailer from 'nodemailer'
import { prisma } from '@/lib/prisma'
import { readFile } from 'fs/promises'
import path from 'path'
import { getAuth } from '@/lib/auth'

/**
 * Finds the logo file in /public and returns a base64 data URL.
 * Email clients can't access localhost URLs, so we embed the image inline.
 */
async function getLogoBase64(): Promise<string | null> {
  const exts = ['png', 'jpg', 'jpeg', 'webp', 'svg']
  for (const ext of exts) {
    try {
      const filePath = path.join(process.cwd(), 'public', `brand-logo.${ext}`)
      const buffer = await readFile(filePath)
      const mime = ext === 'svg' ? 'image/svg+xml'
        : ext === 'jpg' || ext === 'jpeg' ? 'image/jpeg'
        : ext === 'webp' ? 'image/webp'
        : 'image/png'
      return `data:${mime};base64,${buffer.toString('base64')}`
    } catch {
      // file doesn't exist, try next extension
    }
  }
  return null
}

/**
 * Replace any local logo src with base64 data URL so it renders in all email clients.
 * Email clients (Gmail, Outlook) can't access localhost URLs or relative paths.
 */
async function inlineLogoForEmail(html: string): Promise<string> {
  const logoBase64 = await getLogoBase64()
  if (!logoBase64) return html

  // Replace all these patterns:
  // /brand-logo.png?v=123  (relative path)
  // http://localhost:3000/brand-logo.png  (localhost)
  return html
    .replace(/src="\/brand-logo\.[^"]+"/gi, `src="${logoBase64}"`)
    .replace(/src="http:\/\/localhost:[0-9]+\/brand-logo\.[^"]+"/gi, `src="${logoBase64}"`)
    .replace(/src='\/brand-logo\.[^']+'/gi, `src='${logoBase64}'`)
}

export async function POST(request: NextRequest) {
  const auth = await getAuth()
  if (auth instanceof NextResponse) return auth

  const { toEmail, toName, subject, html } = await request.json()

  if (!toEmail) return NextResponse.json({ error: 'Email del destinatario requerido' }, { status: 400 })
  if (!subject) return NextResponse.json({ error: 'Asunto requerido' }, { status: 400 })
  if (!html)    return NextResponse.json({ error: 'Contenido del documento requerido' }, { status: 400 })

  // Get SMTP config from settings (por agencia)
  const rows = await prisma.settings.findMany({
    where: { agencyId: auth.agencyId, key: { in: ['smtpHost','smtpPort','smtpUser','smtpPass','emailFrom','agentName'] } }
  })
  const s: Record<string, string> = {}
  rows.forEach(r => { s[r.key] = r.value })

  const user     = s.smtpUser || ''
  const pass     = s.smtpPass || ''
  const host     = s.smtpHost || 'smtp.gmail.com'
  const port     = parseInt(s.smtpPort || '587')
  const fromName = s.agentName || 'Agente de Seguros'
  const fromEmail = s.emailFrom || s.smtpUser || ''

  if (!user || !pass) {
    return NextResponse.json({
      error: 'SMTP no configurado. Ve a ⚙️ Configuración → Notificaciones por Email y agrega tus credenciales.'
    }, { status: 400 })
  }

  try {
    // Embed logo as base64 so it shows in all email clients
    const emailHtml = await inlineLogoForEmail(html)

    const transporter = nodemailer.createTransport({
      host, port,
      secure: port === 465,
      auth: { user, pass },
      tls: { rejectUnauthorized: false },
    })

    await transporter.sendMail({
      from: `"${fromName}" <${fromEmail || user}>`,
      to: toName ? `"${toName}" <${toEmail}>` : toEmail,
      subject,
      html: emailHtml,
    })

    return NextResponse.json({ success: true, sentTo: toEmail })
  } catch (err) {
    const msg = (err as Error).message
    return NextResponse.json({
      error: `Error al enviar: ${
        msg.includes('Invalid login') || msg.includes('535') || msg.includes('534')
          ? 'Credenciales incorrectas. Verifica usuario y contraseña de aplicación en Configuración.'
          : msg.slice(0, 150)
      }`
    }, { status: 500 })
  }
}
