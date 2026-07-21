// Renderizado del correo de campaña. Vive en su propio módulo (solo strings,
// sin dependencias de servidor) para que el ENVÍO (src/lib/email.ts) y la VISTA
// PREVIA (página de Campañas) usen exactamente el mismo HTML — lo que ves es lo
// que se envía.

export function escapeHtml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&#39;')
}

// Imagen adjunta a la campaña. En la VISTA PREVIA se usa el dataUrl directo;
// en el ENVÍO se referencia por CID (nodemailer la incrusta como adjunto inline).
export interface CampaignImage { name: string; dataUrl: string }

// Botón de llamado a la acción (CTA) opcional.
export interface CampaignButton { text: string; url: string }

// Marca de la agencia para dar identidad al correo (logo, colores, contacto).
export interface CampaignBrand {
  agencyName: string
  logoUrl?: string        // URL del logo (relativa en preview, absoluta en envío) o vacío
  headerColor?: string    // color del encabezado
  accentColor?: string    // color del botón CTA
  phone?: string
  whatsapp?: string
  email?: string
}

function normalizeUrl(url: string): string {
  const u = url.trim()
  if (!u) return ''
  return /^https?:\/\//i.test(u) ? u : `https://${u}`
}

// `imageSrcs` son los src ya resueltos según el modo:
//   preview → dataUrl · envío → `cid:imgN`
export function renderCampaignHtml(
  body: string,
  firstName: string,
  brand: CampaignBrand,
  imageSrcs: string[] = [],
  button?: CampaignButton | null,
): string {
  const name = escapeHtml(brand.agencyName || 'Tu agente de seguros')
  const header = brand.headerColor || '#0D2A4A'
  const accent = brand.accentColor || '#2a6496'

  const personalized = body
    .replace(/\{nombre\}/g, firstName)
    .replace(/\{agente\}/g, brand.agencyName || '')
  const htmlBody = escapeHtml(personalized).replace(/\n/g, '<br>')

  const imagesHtml = imageSrcs
    .map(src => `<div style="margin-top:16px;text-align:center"><img src="${src}" alt="" style="max-width:100%;border-radius:8px"/></div>`)
    .join('')

  const buttonHtml = button && button.text.trim() && button.url.trim()
    ? `<div style="text-align:center;margin:26px 0 6px">
         <a href="${escapeHtml(normalizeUrl(button.url))}" target="_blank"
            style="display:inline-block;background:${accent};color:#ffffff;text-decoration:none;font-weight:bold;font-size:15px;padding:13px 30px;border-radius:8px">
           ${escapeHtml(button.text)}
         </a>
       </div>`
    : ''

  const brandTop = brand.logoUrl
    ? `<img src="${escapeHtml(brand.logoUrl)}" alt="${name}" style="max-height:46px;max-width:220px;display:inline-block"/>`
    : `<div style="color:#ffffff;font-size:20px;font-weight:800;letter-spacing:-0.3px">${name}</div>`

  // Línea de contacto del pie (solo lo que exista).
  const contactBits: string[] = []
  if (brand.phone) contactBits.push(`📞 ${escapeHtml(brand.phone)}`)
  if (brand.whatsapp) contactBits.push(`💬 WhatsApp`)
  if (brand.email) contactBits.push(`✉️ ${escapeHtml(brand.email)}`)
  const contactLine = contactBits.join('&nbsp;&nbsp;·&nbsp;&nbsp;')

  return `<div style="background:#f3f4f6;padding:24px 12px;font-family:Arial,Helvetica,sans-serif">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:600px;margin:0 auto;background:#ffffff;border-radius:12px;overflow:hidden;box-shadow:0 2px 8px rgba(13,42,74,.10)">
    <tr>
      <td style="background:${header};padding:22px 28px;text-align:center">${brandTop}</td>
    </tr>
    <tr>
      <td style="padding:28px 28px 22px">
        <div style="font-size:15px;color:#1f2937;line-height:1.7">${htmlBody}</div>
        ${imagesHtml}
        ${buttonHtml}
      </td>
    </tr>
    <tr>
      <td style="background:#f9fafb;padding:18px 28px;border-top:1px solid #eef2f7">
        <div style="font-size:13px;color:#111827;font-weight:bold">${name}</div>
        ${contactLine ? `<div style="font-size:12px;color:#4b5563;margin-top:3px">${contactLine}</div>` : ''}
        <div style="font-size:11px;color:#9ca3af;margin-top:12px;line-height:1.5">
          Recibes este mensaje porque eres cliente de ${name}.
          Si no deseas recibir más comunicaciones, responde a este correo con la palabra <strong>BAJA</strong>.
        </div>
      </td>
    </tr>
  </table>
</div>`
}

// Reemplaza {nombre} en el asunto (sin HTML).
export function renderCampaignSubject(subject: string, firstName: string): string {
  return subject.replace(/\{nombre\}/g, firstName)
}
