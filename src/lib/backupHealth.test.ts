// Estas reglas son las que avisan de que el respaldo está caído. Si fallan,
// el CRM vuelve a quedarse callado un mes, así que se prueban una por una.

import { test } from 'node:test'
import assert from 'node:assert'
import { backupHealth, shouldAutoBackup, STALE_HOURS, AUTO_AFTER_HOURS, RETRY_AFTER_MIN } from './backupHealth.ts'

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
  // Reconectar sin más solo compra otra semana: pasó el 10/07 y otra vez el
  // 13/08, con ~7 días desde cada conexión. El aviso debe mandar a revisar
  // primero si la app sigue en modo "Prueba", que es la causa de fondo.
  assert.ok(h.message.includes('En producción'), 'debe mandar a revisar el estado de publicación')
  assert.ok(h.message.includes('7 días'), 'debe explicar el patrón que delata la causa')
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

// ── Respaldo automático disparado por la propia app ─────────────────────────
// Existe porque la tarea programada de Netlify aparece activa pero no produce
// respaldos. Estas reglas son las que garantizan que igual haya copia diaria.

const minsBefore = (m: number) => new Date(NOW.getTime() - m * 60_000).toISOString()

test('si nunca se respaldó, se dispara', () => {
  assert.strictEqual(shouldAutoBackup(null, null, NOW), true)
})

test('si el último es reciente y correcto, NO se dispara', () => {
  assert.strictEqual(shouldAutoBackup({ at: hoursBefore(2), ok: true }, null, NOW), false)
})

test('pasadas las horas del umbral, se dispara', () => {
  assert.strictEqual(shouldAutoBackup({ at: hoursBefore(AUTO_AFTER_HOURS - 1), ok: true }, null, NOW), false)
  assert.strictEqual(shouldAutoBackup({ at: hoursBefore(AUTO_AFTER_HOURS + 1), ok: true }, null, NOW), true)
})

test('si el último intento FALLÓ, se reintenta sin esperar al umbral', () => {
  assert.strictEqual(shouldAutoBackup({ at: hoursBefore(1), ok: false, error: 'x' }, null, NOW), true)
})

test('el freno impide martillear a Google cuando el respaldo está fallando', () => {
  // Un intento hace 5 minutos: aunque toque, se espera.
  const fallando = { at: hoursBefore(1), ok: false, error: 'x' }
  assert.strictEqual(shouldAutoBackup(fallando, minsBefore(5), NOW), false)
  assert.strictEqual(shouldAutoBackup(fallando, minsBefore(RETRY_AFTER_MIN + 1), NOW), true)
})

test('el freno también aplica cuando simplemente toca por antigüedad', () => {
  const viejo = { at: hoursBefore(30), ok: true }
  assert.strictEqual(shouldAutoBackup(viejo, minsBefore(1), NOW), false)
  assert.strictEqual(shouldAutoBackup(viejo, minsBefore(RETRY_AFTER_MIN + 1), NOW), true)
})

test('una fecha corrupta se resuelve respaldando, no ignorando', () => {
  assert.strictEqual(shouldAutoBackup({ at: 'no es fecha', ok: true }, null, NOW), true)
})

test('un lastAttempt corrupto no bloquea el respaldo para siempre', () => {
  assert.strictEqual(shouldAutoBackup(null, 'basura', NOW), true)
})
