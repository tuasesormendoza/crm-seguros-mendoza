import { createHash } from 'crypto'

// Clave compartida entre la función programada de Netlify y el endpoint de
// sincronización, derivada del SESSION_SECRET (ya existente) para no requerir
// una variable de entorno nueva. Nunca expone el secreto en crudo.
export function cronKey(): string {
  const secret = process.env.SESSION_SECRET || ''
  return createHash('sha256').update(`${secret}:google-sync`).digest('hex')
}
