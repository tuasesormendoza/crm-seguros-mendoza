// ─────────────────────────────────────────────────────────────────────────────
// TOTP (RFC 6238) — códigos de 6 dígitos que cambian cada 30 segundos.
// Compatible con Google Authenticator, Microsoft Authenticator, Authy, 1Password…
//
// Implementado con `crypto` de Node (HMAC-SHA1), sin dependencias externas.
// El secreto se genera aquí y se guarda CIFRADO en la base de datos.
// ─────────────────────────────────────────────────────────────────────────────

import { createHmac, randomBytes, timingSafeEqual } from 'crypto'

const B32_ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567' // RFC 4648
const STEP_SECONDS = 30
const DIGITS = 6

// ── Base32 ───────────────────────────────────────────────────────────────────

export function base32Encode(buf: Buffer): string {
  let bits = 0, value = 0, out = ''
  for (const byte of buf) {
    value = (value << 8) | byte
    bits += 8
    while (bits >= 5) {
      out += B32_ALPHABET[(value >>> (bits - 5)) & 31]
      bits -= 5
    }
  }
  if (bits > 0) out += B32_ALPHABET[(value << (5 - bits)) & 31]
  return out
}

export function base32Decode(s: string): Buffer {
  const clean = s.toUpperCase().replace(/=+$/, '').replace(/\s/g, '')
  let bits = 0, value = 0
  const out: number[] = []
  for (const ch of clean) {
    const idx = B32_ALPHABET.indexOf(ch)
    if (idx === -1) throw new Error('Secreto TOTP inválido')
    value = (value << 5) | idx
    bits += 5
    if (bits >= 8) {
      out.push((value >>> (bits - 8)) & 0xff)
      bits -= 8
    }
  }
  return Buffer.from(out)
}

// ── Generación y verificación ────────────────────────────────────────────────

// Secreto nuevo (20 bytes = 160 bits, lo recomendado por la RFC).
export function generateTotpSecret(): string {
  return base32Encode(randomBytes(20))
}

// Código de 6 dígitos para un contador dado (paso de 30s).
function codeForCounter(secret: string, counter: number): string {
  const key = base32Decode(secret)
  const buf = Buffer.alloc(8)
  // Contador de 64 bits big-endian (los 32 altos son 0 hasta el año 2106).
  buf.writeUInt32BE(Math.floor(counter / 0x100000000), 0)
  buf.writeUInt32BE(counter >>> 0, 4)

  const hmac = createHmac('sha1', key).update(buf).digest()
  const offset = hmac[hmac.length - 1] & 0x0f
  const binary = ((hmac[offset] & 0x7f) << 24) | (hmac[offset + 1] << 16) | (hmac[offset + 2] << 8) | hmac[offset + 3]
  return String(binary % 10 ** DIGITS).padStart(DIGITS, '0')
}

// Código actual (útil para pruebas).
export function generateTotpCode(secret: string, at: number = Date.now()): string {
  return codeForCounter(secret, Math.floor(at / 1000 / STEP_SECONDS))
}

// Verifica un código permitiendo ±`window` pasos (tolerancia al reloj desfasado).
// La comparación es en tiempo constante.
export function verifyTotp(secret: string, token: string, window = 1, at: number = Date.now()): boolean {
  const clean = (token || '').replace(/\D/g, '')
  if (clean.length !== DIGITS) return false
  const counter = Math.floor(at / 1000 / STEP_SECONDS)
  for (let i = -window; i <= window; i++) {
    let expected: string
    try { expected = codeForCounter(secret, counter + i) } catch { return false }
    const a = Buffer.from(expected), b = Buffer.from(clean)
    if (a.length === b.length && timingSafeEqual(a, b)) return true
  }
  return false
}

// URL `otpauth://` que se convierte en el código QR que escanea la app.
export function otpauthUrl(secret: string, accountEmail: string, issuer = 'CRM Seguros'): string {
  const label = encodeURIComponent(`${issuer}:${accountEmail}`)
  const params = new URLSearchParams({
    secret, issuer, algorithm: 'SHA1', digits: String(DIGITS), period: String(STEP_SECONDS),
  })
  return `otpauth://totp/${label}?${params.toString()}`
}

// ── Códigos de respaldo ──────────────────────────────────────────────────────
// 8 códigos de un solo uso por si el usuario pierde el teléfono. Se muestran
// UNA vez y se guardan hasheados (nunca en claro).

export function generateBackupCodes(count = 8): string[] {
  const codes: string[] = []
  for (let i = 0; i < count; i++) {
    // 10 caracteres en base32 (sin ambigüedad), con guion para leerlos mejor.
    const raw = base32Encode(randomBytes(7)).slice(0, 10)
    codes.push(`${raw.slice(0, 5)}-${raw.slice(5)}`)
  }
  return codes
}

// Normaliza un código de respaldo para comparar (sin guiones ni espacios).
export function normalizeBackupCode(code: string): string {
  return (code || '').toUpperCase().replace(/[^A-Z0-9]/g, '')
}
