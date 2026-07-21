import { createHash, timingSafeEqual } from 'crypto'

// Clave compartida entre la función programada de Netlify y el endpoint de
// sincronización, derivada del SESSION_SECRET (ya existente) para no requerir
// una variable de entorno nueva. Nunca expone el secreto en crudo.
export function cronKey(): string {
  const secret = process.env.SESSION_SECRET || ''
  return createHash('sha256').update(`${secret}:google-sync`).digest('hex')
}

// Verifica la clave recibida contra la esperada en TIEMPO CONSTANTE (evita
// fugas por temporización al comparar cadenas). Devuelve false si no coincide
// o si falta.
export function verifyCronKey(provided: string | null | undefined): boolean {
  if (!provided) return false
  const expected = Buffer.from(cronKey(), 'utf8')
  const got = Buffer.from(provided, 'utf8')
  if (got.length !== expected.length) return false
  return timingSafeEqual(got, expected)
}
