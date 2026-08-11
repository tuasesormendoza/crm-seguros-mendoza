import { test } from 'node:test'
import assert from 'node:assert'
import {
  stageOf, stageMeta, completionPct, countByStage, messageFor, whatsappLink,
  REVIEW_STAGES, DEFAULT_STAGE, DONE_STAGE,
} from './googleReview.ts'

const TPL = {
  first: 'Hola {nombre}, déjanos tu reseña 🙏: {link} — {agente}',
  reminder: 'Hola {nombre}, te recuerdo la reseña: {link}',
}
const VARS = { nombre: 'Ana', link: 'https://g.page/x', agente: 'Omar' }

test('un cliente sin dato cuenta como pendiente, no como etapa vacía', () => {
  assert.strictEqual(stageOf(null), DEFAULT_STAGE)
  assert.strictEqual(stageOf(undefined), DEFAULT_STAGE)
  assert.strictEqual(stageOf(''), DEFAULT_STAGE)
  assert.strictEqual(stageOf('   '), DEFAULT_STAGE)
})

test('una etapa inventada no rompe la pantalla: cae en pendiente', () => {
  assert.strictEqual(stageOf('Etapa que ya no existe'), DEFAULT_STAGE)
  assert.strictEqual(stageMeta('cualquier cosa').key, DEFAULT_STAGE)
})

test('las etapas válidas se respetan', () => {
  for (const s of REVIEW_STAGES) assert.strictEqual(stageOf(s.key), s.key)
})

test('el conteo por etapa suma exactamente el total de clientes', () => {
  const clientes = [
    { googleReview: 'Realizada' }, { googleReview: 'Realizada' },
    { googleReview: 'Enviada' }, { googleReview: null }, { googleReview: 'basura' },
  ]
  const c = countByStage(clientes)
  assert.strictEqual(c['Realizada'], 2)
  assert.strictEqual(c['Enviada'], 1)
  assert.strictEqual(c[DEFAULT_STAGE], 2)   // el null y la basura
  assert.strictEqual(Object.values(c).reduce((a, b) => a + b, 0), clientes.length)
})

test('el porcentaje sale bien y con cero clientes no da NaN', () => {
  assert.strictEqual(completionPct([]), 0)
  assert.strictEqual(completionPct([{ googleReview: 'Realizada' }]), 100)
  assert.strictEqual(completionPct([{ googleReview: 'Realizada' }, { googleReview: null }]), 50)
  assert.strictEqual(completionPct([{ googleReview: null }, { googleReview: null }]), 0)
})

test('la primera vez se PIDE la reseña; después se RECUERDA', () => {
  assert.ok(messageFor(DEFAULT_STAGE, TPL, VARS)!.includes('déjanos tu reseña'))
  assert.ok(messageFor('Enviada', TPL, VARS)!.includes('te recuerdo'))
  assert.ok(messageFor('Esperando por el cliente', TPL, VARS)!.includes('te recuerdo'))
})

test('a quien ya dejó la reseña NO se le vuelve a insistir', () => {
  assert.strictEqual(messageFor(DONE_STAGE, TPL, VARS), null)
  assert.strictEqual(whatsappLink('4075551234', messageFor(DONE_STAGE, TPL, VARS)), '')
})

test('las variables del mensaje se sustituyen todas', () => {
  const m = messageFor(DEFAULT_STAGE, TPL, VARS)!
  assert.ok(m.includes('Ana') && m.includes('https://g.page/x') && m.includes('Omar'))
  assert.ok(!m.includes('{'), 'no debe quedar ningún {marcador} sin sustituir')
})

test('el teléfono de 10 dígitos se manda con el 1 de EE.UU. delante', () => {
  const link = whatsappLink('(407) 555-1234', 'hola')
  assert.ok(link.startsWith('https://wa.me/14075551234?text='))
})

test('un teléfono ya internacional no se le añade otro 1', () => {
  assert.ok(whatsappLink('+52 55 1234 5678', 'hola').startsWith('https://wa.me/525512345678'))
})

test('sin teléfono, o con uno incompleto, no se genera enlace roto', () => {
  assert.strictEqual(whatsappLink(null, 'hola'), '')
  assert.strictEqual(whatsappLink('', 'hola'), '')
  assert.strictEqual(whatsappLink('555-12', 'hola'), '')
})
