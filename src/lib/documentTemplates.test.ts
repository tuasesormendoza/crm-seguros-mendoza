// Las cartas y correos que salen de aquí llevan la marca de la agencia. El CRM
// se vende a otros agentes, así que lo que se prueba es que una agencia SIN
// perfil configurado no envíe nada con los datos de otra: ni web, ni nombre,
// ni teléfono heredados. Antes venían escritos en el código y todos los
// clientes de todas las agencias recibían la misma página web.

import { test } from 'node:test'
import assert from 'node:assert'
import { TEMPLATES, generateDoc, type Client } from './documentTemplates.ts'

const CLIENT: Client = {
  id: 'c1', fullName: 'Luis Pérez', insurer: 'Ambetter', planName: 'Silver 5', planCategory: 'Silver',
  totalMonthly: 120, contractDate: '2026-04-15', activationDate: null, renewalDate: null,
  policyExpirationDate: null, phone: '3055550100', email: 'luis@example.com',
  wnPolicies: null, acaPrice: 120, coverageType: 'Individual',
}

/** Agencia recién instalada: no ha rellenado nada de su perfil. */
const AGENCIA_VACIA: Record<string, string> = {}

/** Agencia con su perfil ya configurado. */
const AGENCIA_LLENA: Record<string, string> = {
  agentName: 'Ana Ruiz',
  agentPhone: '(305) 555-0100',
  agentEmail: 'ana@miagencia.com',
  agentWhatsApp: '13055550100',
  cardWebsite: 'www.miagencia.com',
}

const ids = TEMPLATES.map(t => t.id)

test('el catálogo de plantillas no está vacío (si no, las demás pruebas no probarían nada)', () => {
  assert.ok(ids.length >= 7)
})

for (const id of ids) {
  test(`"${id}": sin perfil configurado no se cuela ningún dato de otra agencia`, () => {
    const doc = generateDoc(id, CLIENT, AGENCIA_VACIA)
    const todo = `${doc.html}\n${doc.text}\n${doc.whatsapp}`
    // Ni la web ni el nombre de nadie: antes iban escritos en el código.
    assert.ok(!/tuasesormendoza/i.test(todo), 'se coló una página web ajena')
    assert.ok(!/mendoza/i.test(todo), 'se coló el nombre de otro agente')
    assert.ok(!/436-?4366/.test(todo), 'se coló un teléfono ajeno')
    // Y tampoco un hueco a medias del tipo "🌐 " o un enlace vacío.
    assert.ok(!/🌐\s*($|\n|<)/.test(todo), 'quedó una línea de web vacía')
    assert.ok(!/href="https:\/\/"/.test(doc.html), 'quedó un enlace de web vacío')
  })

  test(`"${id}": con perfil configurado sale la web y el nombre de ESA agencia`, () => {
    const doc = generateDoc(id, CLIENT, AGENCIA_LLENA)
    const todo = `${doc.html}\n${doc.text}\n${doc.whatsapp}`
    assert.ok(todo.includes('www.miagencia.com'), 'no aparece la web configurada')
    assert.ok(todo.includes('Ana Ruiz'), 'no aparece el nombre configurado')
  })
}

test('la web se normaliza: da igual que la escriban con https:// o con barra final', () => {
  const doc = generateDoc('welcome', CLIENT, { ...AGENCIA_LLENA, cardWebsite: 'https://www.miagencia.com/' })
  assert.ok(doc.html.includes('href="https://www.miagencia.com"'), 'el enlace quedó mal formado')
  assert.ok(!doc.html.includes('https://https://'), 'se duplicó el esquema')
})

test('sin nombre configurado se firma con un rótulo neutro, no en blanco', () => {
  const doc = generateDoc('welcome', CLIENT, AGENCIA_VACIA)
  assert.ok(doc.html.includes('Agente'), 'la carta quedó sin firma alguna')
})
