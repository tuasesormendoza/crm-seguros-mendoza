// Pruebas del cálculo del mercado de Georgia. Aquí sale el precio que se le
// cotiza al cliente, así que se verifican las reglas una por una.

import { test } from 'node:test'
import assert from 'node:assert'
import { ratingAreaForCounty, ageKey, householdPremium, quoteGeorgia, parsePayload, type GaPayload } from './georgiaMarket.ts'

const payload: GaPayload = {
  plans: [
    { id: 'P_SILVER_A', name: 'Silver A', issuer: 'Aseguradora A', metalLevel: 'Silver', type: 'HMO', deductible: 3700, moop: 10125 },
    { id: 'P_SILVER_B', name: 'Silver B', issuer: 'Aseguradora B', metalLevel: 'Silver', type: 'PPO', deductible: 5000, moop: 9200 },
    { id: 'P_SILVER_C', name: 'Silver C', issuer: 'Aseguradora C', metalLevel: 'Silver', type: 'HMO', deductible: 2500, moop: 8700 },
    { id: 'P_GOLD',     name: 'Gold X',   issuer: 'Aseguradora A', metalLevel: 'Gold',   type: 'HMO', deductible: 1500, moop: 7000 },
  ],
  rates: {
    '0-14': { P_SILVER_A: 100, P_SILVER_B: 110, P_SILVER_C: 120, P_GOLD: 150 },
    '30':   { P_SILVER_A: 300, P_SILVER_B: 330, P_SILVER_C: 360, P_GOLD: 450 },
    '40':   { P_SILVER_A: 400, P_SILVER_B: 440, P_SILVER_C: 480, P_GOLD: 600 },
    '64':   { P_SILVER_A: 900, P_SILVER_B: 990, P_SILVER_C: 1080, P_GOLD: 1350 },
    '65 and over': { P_SILVER_A: 950, P_SILVER_B: 1045, P_SILVER_C: 1140, P_GOLD: 1425 },
  },
}

test('condado → área de tarifa (con y sin la palabra "County")', () => {
  assert.strictEqual(ratingAreaForCounty('Fulton County'), 3)
  assert.strictEqual(ratingAreaForCounty('fulton'), 3)
  assert.strictEqual(ratingAreaForCounty('FULTON COUNTY'), 3)
  assert.strictEqual(ratingAreaForCounty('Chatham County'), 14)
  assert.strictEqual(ratingAreaForCounty('Dougherty'), 1)
  assert.strictEqual(ratingAreaForCounty('Condado Inventado'), null)
  assert.strictEqual(ratingAreaForCounty(''), null)
  assert.strictEqual(ratingAreaForCounty(null), null)
})

test('la edad se agrupa como en los archivos oficiales', () => {
  const keys = Object.keys(payload.rates)
  assert.strictEqual(ageKey(5, keys), '0-14')
  assert.strictEqual(ageKey(14, keys), '0-14')
  assert.strictEqual(ageKey(40, keys), '40')
  assert.strictEqual(ageKey(70, keys), '65 and over')
  // Una edad sin fila exacta cae en la más cercana en vez de romper la cotización.
  assert.strictEqual(ageKey(41, keys), '40')
})

test('precio del hogar: suma las tarifas de cada persona', () => {
  assert.strictEqual(householdPremium(payload, 'P_SILVER_A', [40]), 400)
  assert.strictEqual(householdPremium(payload, 'P_SILVER_A', [40, 30]), 700)
  // Pareja + 1 niño = 400 + 300 + 100
  assert.strictEqual(householdPremium(payload, 'P_SILVER_A', [40, 30, 8]), 800)
})

test('de los menores de 21 solo se cobran los 3 mayores', () => {
  // 2 adultos + 5 niños → solo 3 niños cuentan: 400 + 300 + (100 × 3)
  assert.strictEqual(householdPremium(payload, 'P_SILVER_A', [40, 30, 10, 8, 6, 4, 2]), 1000)
})

test('si un plan no tiene tarifa para una edad, no se cotiza', () => {
  const parcial: GaPayload = { plans: payload.plans, rates: { '40': { P_SILVER_A: 400 } } }
  assert.strictEqual(householdPremium(parcial, 'P_SILVER_B', [40]), null)
})

test('SLCSP = el SEGUNDO plan Silver más barato del hogar', () => {
  const q = quoteGeorgia(payload, [40])
  assert.strictEqual(q.silverCount, 3)
  assert.strictEqual(q.slcspMonthly, 440)      // 400 < 440 < 480 → el segundo
  assert.strictEqual(q.slcspPlanName, 'Silver B')
  // El Gold entra en el listado de planes, pero no cuenta para el SLCSP.
  assert.strictEqual(q.plans.length, 4)
  assert.ok(q.plans.some(p => p.metalLevel === 'Gold'))
})

test('el SLCSP se calcula sobre el precio del HOGAR, no de una persona', () => {
  const q = quoteGeorgia(payload, [40, 30])   // Silver B = 440 + 330 = 770
  assert.strictEqual(q.slcspMonthly, 770)
})

test('con un solo plan Silver, ese es la referencia', () => {
  const uno: GaPayload = {
    plans: [payload.plans[0], payload.plans[3]],
    rates: { '40': { P_SILVER_A: 400, P_GOLD: 600 } },
  }
  const q = quoteGeorgia(uno, [40])
  assert.strictEqual(q.slcspMonthly, 400)
  assert.strictEqual(q.silverCount, 1)
})

test('sin planes Silver no hay SLCSP (pero no revienta)', () => {
  const sinSilver: GaPayload = { plans: [payload.plans[3]], rates: { '40': { P_GOLD: 600 } } }
  const q = quoteGeorgia(sinSilver, [40])
  assert.strictEqual(q.slcspMonthly, null)
  assert.strictEqual(q.silverCount, 0)
})

test('los planes DENTALES quedan fuera de la cotización médica', () => {
  // Los planes dentales usan niveles "High"/"Low" y son muy baratos: si se
  // colaran, aparecerían de primeros como si fueran seguro de salud.
  const conDental: GaPayload = {
    plans: [
      ...payload.plans,
      { id: 'P_DENTAL', name: 'Dental sin espera PPO', issuer: 'Dental Co', metalLevel: 'High', type: 'PPO', deductible: null, moop: null },
    ],
    rates: { '40': { P_SILVER_A: 400, P_SILVER_B: 440, P_SILVER_C: 480, P_GOLD: 600, P_DENTAL: 27.62 } },
  }
  const q = quoteGeorgia(conDental, [40])
  assert.ok(!q.plans.some(p => p.id === 'P_DENTAL'), 'el plan dental NO debe cotizarse como salud')
  assert.strictEqual(q.plans.length, 4)
  assert.strictEqual(q.slcspMonthly, 440)  // el dental tampoco altera el SLCSP
})

test('parsePayload acepta datos válidos y rechaza basura', () => {
  assert.ok(parsePayload(JSON.stringify(payload)))
  assert.strictEqual(parsePayload('no es json'), null)
  assert.strictEqual(parsePayload('{"plans":"mal"}'), null)
})
