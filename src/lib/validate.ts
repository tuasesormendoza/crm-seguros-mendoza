// Server-side input validation helpers.
// Return an errors object (field → message). Empty object = valid.

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
const SSN_RE   = /^\d{3}-\d{2}-\d{4}$/
const PHONE_RE = /^[\d\s()\-+.]{7,20}$/

type Errors = Record<string, string>

export function validateClient(d: Record<string, unknown>): Errors {
  const errors: Errors = {}

  // Required
  if (!d.fullName || typeof d.fullName !== 'string' || !d.fullName.trim()) {
    errors.fullName = 'El nombre completo es requerido'
  } else if (d.fullName.trim().length > 200) {
    errors.fullName = 'El nombre no puede superar 200 caracteres'
  }

  // Email
  if (d.email && typeof d.email === 'string' && d.email.trim()) {
    if (!EMAIL_RE.test(d.email.trim())) errors.email = 'Formato de email inválido'
    else if (d.email.trim().length > 200) errors.email = 'Email demasiado largo'
  }

  // Phone
  if (d.phone && typeof d.phone === 'string' && d.phone.trim()) {
    if (!PHONE_RE.test(d.phone.trim())) errors.phone = 'Formato de teléfono inválido'
  }

  // SSN
  if (d.ssn && typeof d.ssn === 'string' && d.ssn.trim()) {
    if (!SSN_RE.test(d.ssn.trim())) errors.ssn = 'SSN debe tener el formato XXX-XX-XXXX'
  }

  // Numeric fields
  if (d.acaPrice !== undefined && d.acaPrice !== null && d.acaPrice !== '') {
    const v = parseFloat(d.acaPrice as string)
    if (isNaN(v) || v < 0) errors.acaPrice = 'Precio ACA debe ser un número positivo'
  }
  if (d.totalMonthly !== undefined && d.totalMonthly !== null && d.totalMonthly !== '') {
    const v = parseFloat(d.totalMonthly as string)
    if (isNaN(v) || v < 0) errors.totalMonthly = 'Total mensual debe ser un número positivo'
  }
  if (d.annualIncome !== undefined && d.annualIncome !== null && d.annualIncome !== '') {
    const v = parseFloat(d.annualIncome as string)
    if (isNaN(v) || v < 0) errors.annualIncome = 'Ingreso anual debe ser un número positivo'
  }

  // Date fields
  for (const field of ['birthDate', 'contractDate', 'renewalDate', 'activationDate', 'policyExpirationDate']) {
    const val = d[field]
    if (val && typeof val === 'string' && val.trim()) {
      const dt = new Date(val)
      if (isNaN(dt.getTime())) errors[field] = 'Fecha inválida'
    }
  }

  return errors
}

export function validateProspect(d: Record<string, unknown>): Errors {
  const errors: Errors = {}

  if (!d.fullName || typeof d.fullName !== 'string' || !d.fullName.trim()) {
    errors.fullName = 'El nombre completo es requerido'
  } else if (d.fullName.trim().length > 200) {
    errors.fullName = 'El nombre no puede superar 200 caracteres'
  }

  if (d.email && typeof d.email === 'string' && d.email.trim()) {
    if (!EMAIL_RE.test(d.email.trim())) errors.email = 'Formato de email inválido'
  }

  if (d.phone && typeof d.phone === 'string' && d.phone.trim()) {
    if (!PHONE_RE.test(d.phone.trim())) errors.phone = 'Formato de teléfono inválido'
  }

  return errors
}

// Contraseñas: mínimo 8 caracteres con al menos una letra y un número.
// Devuelve el mensaje de error, o null si la contraseña es válida.
export function validatePassword(pw: unknown): string | null {
  if (typeof pw !== 'string' || pw.length < 8) return 'La contraseña debe tener al menos 8 caracteres'
  if (!/[a-zA-Z]/.test(pw)) return 'La contraseña debe incluir al menos una letra'
  if (!/\d/.test(pw)) return 'La contraseña debe incluir al menos un número'
  return null
}

// Utility: return a 400 JSON response with field errors
export function validationError(errors: Errors) {
  const message = Object.values(errors)[0] ?? 'Datos inválidos'
  return Response.json({ error: message, errors }, { status: 400 })
}
