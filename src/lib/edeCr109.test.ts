// El agente le va a repetir estas cifras y fechas a sus clientes, y varias son
// operativas (si se equivoca con el umbral o con la fecha, planifica mal el
// OEP 2027). Se atan aquí para que un retoque de redacción no las tuerza.

import { test } from 'node:test'
import assert from 'node:assert'
import { EDE_CR109 } from './edeCr109.ts'

test('las fechas clave están y son las del documento de CMS', () => {
  assert.ok(EDE_CR109.includes('12 DE OCTUBRE DE 2026'), 'fecha límite de implementación')
  assert.ok(EDE_CR109.includes('03/08/2026'), 'fecha de publicación del documento')
  assert.ok(EDE_CR109.includes('27/05/2026'), 'fecha del anuncio original')
})

test('las tres condiciones de alto riesgo están completas', () => {
  assert.ok(EDE_CR109.includes('cliente NUEVO'), 'solicitud de cliente nuevo')
  assert.ok(EDE_CR109.includes('$30 AL MES O MENOS'), 'umbral de prima neta')
  assert.ok(EDE_CR109.includes('agente NUEVO o DISTINTO'), 'cambio de agente')
})

test('el umbral es la prima NETA y excluye los dentales sueltos', () => {
  // Confundir prima bruta con neta cambia por completo quién es alto riesgo.
  assert.ok(/prima NETA \(después del subsidio APTC\)/.test(EDE_CR109))
  assert.ok(EDE_CR109.includes('dentales sueltos no cuentan'))
})

test('los límites operativos del código están', () => {
  assert.ok(EDE_CR109.includes('15 MINUTOS'), 'caducidad del código/enlace')
  assert.ok(EDE_CR109.includes('UN SOLO USO'), 'el código no se reutiliza')
  assert.ok(EDE_CR109.includes('3 avisos en 24 horas'), 'tope de notificaciones')
})

test('deja claro que el consentimiento SIGUE siendo obligatorio y va primero', () => {
  // El error más caro sería que un agente crea que la autorización sustituye
  // al consentimiento: el consentimiento es una obligación del reglamento.
  assert.ok(EDE_CR109.includes('NO reemplaza el consentimiento'))
  assert.ok(EDE_CR109.includes('45 CFR 155.220(j)(2)(iii)'))
  assert.ok(EDE_CR109.includes('ANTES de acceder'), 'el orden importa')
})

test('recoge la prohibición de poner los datos del propio agente', () => {
  assert.ok(EDE_CR109.includes('PROHIBIDO'))
  assert.ok(EDE_CR109.includes('NUNCA puede poner su propio email'))
})

test('avisa de que Georgia NO está en el Mercado federal', () => {
  // Georgia es el estado principal de la agencia. Dar por hecho que le aplica
  // —o que no— sin comprobarlo es un error en los dos sentidos.
  assert.ok(EDE_CR109.includes('GEORGIA NO ESTÁ EN ESE GRUPO'))
  assert.ok(EDE_CR109.includes('Georgia Access'))
  assert.ok(EDE_CR109.includes('29 estados'))
})

test('explica la duración: identidad puede ser permanente, autorización es anual', () => {
  assert.ok(EDE_CR109.includes('CADA AÑO DE PLAN'))
  assert.ok(EDE_CR109.includes('hasta que el cliente autorice a otro agente'))
})

test('avisa de los dos cambios operativos que le cierran caminos al agente', () => {
  assert.ok(EDE_CR109.includes('InvalidAction'), 'se elimina el bloqueo y la llamada a tres')
  assert.ok(EDE_CR109.includes('YA NO va a aceptar'), 'el Call Center deja de hacerlo')
})

test('trae el correo para reportar actividad no autorizada', () => {
  assert.ok(EDE_CR109.includes('FFMProducerAssisterHelpDesk@cms.hhs.gov'))
})
