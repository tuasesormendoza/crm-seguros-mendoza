// isAuthBroken decide si la conexión de Google se pinta como rota. Si se pasa
// de lista, un corte de red dejaría al agente reconectando sin necesidad; si se
// queda corta, la pantalla sigue diciendo "Conectado" con el permiso muerto
// —que es justo lo que pasó durante dos semanas.

import { test } from 'node:test'
import assert from 'node:assert'
import { isAuthBroken } from './googleAuthState.ts'

test('invalid_grant es conexión rota, en sus dos variantes reales', () => {
  // Las dos que devolvió Google en este proyecto.
  assert.ok(isAuthBroken(new Error('Error al refrescar el token de Google: {"error":"invalid_grant","error_description":"Bad Request"}')))
  assert.ok(isAuthBroken(new Error('{"error": "invalid_grant", "error_description": "Token has been expired or revoked."}')))
})

test('no distingue mayúsculas', () => {
  assert.ok(isAuthBroken(new Error('INVALID_GRANT')))
})

test('acepta el error como texto, no solo como Error', () => {
  assert.ok(isAuthBroken('invalid_grant'))
})

test('un fallo pasajero NO se pinta como conexión rota', () => {
  // Reconectar no arreglaría nada de esto: sería mandar al agente a un trámite
  // inútil y ocultar el problema real.
  assert.strictEqual(isAuthBroken(new Error('fetch failed')), false)
  assert.strictEqual(isAuthBroken(new Error('500 Internal Server Error')), false)
  assert.strictEqual(isAuthBroken(new Error('rateLimitExceeded')), false)
  assert.strictEqual(isAuthBroken(new Error('ETIMEDOUT')), false)
})

test('sin error no hay conexión rota', () => {
  assert.strictEqual(isAuthBroken(null), false)
  assert.strictEqual(isAuthBroken(undefined), false)
  assert.strictEqual(isAuthBroken(''), false)
})
