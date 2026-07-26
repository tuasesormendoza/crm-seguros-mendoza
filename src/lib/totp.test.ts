// Pruebas de la implementación TOTP contra los vectores OFICIALES de la RFC 6238.
// Si esto falla, los códigos del autenticador no coincidirían y nadie podría
// entrar — por eso se verifica contra el estándar, no contra nuestra propia salida.

import { test } from 'node:test'
import assert from 'node:assert'
import {
  base32Encode, base32Decode, generateTotpSecret, generateTotpCode, verifyTotp,
  otpauthUrl, generateBackupCodes, normalizeBackupCode,
} from './totp.ts'

// Secreto de la RFC: ASCII "12345678901234567890"
const RFC_SECRET = base32Encode(Buffer.from('12345678901234567890', 'ascii'))

test('base32: codificar y decodificar es reversible', () => {
  const buf = Buffer.from('12345678901234567890', 'ascii')
  assert.strictEqual(base32Decode(base32Encode(buf)).toString('ascii'), '12345678901234567890')
  assert.strictEqual(RFC_SECRET, 'GEZDGNBVGY3TQOJQGEZDGNBVGY3TQOJQ')
})

test('TOTP coincide con los vectores de prueba de la RFC 6238 (SHA1, 6 dígitos)', () => {
  // [segundos unix, código de 8 dígitos de la RFC] → usamos los últimos 6.
  const vectors: [number, string][] = [
    [59, '94287082'],
    [1111111109, '07081804'],
    [1111111111, '14050471'],
    [1234567890, '89005924'],
    [2000000000, '69279037'],
  ]
  for (const [seconds, eightDigits] of vectors) {
    const expected = eightDigits.slice(-6)
    assert.strictEqual(generateTotpCode(RFC_SECRET, seconds * 1000), expected, `t=${seconds}`)
  }
})

test('verifyTotp acepta el código correcto y rechaza el incorrecto', () => {
  const at = 1111111111 * 1000
  assert.ok(verifyTotp(RFC_SECRET, '050471', 1, at))
  assert.ok(!verifyTotp(RFC_SECRET, '000000', 1, at))
  assert.ok(!verifyTotp(RFC_SECRET, '', 1, at))
  assert.ok(!verifyTotp(RFC_SECRET, '12345', 1, at))     // muy corto
  assert.ok(!verifyTotp(RFC_SECRET, '1234567', 1, at))   // muy largo
})

test('verifyTotp tolera ±1 paso (reloj ligeramente desfasado) pero no más', () => {
  const at = 1111111111 * 1000
  const prev = generateTotpCode(RFC_SECRET, at - 30_000)
  const next = generateTotpCode(RFC_SECRET, at + 30_000)
  const far = generateTotpCode(RFC_SECRET, at + 120_000)
  assert.ok(verifyTotp(RFC_SECRET, prev, 1, at), 'código anterior debe valer')
  assert.ok(verifyTotp(RFC_SECRET, next, 1, at), 'código siguiente debe valer')
  assert.ok(!verifyTotp(RFC_SECRET, far, 1, at), 'un código lejano NO debe valer')
})

test('el código cambia con el tiempo y tiene 6 dígitos', () => {
  const secret = generateTotpSecret()
  const a = generateTotpCode(secret, 1000 * 1000)
  const b = generateTotpCode(secret, (1000 + 60) * 1000)
  assert.match(a, /^\d{6}$/)
  assert.notStrictEqual(a, b)
})

test('generateTotpSecret produce secretos distintos y válidos', () => {
  const s1 = generateTotpSecret(), s2 = generateTotpSecret()
  assert.notStrictEqual(s1, s2)
  assert.strictEqual(base32Decode(s1).length, 20) // 160 bits
  assert.match(s1, /^[A-Z2-7]+$/)
})

test('otpauthUrl arma la URL que lee el autenticador', () => {
  const url = otpauthUrl('ABC234', 'agente@correo.com', 'CRM Seguros')
  assert.ok(url.startsWith('otpauth://totp/'))
  assert.ok(url.includes('secret=ABC234'))
  assert.ok(url.includes('issuer=CRM+Seguros'))
  assert.ok(url.includes('digits=6'))
  assert.ok(url.includes('period=30'))
  assert.ok(url.includes(encodeURIComponent('agente@correo.com')))
})

test('un secreto inválido no rompe la verificación', () => {
  assert.ok(!verifyTotp('no-es-base32-!!!', '123456'))
})

test('códigos de respaldo: únicos, con formato y normalizables', () => {
  const codes = generateBackupCodes(8)
  assert.strictEqual(codes.length, 8)
  assert.strictEqual(new Set(codes).size, 8, 'no debe haber repetidos')
  for (const c of codes) assert.match(c, /^[A-Z2-7]{5}-[A-Z2-7]{5}$/)
  assert.strictEqual(normalizeBackupCode('abc23-de4f7'), 'ABC23DE4F7')
  assert.strictEqual(normalizeBackupCode(' AB C23-DE4F7 '), 'ABC23DE4F7')
})
