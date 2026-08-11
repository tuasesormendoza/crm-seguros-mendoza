// ─────────────────────────────────────────────────────────────────────────────
// ETAPAS DE LA RESEÑA DE GOOGLE
//
// Las etapas estaban repetidas a mano en el Dashboard, el formulario de cliente
// y la línea de tiempo del perfil. Al añadir la página de Reseñas se centralizan
// aquí: si mañana se añade una etapa, se añade en un solo sitio.
//
// El valor guardado en Client.googleReview es el texto de `key` tal cual.
// Un cliente sin dato cuenta como "Pendiente por enviar" (es lo que es: aún no
// se le ha pedido nada).
// ─────────────────────────────────────────────────────────────────────────────

export interface ReviewStage {
  key: string
  short: string
  icon: string
  color: string
  bg: string
  border: string
  /** Qué significa, en la voz que usaría el agente. */
  desc: string
}

export const REVIEW_STAGES: ReviewStage[] = [
  {
    key: 'Pendiente por enviar', short: 'Pendiente', icon: '📋',
    color: '#64748b', bg: '#f8fafc', border: '#e2e8f0',
    desc: 'Aún no se le ha pedido la reseña.',
  },
  {
    key: 'Enviada', short: 'Enviada', icon: '📤',
    color: '#2563eb', bg: '#eff6ff', border: '#bfdbfe',
    desc: 'Ya se le mandó el enlace.',
  },
  {
    key: 'Esperando por el cliente', short: 'Esperando', icon: '⏳',
    color: '#d97706', bg: '#fffbeb', border: '#fde68a',
    desc: 'Recibió el enlace y falta que la deje.',
  },
  {
    key: 'Realizada', short: 'Realizada', icon: '⭐',
    color: '#059669', bg: '#f0fdf4', border: '#a7f3d0',
    desc: 'Ya dejó su reseña en Google.',
  },
]

export const DEFAULT_STAGE = REVIEW_STAGES[0].key
export const DONE_STAGE = 'Realizada'

/** Etapa de un cliente; sin dato guardado cuenta como pendiente. */
export function stageOf(googleReview: string | null | undefined): string {
  const v = (googleReview || '').trim()
  return REVIEW_STAGES.some(s => s.key === v) ? v : DEFAULT_STAGE
}

export function stageMeta(key: string | null | undefined): ReviewStage {
  return REVIEW_STAGES.find(s => s.key === stageOf(key)) ?? REVIEW_STAGES[0]
}

/**
 * Porcentaje de clientes que ya dejaron la reseña.
 * Se redondea al entero; con 0 clientes es 0 y no NaN.
 */
export function completionPct(clients: { googleReview?: string | null }[]): number {
  if (!clients.length) return 0
  const done = clients.filter(c => stageOf(c.googleReview) === DONE_STAGE).length
  return Math.round((done / clients.length) * 100)
}

/** Cuántos clientes hay en cada etapa, en el orden de REVIEW_STAGES. */
export function countByStage(clients: { googleReview?: string | null }[]): Record<string, number> {
  const out: Record<string, number> = {}
  for (const s of REVIEW_STAGES) out[s.key] = 0
  for (const c of clients) out[stageOf(c.googleReview)]++
  return out
}

/**
 * Mensaje de WhatsApp según en qué etapa esté el cliente: la primera vez se
 * pide, después se recuerda. A quien ya la dejó no se le insiste.
 */
export function messageFor(
  stage: string, tpl: { first: string; reminder: string },
  vars: { nombre: string; link: string; agente: string },
): string | null {
  if (stageOf(stage) === DONE_STAGE) return null
  const base = stageOf(stage) === DEFAULT_STAGE ? tpl.first : tpl.reminder
  return base
    .replace(/\{nombre\}/g, vars.nombre)
    .replace(/\{link\}/g, vars.link)
    .replace(/\{agente\}/g, vars.agente)
}

/** Enlace de WhatsApp con el mensaje ya escrito. '' si no se puede mandar. */
export function whatsappLink(phone: string | null | undefined, message: string | null): string {
  if (!phone || !message) return ''
  const digits = phone.replace(/\D/g, '')
  if (digits.length < 10) return ''
  const intl = digits.length === 10 ? `1${digits}` : digits
  return `https://wa.me/${intl}?text=${encodeURIComponent(message)}`
}
