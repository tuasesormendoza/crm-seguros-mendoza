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
  test('nombre del estado de cuenta con palabras extra/cortado empareja fuerte', () => {
    // "MARY VIVAS PAR" contiene a "Mary Vivas" → misma persona (≥0.9)
    assert.ok(nameSimilarity('MARY VIVAS PAR', 'Mary Vivas') >= 0.9)
    assert.ok(nameSimilarity('Oscar Hernandez Gomez', 'Oscar Hernandez') >= 0.9)
  })
  test('coincidencia parcial real (no contenida) da puntaje intermedio', () => {
    // comparten solo 1 de 2 palabras, no hay contención → 0.5
    assert.equal(nameSimilarity('Oscar Hernandez', 'Oscar Gomez'), 0.5)
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

  test('empareja una línea de dependiente con el cliente titular (alias)', () => {
    // Fabián tiene un dependiente "Luis Mendoza" que el mercado puso en línea aparte.
    const withDeps = [
      { id: 'f1', fullName: 'Fabian Mendoza', expected: 100, aliases: ['Luis Mendoza'] },
      { id: 'c1', fullName: 'Mary Vivas', expected: 18 },
    ]
    const results = matchRows(parseStatement(`FABIAN MENDOZA   75.00
LUIS MENDOZA J   25.00`), withDeps)
    assert.equal(results[0].matchedClientId, 'f1') // titular por su propio nombre
    assert.equal(results[1].matchedClientId, 'f1') // dependiente → mismo titular
    assert.equal(results[1].status, 'matched')
  })

  test('caso real: "LUIS MENDOZA J" empareja al dependiente "Luis F. Mendoza Jimenez"', () => {
    const withDeps = [
      { id: 'f1', fullName: 'Fabian Mendoza', expected: 100, aliases: ['Luis F. Mendoza Jimenez'] },
    ]
    const results = matchRows(parseStatement('LUIS MENDOZA J   25.00'), withDeps)
    assert.equal(results[0].matchedClientId, 'f1')
    assert.equal(results[0].status, 'matched')
  })
})

describe('tokens ignora iniciales sueltas', () => {
  test('"LUIS MENDOZA J" ≈ "Luis F. Mendoza Jimenez" (≥0.9)', () => {
    assert.ok(nameSimilarity('LUIS MENDOZA J', 'Luis F. Mendoza Jimenez') >= 0.9)
  })
})

describe('apellido cortado empareja por prefijo', () => {
  test('"MARY VIVAS PAR" ≈ "Mary Vivas Parra" (≥0.9)', () => {
    assert.ok(nameSimilarity('MARY VIVAS PAR', 'Mary Vivas Parra') >= 0.9)
  })
  test('"ALEXANDER CHAC" ≈ "Alexander Chacin" (≥0.9)', () => {
    assert.ok(nameSimilarity('ALEXANDER CHAC', 'Alexander Chacin') >= 0.9)
  })
  test('"EDDY MONTES AL" ≈ "Eddy L Montes Almarza" (prefijo de 2, ≥0.9)', () => {
    assert.ok(nameSimilarity('EDDY MONTES AL', 'Eddy L Montes Almarza') >= 0.9)
  })
  test('ignora conectores "de"/"la" en apellidos', () => {
    assert.ok(nameSimilarity('JUAN DE LA CRUZ', 'Juan Cruz') >= 0.9)
  })
  test('no sobre-empareja apellidos distintos', () => {
    assert.ok(nameSimilarity('Oscar Hernandez', 'Oscar Gomez') < 0.6)
  })
})
