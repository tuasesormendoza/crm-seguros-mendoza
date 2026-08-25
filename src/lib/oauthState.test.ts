// Este state es lo único que impide que un tercero enganche su cuenta de Google
// a la sesión del agente. Si se afloja, se abre un CSRF; si se pasa de estricto,
// el agente ve "La sesión de autorización expiró" sin haber hecho nada mal.

import { test } from 'node:test'
import assert from 'node:assert'
import { createOAuthState, verifyOAuthState, STATE_TTL_MS } from './oauthState.ts'

const SECRET = 'un-secreto-de-al-menos-32-caracteres-para-pruebas'
const NOW = 1_800_000_000_000

test('un state recién creado se acepta', () => {
  assert.ok(verifyOAuthState(createOAuthState(SECRET, NOW), SECRET, NOW))
})

test('sigue valiendo mientras el agente lee la pantalla de consentimiento', () => {
  const s = createOAuthState(SECRET, NOW)
  assert.ok(verifyOAuthState(s, SECRET, NOW + 10 * 60_000), '10 minutos después debe valer')
})

test('caduca pasado el plazo', () => {
  const s = createOAuthState(SECRET, NOW)
  assert.strictEqual(verifyOAuthState(s, SECRET, NOW + STATE_TTL_MS + 1000), false)
})

test('dos conexiones seguidas NO se invalidan entre sí', () => {
  // Este era el fallo real: cada clic en "Conectar" pisaba el state anterior.
  const primera = createOAuthState(SECRET, NOW)
  const segunda = createOAuthState(SECRET, NOW + 5000)
  assert.ok(verifyOAuthState(primera, SECRET, NOW + 6000))
  assert.ok(verifyOAuthState(segunda, SECRET, NOW + 6000))
})

test('un state manipulado se rechaza', () => {
  const s = createOAuthState(SECRET, NOW)
  const [payload, firma] = s.split('.')
  assert.strictEqual(verifyOAuthState(`${payload}.${firma.slice(0, -1)}x`, SECRET, NOW), false, 'firma alterada')
  assert.strictEqual(verifyOAuthState(`${Number(payload) + 1}.${firma}`, SECRET, NOW), false, 'fecha alterada')
})

test('un state firmado con otro secreto se rechaza', () => {
  const ajeno = createOAuthState('otro-secreto-completamente-distinto-aqui', NOW)
  assert.strictEqual(verifyOAuthState(ajeno, SECRET, NOW), false)
})

test('basura y valores vacíos se rechazan sin reventar', () => {
  for (const v of [null, undefined, '', '.', 'sinpunto', 'abc.', '.abc', 'a.b.c']) {
    assert.strictEqual(verifyOAuthState(v, SECRET, NOW), false, `falló con ${JSON.stringify(v)}`)
  }
})

test('sin secreto nunca se acepta nada', () => {
  assert.strictEqual(verifyOAuthState(createOAuthState(SECRET, NOW), '', NOW), false)
})

test('tolera un desfase de reloj pequeño', () => {
  const s = createOAuthState(SECRET, NOW)
  assert.ok(verifyOAuthState(s, SECRET, NOW - 30_000), '30 s de desfase debe tolerarse')
  assert.strictEqual(verifyOAuthState(s, SECRET, NOW - 10 * 60_000), false, 'un futuro grande no')
})
