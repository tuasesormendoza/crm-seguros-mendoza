// ─────────────────────────────────────────────────────────────────────────────
// PERFIL DEL AGENTE
//
// El CRM se vende a otras agencias, así que NO puede traer los datos de nadie
// precargados. Si el nombre, el teléfono o el link de reseñas vinieran con un
// valor por defecto, el agente que acaba de comprarlo enviaría mensajes
// firmados por otra persona —y pediría reseñas para el negocio de otro— sin
// darse cuenta. Un dato de otro es peor que un hueco: el hueco se ve.
//
// Por eso esos ajustes nacen VACÍOS y aquí se decide:
//   • qué falta por rellenar (aviso "completa tu perfil"),
//   • con qué rótulo neutro se sustituye mientras tanto,
//   • qué acciones simplemente no se ofrecen hasta que haya dato.
// ─────────────────────────────────────────────────────────────────────────────

/** Rótulo neutro para cuando la agencia todavía no puso su nombre. */
export const AGENT_FALLBACK = 'Tu Asesor de Seguros'

export interface ProfileField {
  key: string
  label: string
  /** Qué se queda a medias mientras esté vacío. */
  usedFor: string
}

/** Sin esto el CRM no puede escribir en nombre de la agencia. */
export const REQUIRED_PROFILE_FIELDS: ProfileField[] = [
  { key: 'agentName',  label: 'Nombre completo', usedFor: 'firma de mensajes, reportes y documentos' },
  { key: 'agentPhone', label: 'Teléfono',        usedFor: 'encabezado de documentos y pie de campañas' },
]

/** Se echan en falta, pero el CRM funciona sin ellos: se omiten donde irían. */
export const OPTIONAL_PROFILE_FIELDS: ProfileField[] = [
  { key: 'agentWhatsApp',    label: 'WhatsApp Business',         usedFor: 'botón de WhatsApp en las campañas' },
  { key: 'agentEmail',       label: 'Email',                     usedFor: 'encabezado de los documentos' },
  { key: 'googleReviewLink', label: 'Link de reseñas de Google', usedFor: 'mensajes para pedir reseñas' },
  { key: 'cardWebsite',      label: 'Página web',                usedFor: 'pie de la tarjeta de plan y de los documentos' },
]

export const ALL_PROFILE_FIELDS: ProfileField[] = [...REQUIRED_PROFILE_FIELDS, ...OPTIONAL_PROFILE_FIELDS]

type Settings = Record<string, string | null | undefined>

function filled(value: string | null | undefined): boolean {
  return typeof value === 'string' && value.trim().length > 0
}

/** Campos de `fields` que la agencia aún no ha rellenado. */
export function missingProfileFields(settings: Settings, fields: ProfileField[] = ALL_PROFILE_FIELDS): ProfileField[] {
  return fields.filter(f => !filled(settings[f.key]))
}

/** true cuando falta algo imprescindible para escribir en nombre del agente. */
export function isProfileIncomplete(settings: Settings): boolean {
  return missingProfileFields(settings, REQUIRED_PROFILE_FIELDS).length > 0
}

/** Nombre a mostrar. Nunca devuelve el de otra agencia: o el suyo, o neutro. */
export function agentDisplayName(agentName: string | null | undefined): string {
  return (agentName || '').trim() || AGENT_FALLBACK
}

/** Firma de mensajes salientes: "Ana Ruiz, Tu Asesor de Seguros". */
export function agentSignature(agentName: string | null | undefined): string {
  const name = (agentName || '').trim()
  return name ? `${name}, ${AGENT_FALLBACK}` : AGENT_FALLBACK
}

/**
 * Iniciales para el avatar. Sin nombre configurado no se inventan: un guion
 * es más honesto que las iniciales de otro.
 */
export function agentInitials(agentName: string | null | undefined): string {
  const name = (agentName || '').trim()
  if (!name) return '—'
  return name.split(/\s+/).map(w => w[0]).slice(0, 2).join('').toUpperCase()
}

/** Sustituye {clave} por su valor; las claves sin valor quedan vacías. */
export function fillTemplate(template: string, vars: Record<string, string>): string {
  return template.replace(/\{([^{}]+)\}/g, (_, key: string) => vars[key] ?? '')
}

/**
 * Mensaje para pedir una reseña de Google. Devuelve null si la agencia no ha
 * configurado su link: sin link no hay nada que pedir, y mandar el texto a
 * secas (o con el link de otro negocio) sería peor que no ofrecer el botón.
 */
export function reviewMessage(
  template: string,
  clientName: string,
  reviewLink: string | null | undefined,
): string | null {
  const link = (reviewLink || '').trim()
  if (!link) return null
  return fillTemplate(template, { nombre: clientName.split(' ')[0], link })
}
