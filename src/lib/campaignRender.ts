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
  reviewLink?: string     // enlace de reseña de Google (para {reseña})
}

// ── Variables de personalización (mail-merge) ────────────────────────────────
// Cada cliente recibe SU propio valor. Se insertan escribiendo {clave}.
export const CAMPAIGN_VARS: { key: string; label: string }[] = [
  { key: 'nombre', label: 'Nombre del cliente' },
  { key: 'aseguradora', label: 'Aseguradora del cliente' },
  { key: 'plan', label: 'Plan del cliente' },
  { key: 'estado', label: 'Estado del cliente' },
  { key: 'agente', label: 'Tu nombre / agencia' },
  { key: 'telefono', label: 'Tu teléfono' },
  { key: 'reseña', label: 'Enlace de reseña Google' },
]

// Datos de un cliente (o muestra) para resolver las variables de la campaña.
export interface CampaignVarSource { name: string; insurer?: string | null; planName?: string | null; state?: string | null }

// Construye el mapa de variables para un cliente + la marca de la agencia.
export function campaignVarsFor(c: CampaignVarSource, brand: CampaignBrand): Record<string, string> {
  const first = (c.name || '').trim().split(/\s+/)[0] || ''
  return {
    nombre: first,
    aseguradora: c.insurer || '',
    plan: c.planName || '',
    estado: c.state || '',
    agente: brand.agencyName || '',
    telefono: brand.phone || '',
    'reseña': brand.reviewLink || '',
  }
}

// Reemplaza {clave} por su valor (claves insensibles a mayúsculas). Deja intactos
// los {que no reconoce} para no borrar texto por error.
export function applyVars(text: string, vars: Record<string, string>): string {
  return text.replace(/\{([^}\n]{1,30})\}/g, (m, k) => {
    const key = String(k).trim().toLowerCase()
    return key in vars ? vars[key] : m
  })
}

function normalizeUrl(url: string): string {
  const u = url.trim()
  if (!u) return ''
  return /^https?:\/\//i.test(u) ? u : `https://${u}`
}

// ── Formato enriquecido (markdown-lite y seguro) ─────────────────────────────
// Se ESCAPA primero (sin HTML del usuario) y luego se agregan SOLO nuestras
// etiquetas: negrita **x**, cursiva *x*, viñetas "- x" y enlaces automáticos.
function inlineFormat(s: string): string {
  return s
    .replace(/\*\*([^*\n]+)\*\*/g, '<strong>$1</strong>')
    .replace(/\*([^*\n]+)\*/g, '<em>$1</em>')
    .replace(/(https?:\/\/[^\s<]+)/g, '<a href="$1" target="_blank" style="color:#2a6496;text-decoration:underline">$1</a>')
}

function formatBody(raw: string): string {
  const escaped = escapeHtml(raw)
  const lines = escaped.split('\n')
  const out: string[] = []
  let inList = false
  for (const line of lines) {
    const m = /^\s*[-•]\s+(.*)$/.exec(line)
    if (m) {
      if (!inList) { out.push('<ul style="margin:10px 0;padding-left:22px">'); inList = true }
      out.push(`<li style="margin:3px 0">${inlineFormat(m[1])}</li>`)
    } else {
      if (inList) { out.push('</ul>'); inList = false }
      out.push(inlineFormat(line) + '<br>')
    }
  }
  if (inList) out.push('</ul>')
  return out.join('')
}

// `imageSrcs` son los src ya resueltos según el modo:
//   preview → dataUrl · envío → `cid:imgN`
export function renderCampaignHtml(
  body: string,
  vars: Record<string, string>,
  brand: CampaignBrand,
  imageSrcs: string[] = [],
  button?: CampaignButton | null,
): string {
  const name = escapeHtml(brand.agencyName || 'Tu agente de seguros')
  const header = brand.headerColor || '#0D2A4A'
  const accent = brand.accentColor || '#2a6496'

  const htmlBody = formatBody(applyVars(body, vars))

  const imagesHtml = imageSrcs
    .map(src => `<div style="margin-top:16px;text-align:center"><img src="${src}" alt="" style="max-width:100%;border-radius:8px"/></div>`)
    .join('')

  const buttonHtml = button && button.text.trim() && button.url.trim()
    ? `<div style="text-align:center;margin:26px 0 6px">
         <a href="${escapeHtml(normalizeUrl(applyVars(button.url, vars)))}" target="_blank"
            style="display:inline-block;background:${accent};color:#ffffff;text-decoration:none;font-weight:bold;font-size:15px;padding:13px 30px;border-radius:8px">
           ${escapeHtml(applyVars(button.text, vars))}
         </a>
       </div>`
    : ''

  const brandTop = brand.logoUrl
    ? `<img src="${escapeHtml(brand.logoUrl)}" alt="${name}" style="max-height:46px;max-width:220px;display:inline-block"/>`
    : `<div style="color:#ffffff;font-size:20px;font-weight:800;letter-spacing:-0.3px">${name}</div>`

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

// Reemplaza las variables en el asunto (sin HTML).
export function renderCampaignSubject(subject: string, vars: Record<string, string>): string {
  return applyVars(subject, vars)
}
