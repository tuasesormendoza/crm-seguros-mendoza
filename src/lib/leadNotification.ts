// ─────────────────────────────────────────────────────────────────────────────
// AVISO DE LEAD NUEVO
//
// Cuando entra un prospecto desde la web de la agencia, se manda un correo al
// agente para que no dependa de abrir el CRM. Está pensado para leerse en el
// móvil: lo importante en el asunto (nombre y teléfono, visibles sin abrirlo)
// y botones grandes para llamar o escribir por WhatsApp de un toque.
//
// El envío NUNCA debe tumbar la entrada del lead: si el correo falla, el
// prospecto ya está guardado y el visitante recibe su 201 igual. Por eso la
// ruta llama a esto dentro de un try/catch y el resultado solo se registra.
// ─────────────────────────────────────────────────────────────────────────────

export interface LeadAviso {
  fullName: string
  phone?: string | null
  email?: string | null
  state?: string | null
  householdSize?: string | null
  income?: string | null
  notes?: string | null
  source?: string | null
  consentAt?: Date | null
}

/** Etiquetas legibles para los códigos que manda el quiz. */
const HOGAR: Record<string, string> = {
  '1': 'Solo él/ella',
  '2': '2 personas',
  '3-4': '3 a 4 personas',
  '5+': '5 o más personas',
}
const INGRESO: Record<string, string> = {
  'low': 'Menos de $1,500/mes',
  'mid-low': '$1,500 – $3,000/mes',
  'mid': '$3,000 – $5,000/mes',
  'high': 'Más de $5,000/mes',
}

export function etiquetaHogar(v?: string | null): string | null {
  if (!v) return null
  return HOGAR[v] || v
}
export function etiquetaIngreso(v?: string | null): string | null {
  if (!v) return null
  return INGRESO[v] || v
}

/** Solo dígitos, para construir los enlaces de llamada y WhatsApp. */
export function digitosTelefono(v?: string | null): string {
  return (v || '').replace(/\D/g, '')
}

/**
 * Asunto del correo. Lleva el nombre y el teléfono porque en el móvil muchas
 * veces es lo único que se ve en la notificación, y con eso ya se puede actuar.
 */
export function asuntoAviso(lead: LeadAviso): string {
  const tel = lead.phone ? ' · ' + lead.phone : ''
  return `🔔 Lead nuevo: ${lead.fullName}${tel}`
}

const esc = (s: unknown): string =>
  String(s ?? '').replace(/[&<>"]/g, c =>
    ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c] as string))

/** Cuerpo del correo, en HTML sencillo para que se vea bien en cualquier móvil. */
export function cuerpoAviso(lead: LeadAviso, ahora: Date = new Date()): string {
  const filas: Array<[string, string | null]> = [
    ['Teléfono', lead.phone || null],
    ['Email', lead.email || null],
    ['Estado', lead.state || null],
    ['Hogar', etiquetaHogar(lead.householdSize)],
    ['Ingreso', etiquetaIngreso(lead.income)],
    ['Origen', lead.source || null],
  ]

  const celdas = filas
    .filter(([, v]) => v)
    .map(([k, v]) => `
      <tr>
        <td style="padding:8px 0;color:#4A6080;font-size:14px;width:110px;vertical-align:top">${esc(k)}</td>
        <td style="padding:8px 0;color:#121F2E;font-size:15px;font-weight:600">${esc(v)}</td>
      </tr>`).join('')

  const tel = digitosTelefono(lead.phone)
  const botones = tel ? `
    <table cellpadding="0" cellspacing="0" style="margin:22px 0 8px">
      <tr>
        <td style="padding-right:10px">
          <a href="tel:+1${esc(tel)}" style="display:inline-block;background:#0D2A4A;color:#fff;text-decoration:none;padding:14px 26px;border-radius:999px;font-size:16px;font-weight:700">📞 Llamar</a>
        </td>
        <td>
          <a href="https://wa.me/1${esc(tel)}" style="display:inline-block;background:#25D366;color:#fff;text-decoration:none;padding:14px 26px;border-radius:999px;font-size:16px;font-weight:700">💬 WhatsApp</a>
        </td>
      </tr>
    </table>` : ''

  const consentimiento = lead.consentAt
    ? `<p style="margin:16px 0 0;padding:11px 13px;background:#EAF5EC;border-radius:8px;color:#1A5228;font-size:13px">
         ✅ Autorizó ser contactado el ${esc(ahora.toLocaleString('es-US', { timeZone: 'America/New_York' }))}
       </p>`
    : `<p style="margin:16px 0 0;padding:11px 13px;background:#FFF8E6;border-radius:8px;color:#8A6200;font-size:13px">
         ⚠️ No marcó la casilla de autorización. Ten cuidado antes de llamar o textear.
       </p>`

  const nota = lead.notes
    ? `<p style="margin:16px 0 0;color:#3A5070;font-size:14px;line-height:1.6"><strong>Nota:</strong> ${esc(lead.notes)}</p>`
    : ''

  return `<!DOCTYPE html>
<html lang="es"><body style="margin:0;padding:0;background:#F4F7FA;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif">
  <table cellpadding="0" cellspacing="0" width="100%" style="background:#F4F7FA;padding:20px 12px">
    <tr><td align="center">
      <table cellpadding="0" cellspacing="0" width="100%" style="max-width:520px;background:#fff;border-radius:14px;overflow:hidden;box-shadow:0 2px 12px rgba(13,42,74,.08)">
        <tr><td style="background:#0D2A4A;padding:20px 24px">
          <div style="color:#F0C040;font-size:12px;font-weight:700;letter-spacing:1.2px;text-transform:uppercase">Lead nuevo desde tu web</div>
          <div style="color:#fff;font-size:22px;font-weight:800;margin-top:4px">${esc(lead.fullName)}</div>
        </td></tr>
        <tr><td style="padding:20px 24px 24px">
          <table cellpadding="0" cellspacing="0" width="100%">${celdas}</table>
          ${botones}
          ${consentimiento}
          ${nota}
          <p style="margin:22px 0 0;padding-top:16px;border-top:1px solid #E2EAF2;color:#4A6080;font-size:13px">
            Ya está guardado en tu CRM, en <strong>Nuevo Lead (Por Contactar)</strong>.
          </p>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body></html>`
}
