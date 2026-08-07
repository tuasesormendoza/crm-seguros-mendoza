// El CRM se vende a otras agencias. Estas reglas son las que impiden que un
// agente recién llegado mande mensajes firmados por otro o pida reseñas para
// el negocio de otro, así que se prueban una por una.

import { test } from 'node:test'
import assert from 'node:assert'
import {
  AGENT_FALLBACK,
  REQUIRED_PROFILE_FIELDS,
  agentDisplayName,
  agentInitials,
  agentSignature,
  fillTemplate,
  isProfileIncomplete,
  missingProfileFields,
  reviewMessage,
} from './agentProfile.ts'

test('perfil recién instalado: faltan los campos obligatorios', () => {
  assert.strictEqual(isProfileIncomplete({}), true)
  const faltan = missingProfileFields({}, REQUIRED_PROFILE_FIELDS).map(f => f.key)
  assert.deepStrictEqual(faltan, ['agentName', 'agentPhone'])
})

test('perfil completo: no se avisa de nada', () => {
  assert.strictEqual(isProfileIncomplete({ agentName: 'Ana Ruiz', agentPhone: '(305) 555-0100' }), false)
})

test('un campo con solo espacios cuenta como vacío', () => {
  assert.strictEqual(isProfileIncomplete({ agentName: '   ', agentPhone: '(305) 555-0100' }), true)
})

test('los campos opcionales se listan pero no bloquean', () => {
  const s = { agentName: 'Ana Ruiz', agentPhone: '(305) 555-0100' }
  assert.strictEqual(isProfileIncomplete(s), false)
  const faltan = missingProfileFields(s).map(f => f.key)
  assert.ok(faltan.includes('googleReviewLink'))
  assert.ok(faltan.includes('cardWebsite'))
})

test('sin nombre configurado se usa un rótulo neutro, nunca el de otro', () => {
  assert.strictEqual(agentDisplayName(''), AGENT_FALLBACK)
  assert.strictEqual(agentDisplayName(null), AGENT_FALLBACK)
  assert.strictEqual(agentDisplayName('Ana Ruiz'), 'Ana Ruiz')
})

test('la firma no deja una coma suelta cuando no hay nombre', () => {
  assert.strictEqual(agentSignature('Ana Ruiz'), 'Ana Ruiz, Tu Asesor de Seguros')
  assert.strictEqual(agentSignature(''), 'Tu Asesor de Seguros')
})

test('sin nombre no se inventan iniciales', () => {
  assert.strictEqual(agentInitials(''), '—')
  assert.strictEqual(agentInitials('Ana Ruiz'), 'AR')
  assert.strictEqual(agentInitials('Ana Sofía Ruiz Pérez'), 'AS')
})

test('fillTemplate sustituye lo que hay y vacía lo que no', () => {
  assert.strictEqual(fillTemplate('Hola {nombre}, firma {agente}', { nombre: 'Luis', agente: 'Ana' }), 'Hola Luis, firma Ana')
  assert.strictEqual(fillTemplate('Hola {nombre}{falta}', { nombre: 'Luis' }), 'Hola Luis')
})

test('sin link de reseñas no se genera mensaje (no hay botón que ofrecer)', () => {
  assert.strictEqual(reviewMessage('Déjanos tu reseña: {link}', 'Luis Pérez', ''), null)
  assert.strictEqual(reviewMessage('Déjanos tu reseña: {link}', 'Luis Pérez', '  '), null)
  assert.strictEqual(reviewMessage('Déjanos tu reseña: {link}', 'Luis Pérez', null), null)
})

test('con link configurado el mensaje usa el nombre de pila y ese link', () => {
  const msg = reviewMessage('Hola {nombre}, reséñanos: {link}', 'Luis Pérez Gómez', 'https://g.page/r/AGENCIA/review')
  assert.strictEqual(msg, 'Hola Luis, reséñanos: https://g.page/r/AGENCIA/review')
})
