// Renderizado del correo de campaña. Vive en su propio módulo (solo strings,
// sin dependencias de servidor) para que el ENVÍO (src/lib/email.ts) y la VISTA
// PREVIA (página de Campañas) usen exactamente el mismo HTML — lo que ves es lo
// que se envía.

export function escapeHtml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
}

// Convierte el texto plano de la campaña (con {nombre}) en HTML seguro, con el
// pie de "baja".
export function renderCampaignHtml(body: string, firstName: string, agencyName: string): string {
  const personalized = body.replace(/\{nombre\}/g, firstName)
  const htmlBody = escapeHtml(personalized).replace(/\n/g, '<br>')
  return `<div style="font-family:Arial,sans-serif;font-size:14px;color:#1f2937;line-height:1.6">
    ${htmlBody}
    <hr style="border:none;border-top:1px solid #e5e7eb;margin:20px 0">
    <p style="font-size:11px;color:#9ca3af">
      Recibes este mensaje porque eres cliente de ${escapeHtml(agencyName)}.
      Si no deseas recibir más comunicaciones, responde a este correo con la palabra <strong>BAJA</strong>.
    </p>
  </div>`
}

// Reemplaza {nombre} en el asunto (sin HTML).
export function renderCampaignSubject(subject: string, firstName: string): string {
  return subject.replace(/\{nombre\}/g, firstName)
}
