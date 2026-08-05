import { NextRequest, NextResponse } from 'next/server'
import nodemailer from 'nodemailer'
import { prisma } from '@/lib/prisma'
import { readFileBuffer, docScope } from '@/lib/storage'
import { getAuth } from '@/lib/auth'
import { logAudit } from '@/lib/audit'

// Envía un documento YA SUBIDO como archivo adjunto.
//
// Distinto de /api/documents/send, que manda una carta generada por el CRM
// como cuerpo HTML. Aquí lo que viaja es el archivo tal cual: es lo que hace
// falta para mandarle el formulario ETF a Washington National.

type RouteContext = { params: Promise<{ docId: string }> }

export async function POST(request: NextRequest, ctx: RouteContext) {
  const auth = await getAuth()
  if (auth instanceof NextResponse) return auth
  const { docId } = await ctx.params

  const doc = await prisma.document.findFirst({ where: { id: docId, agencyId: auth.agencyId } })
  if (!doc) return NextResponse.json({ error: 'Documento no encontrado.' }, { status: 404 })

  const b = await request.json().catch(() => ({}))
  const toEmail = String(b.toEmail || '').trim()
  if (!toEmail) return NextResponse.json({ error: 'Falta el email del destinatario.' }, { status: 400 })

  const rows = await prisma.settings.findMany({
    where: { agencyId: auth.agencyId, key: { in: ['smtpHost', 'smtpPort', 'smtpUser', 'smtpPass', 'emailFrom', 'agentName'] } },
  })
  const s: Record<string, string> = {}
  rows.forEach(r => { s[r.key] = r.value })

  const user = s.smtpUser || ''
  const pass = s.smtpPass || ''
  if (!user || !pass) {
    return NextResponse.json({
      error: 'SMTP no configurado. Ve a ⚙️ Configuración → Notificaciones por Email y agrega tus credenciales.',
    }, { status: 400 })
  }

  const fromName = s.agentName || 'Agente de Seguros'
  const fromEmail = s.emailFrom || user
  const subject = String(b.subject || '').trim() || `${doc.category}: ${doc.fileName}`
  const message = String(b.message || '').trim()

  let buffer: Buffer
  try {
    buffer = await readFileBuffer(docScope(doc), doc.storedName)
  } catch {
    return NextResponse.json({ error: 'El archivo ya no está en el servidor. Vuelve a subirlo.' }, { status: 404 })
  }

  try {
    const port = parseInt(s.smtpPort || '587')
    const transporter = nodemailer.createTransport({
      host: s.smtpHost || 'smtp.gmail.com',
      port,
      secure: port === 465,
      auth: { user, pass },
      tls: { rejectUnauthorized: false },
    })

    await transporter.sendMail({
      from: `"${fromName}" <${fromEmail}>`,
      to: b.toName ? `"${String(b.toName)}" <${toEmail}>` : toEmail,
      subject,
      text: message || `Adjunto ${doc.fileName}.\n\n${fromName}`,
      attachments: [{ filename: doc.fileName, content: buffer, contentType: doc.mimeType }],
    })
  } catch (err) {
    const msg = (err as Error).message
    return NextResponse.json({
      error: `Error al enviar: ${
        msg.includes('Invalid login') || msg.includes('535') || msg.includes('534')
          ? 'Credenciales incorrectas. Verifica usuario y contraseña de aplicación en Configuración.'
          : msg.slice(0, 150)
      }`,
    }, { status: 500 })
  }

  await logAudit(auth, {
    action: 'send', entity: 'document', entityId: doc.id, entityLabel: doc.fileName,
    metadata: { toEmail, contactId: doc.contactId, clientId: doc.clientId },
  })
  return NextResponse.json({ success: true, sentTo: toEmail })
}
