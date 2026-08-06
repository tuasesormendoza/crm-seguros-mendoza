// ─────────────────────────────────────────────────────────────────────────────
// Entrada pública de leads
//
// Lógica pura para el endpoint POST /api/public/leads, que recibe prospectos
// desde la web pública de una agencia sin sesión iniciada.
//
// IMPORTANTE sobre el modelo de seguridad: la clave de entrada viaja en el
// JavaScript del sitio del agente, así que es PÚBLICA por definición. No
// autentica a nadie: solo enruta el lead hacia la agencia correcta. Lo que
// protege de verdad es la combinación de:
//   · orígenes permitidos por agencia
//   · campo trampa (honeypot) contra bots
//   · validación estricta y topes de longitud
//   · límite de peticiones por IP
//   · interruptor de activación por agencia
// El endpoint solo escribe. Nunca lee ni devuelve datos de la agencia, así que
// una clave filtrada no expone información de ningún cliente.
// ─────────────────────────────────────────────────────────────────────────────

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
const PHONE_RE = /^[\d\s()\-+.]{7,20}$/

export type IntakeErrors = Record<string, string>

export interface IntakeInput {
  key?: unknown
  fullName?: unknown
  phone?: unknown
  email?: unknown
  state?: unknown
  zipCode?: unknown
  householdSize?: unknown
  income?: unknown
  situation?: unknown
  consent?: unknown
  notes?: unknown
  sourceDetail?: unknown
  // Campo trampa: invisible para las personas, atractivo para los bots.
  company?: unknown
}

/** Genera una clave de entrada para una agencia. No es un secreto. */
export function generateIntakeKey(rand: () => string = () =>
  Math.random().toString(36).slice(2)): string {
  return 'ak_' + (rand() + rand() + rand()).replace(/[^a-z0-9]/g, '').slice(0, 32)
}

/** ¿Parece una clave de entrada bien formada? Evita consultar la BD por basura. */
export function looksLikeKey(v: unknown): boolean {
  return typeof v === 'string' && /^ak_[a-z0-9]{16,40}$/.test(v)
}

/**
 * ¿El origen de la petición está entre los permitidos por la agencia?
 * Compara solo el host, ignorando protocolo y puerto, y trata `www.` como
 * equivalente para no obligar al agente a listar las dos variantes.
 */
export function originAllowed(origin: string | null, allowed: string | null): boolean {
  if (!allowed || !allowed.trim()) return false   // sin lista configurada, no se acepta nada
  if (!origin) return false

  const host = (o: string): string => {
    let h = o.trim().toLowerCase()
    h = h.replace(/^https?:\/\//, '').replace(/\/.*$/, '').replace(/:\d+$/, '')
    return h.replace(/^www\./, '')
  }

  const pedido = host(origin)
  if (!pedido) return false
  return allowed.split(',').map(host).filter(Boolean).includes(pedido)
}

const str = (v: unknown, max: number): string | null => {
  if (typeof v !== 'string') return null
  const s = v.trim()
  if (!s) return null
  return s.slice(0, max)
}

/**
 * Valida la entrada. Devuelve un objeto de errores; vacío significa válida.
 * Solo el nombre es obligatorio, más una forma de contactar (teléfono o email):
 * un lead sin forma de contacto no sirve de nada.
 */
export function validateIntake(d: IntakeInput): IntakeErrors {
  const errors: IntakeErrors = {}

  const name = str(d.fullName, 200)
  if (!name) errors.fullName = 'El nombre es requerido'
  else if (name.length < 2) errors.fullName = 'El nombre es demasiado corto'

  const phone = str(d.phone, 20)
  const email = str(d.email, 200)

  if (!phone && !email) {
    errors.contact = 'Se requiere al menos un teléfono o un email'
  }
  if (phone && !PHONE_RE.test(phone)) errors.phone = 'Formato de teléfono inválido'
  if (email && !EMAIL_RE.test(email)) errors.email = 'Formato de email inválido'

  if (d.notes !== undefined && d.notes !== null && typeof d.notes !== 'string') {
    errors.notes = 'Notas inválidas'
  }

  return errors
}

/** ¿Cayó el bot en el campo trampa? */
export function isHoneypotTripped(d: IntakeInput): boolean {
  return typeof d.company === 'string' && d.company.trim().length > 0
}

export interface NormalizedLead {
  fullName: string
  phone: string | null
  email: string | null
  state: string | null
  zipCode: string | null
  householdSize: string | null
  income: string | null
  source: string
  notes: string | null
  consentAt: Date | null
}

/**
 * Convierte la entrada cruda en los campos del modelo Prospect, recortando
 * longitudes y descartando lo que no reconocemos.
 */
export function normalizeIntake(d: IntakeInput, now: Date = new Date()): NormalizedLead {
  const detalle = str(d.sourceDetail, 60)
  const situacion = str(d.situation, 120)
  const notas = str(d.notes, 2000)

  const extra = [
    situacion ? `Situación declarada: ${situacion}` : null,
    notas,
  ].filter(Boolean).join('\n')

  return {
    fullName: str(d.fullName, 200) as string,
    phone: str(d.phone, 20),
    email: str(d.email, 200),
    state: str(d.state, 60),
    zipCode: str(d.zipCode, 12),
    householdSize: str(d.householdSize, 40),
    income: str(d.income, 60),
    source: detalle ? `Web · ${detalle}` : 'Web',
    notes: extra || null,
    // Solo se registra el consentimiento si llegó explícitamente como true.
    consentAt: d.consent === true ? now : null,
  }
}

// ── Límite de peticiones ────────────────────────────────────────────────────
// En serverless cada instancia tiene su propia memoria, así que este contador
// no es exacto: una ráfaga repartida entre instancias puede colarse. Sirve para
// frenar el abuso trivial desde una sola IP, no como defensa fuerte. Si algún
// día hace falta algo serio, habría que llevarlo a la base de datos.
const golpes = new Map<string, number[]>()

export function rateLimited(
  ip: string,
  ahora: number = Date.now(),
  maximo = 10,
  ventanaMs = 60_000,
  store: Map<string, number[]> = golpes,
): boolean {
  const previos = (store.get(ip) || []).filter(t => ahora - t < ventanaMs)
  previos.push(ahora)
  store.set(ip, previos)
  if (store.size > 5000) store.clear()   // techo de memoria
  return previos.length > maximo
}
