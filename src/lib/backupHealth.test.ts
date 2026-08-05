// Estas reglas son las que avisan de que el respaldo está caído. Si fallan,
// el CRM vuelve a quedarse callado un mes, así que se prueban una por una.

import { test } from 'node:test'
import assert from 'node:assert'
import { backupHealth, STALE_HOURS } from './backupHealth.ts'

const NOW = new Date('2026-08-05T20:00:00Z')
const hoursBefore = (h: number) => new Date(NOW.getTime() - h * 36e5).toISOString()

test('respaldo reciente y correcto: sin alarma', () => {
  const h = backupHealth({ at: hoursBefore(6), ok: true }, NOW)
  assert.strictEqual(h.state, 'ok')
  assert.strictEqual(h.alarm, false)
})

test('nunca se respaldó: alarma', () => {
  const h = backupHealth(null, NOW)
  assert.strictEqual(h.state, 'never')
  assert.strictEqual(h.alarm, true)
})

test('el último intento falló: alarma inmediata, sin esperar', () => {
  const h = backupHealth({ at: hoursBefore(1), ok: false, error: 'algo se rompió' }, NOW)
  assert.strictEqual(h.state, 'failed')
  assert.strictEqual(h.alarm, true)
  assert.ok(h.message.includes('algo se rompió'))
})

test('con invalid_grant se explica QUÉ hacer, no solo el error crudo', () => {
  // Este es el caso real: el permiso de Google caducó el 10/07/2026.
  const h = backupHealth({
    at: hoursBefore(2), ok: false,
    error: 'Error al refrescar el token de Google: {"error":"invalid_grant"}',
  }, NOW)
  assert.strictEqual(h.state, 'failed')
  assert.ok(h.message.includes('Desconectar'), 'debe decirle al agente que reconecte Google')
})

test('un respaldo bueno pero viejo también es alarma', () => {
  // El fallo que costó 30 días: el último era CORRECTO, así que la pantalla
  // decía "Último respaldo: 06 jul" y parecía que todo iba bien.
  const h = backupHealth({ at: hoursBefore(30 * 24), ok: true }, NOW)
  assert.strictEqual(h.state, 'stale')
  assert.strictEqual(h.alarm, true)
  assert.ok(h.message.includes('30 días'))
})

test('el límite de antigüedad se respeta en ambos lados', () => {
  assert.strictEqual(backupHealth({ at: hoursBefore(STALE_HOURS - 1), ok: true }, NOW).state, 'ok')
  assert.strictEqual(backupHealth({ at: hoursBefore(STALE_HOURS + 1), ok: true }, NOW).state, 'stale')
})

test('una fecha corrupta no se toma por buena', () => {
  const h = backupHealth({ at: 'no es una fecha', ok: true }, NOW)
  assert.strictEqual(h.alarm, true)
})
