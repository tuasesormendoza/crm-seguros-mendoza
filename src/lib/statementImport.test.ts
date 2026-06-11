import { test, describe } from 'node:test'
import assert from 'node:assert/strict'
import {
  parseAmount,
  parseStatement,
  normalizeName,
  nameSimilarity,
  matchRows,
} from './statementImport.ts'

describe('parseAmount', () => {
  test('quita símbolos y comas', () => {
    assert.equal(parseAmount('$1,234.50'), 1234.5)
    assert.equal(parseAmount('18.00'), 18)
    assert.equal(parseAmount(' 54 '), 54)
  })
  test('texto no numérico → null', () => {
    assert.equal(parseAmount('abc'), null)
    assert.equal(parseAmount(''), null)
  })
})

describe('parseStatement', () => {
  test('parsea líneas separadas por espacios y por tabulador', () => {
    const text = `MARY VIVAS    $18.00
OSCAR HERNANDEZ\t54.00`
    const rows = parseStatement(text)
    assert.equal(rows.length, 2)
    assert.deepEqual({ name: rows[0].name, amount: rows[0].amount }, { name: 'MARY VIVAS', amount: 18 })
    assert.deepEqual({ name: rows[1].name, amount: rows[1].amount }, { name: 'OSCAR HERNANDEZ', amount: 54 })
  })
  test('parsea CSV con coma', () => {
    const rows = parseStatement('John Smith,36.00')
    assert.equal(rows.length, 1)
    assert.equal(rows[0].name, 'John Smith')
    assert.equal(rows[0].amount, 36)
  })
  test('ignora encabezados y líneas sin monto final', () => {
    const text = `Cliente   Monto
MARY VIVAS   18.00
Total de la página`
    const rows = parseStatement(text)
    assert.equal(rows.length, 1)
    assert.equal(rows[0].name, 'MARY VIVAS')
  })
  test('ignora una línea que es solo un número', () => {
    assert.equal(parseStatement('123 456').length, 0)
  })
})

describe('normalizeName + nameSimilarity', () => {
  test('ignora mayúsculas, acentos y orden de palabras', () => {
    assert.equal(normalizeName('Óscar  HÉRNANDEZ'), 'oscar hernandez')
    assert.equal(nameSimilarity('VIVAS MARY', 'Mary Vivas'), 1)
    assert.equal(nameSimilarity('Óscar Hernández', 'oscar hernandez'), 1)
  })
  test('coincidencia parcial da puntaje intermedio', () => {
    // 2 de 3 palabras coinciden → 2/3 ≈ 0.667
    const score = nameSimilarity('Oscar Hernandez', 'Oscar Hernandez Gomez')
    assert.ok(score > 0.6 && score < 0.7)
  })
  test('nombres distintos → bajo', () => {
    assert.ok(nameSimilarity('Mary Vivas', 'Pedro Gomez') < 0.5)
  })
})

describe('matchRows — conciliación automática', () => {
  const candidates = [
    { id: 'c1', fullName: 'Mary Vivas', expected: 18 },
    { id: 'c2', fullName: 'Oscar Hernandez', expected: 54 },
    { id: 'c3', fullName: 'Pedro Gomez', expected: 36 },
  ]

  test('empareja nombres en otro orden/mayúsculas (estado de cuenta real)', () => {
    const parsed = parseStatement(`VIVAS MARY   18.00
HERNANDEZ OSCAR   54.00`)
    const results = matchRows(parsed, candidates)
    assert.equal(results[0].matchedClientId, 'c1')
    assert.equal(results[0].status, 'matched')
    assert.equal(results[1].matchedClientId, 'c2')
    assert.equal(results[1].status, 'matched')
  })

  test('nombre desconocido queda sin emparejar', () => {
    const results = matchRows(parseStatement('Cliente Inexistente   99.00'), candidates)
    assert.equal(results[0].matchedClientId, null)
    assert.equal(results[0].status, 'unmatched')
  })

  test('lleva el monto y el esperado del candidato', () => {
    const results = matchRows(parseStatement('Mary Vivas   20.00'), candidates)
    assert.equal(results[0].amount, 20)
    assert.equal(results[0].expected, 18) // diferencia visible: pagó 20, se esperaba 18
  })
})
