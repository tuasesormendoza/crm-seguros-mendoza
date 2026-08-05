// El nombre de la carpeta lo escribe el agente a mano. Si se cuela un valor
// raro, el respaldo del día se quedaría sin sitio donde ir, así que cualquier
// caso dudoso tiene que caer en el nombre por defecto.

import { test } from 'node:test'
import assert from 'node:assert'
import { sanitizeFolderName, BACKUP_FOLDER_NAME } from './googleDrive.ts'

test('un nombre normal se respeta tal cual', () => {
  assert.strictEqual(sanitizeFolderName('Respaldos CRM 2026'), 'Respaldos CRM 2026')
})

test('se quitan los espacios de los extremos', () => {
  assert.strictEqual(sanitizeFolderName('   Mis Respaldos   '), 'Mis Respaldos')
})

test('vacío, solo espacios, null o undefined → nombre por defecto', () => {
  for (const v of ['', '    ', null, undefined]) {
    assert.strictEqual(sanitizeFolderName(v), BACKUP_FOLDER_NAME, `falló con ${JSON.stringify(v)}`)
  }
})

test('los caracteres de control se eliminan', () => {
  assert.strictEqual(sanitizeFolderName('Resp\u0007aldos'), 'Respaldos')
})

test('un nombre hecho solo de caracteres de control cae en el por defecto', () => {
  assert.strictEqual(sanitizeFolderName('\u0001\u0002'), BACKUP_FOLDER_NAME)
})

test('un nombre larguísimo se recorta en vez de romper la subida', () => {
  const out = sanitizeFolderName('R'.repeat(500))
  assert.strictEqual(out.length, 100)
})

test('se admiten acentos y emojis (Drive los acepta)', () => {
  assert.strictEqual(sanitizeFolderName('📁 Copias de Seguridad — Pólizas'), '📁 Copias de Seguridad — Pólizas')
})
