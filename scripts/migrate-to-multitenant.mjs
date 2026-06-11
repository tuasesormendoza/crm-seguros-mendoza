// ─────────────────────────────────────────────────────────────────────────────
// MIGRACIÓN A MULTI-TENANT (multi-agencia)
//
// Qué hace (de forma IDEMPOTENTE y NO destructiva):
//   1. Crea (o reutiliza) una Agencia por defecto para tus datos actuales.
//   2. Asigna esa agencia (agencyId) a TODOS los registros existentes que aún
//      no tengan agencia (clientes, dependientes, documentos, citas, actividades,
//      historiales, prospectos, comisiones, eventos, settings, logs y usuarios).
//   3. (Opcional) Si la tabla de settings quedó vacía tras el cambio de esquema,
//      restaura los settings desde un backup JSON (el que descargas con el botón
//      "Respaldo" de Configuración).
//
// REQUISITOS antes de correrlo:
//   - Haber hecho `prisma db push` para que las columnas agencyId existan.
//   - Tener DATABASE_URL en el entorno (.env).
//
// Uso:
//   export AGENCY_NAME="Agencia Mendoza"          # opcional, default abajo
//   export RESTORE_SETTINGS_FROM="/ruta/backup.json"  # opcional
//   node scripts/migrate-to-multitenant.mjs
//
// Es seguro correrlo varias veces: solo toca filas con agencyId NULL.
// ─────────────────────────────────────────────────────────────────────────────

import { PrismaClient } from '../src/generated/prisma/index.js'
import { PrismaPg } from '@prisma/adapter-pg'
import { readFileSync } from 'fs'

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL })
const prisma = new PrismaClient({ adapter })

const AGENCY_NAME = process.env.AGENCY_NAME || 'Agencia Mendoza'
const RESTORE_SETTINGS_FROM = process.env.RESTORE_SETTINGS_FROM || ''

async function main() {
  if (!process.env.DATABASE_URL) throw new Error('Falta DATABASE_URL')

  // 1. Crear o reutilizar la agencia por defecto
  let agency = await prisma.agency.findFirst({ where: { name: AGENCY_NAME } })
  if (!agency) {
    agency = await prisma.agency.create({ data: { name: AGENCY_NAME } })
    console.log(`✓ Agencia creada: "${agency.name}" (${agency.id})`)
  } else {
    console.log(`• Agencia ya existía: "${agency.name}" (${agency.id})`)
  }
  const agencyId = agency.id

  // 2. Backfill de agencyId en cada tabla (solo filas con agencyId NULL)
  const tables = [
    ['client',            () => prisma.client.updateMany({ where: { agencyId: null }, data: { agencyId } })],
    ['dependent',         () => prisma.dependent.updateMany({ where: { agencyId: null }, data: { agencyId } })],
    ['document',          () => prisma.document.updateMany({ where: { agencyId: null }, data: { agencyId } })],
    ['appointment',       () => prisma.appointment.updateMany({ where: { agencyId: null }, data: { agencyId } })],
    ['activity',          () => prisma.activity.updateMany({ where: { agencyId: null }, data: { agencyId } })],
    ['policyHistory',     () => prisma.policyHistory.updateMany({ where: { agencyId: null }, data: { agencyId } })],
    ['insurerHistory',    () => prisma.insurerHistory.updateMany({ where: { agencyId: null }, data: { agencyId } })],
    ['prospect',          () => prisma.prospect.updateMany({ where: { agencyId: null }, data: { agencyId } })],
    ['commissionRate',    () => prisma.commissionRate.updateMany({ where: { agencyId: null }, data: { agencyId } })],
    ['commissionPayment', () => prisma.commissionPayment.updateMany({ where: { agencyId: null }, data: { agencyId } })],
    ['commissionCheck',   () => prisma.commissionCheck.updateMany({ where: { agencyId: null }, data: { agencyId } })],
    ['calendarEvent',     () => prisma.calendarEvent.updateMany({ where: { agencyId: null }, data: { agencyId } })],
    ['settings',          () => prisma.settings.updateMany({ where: { agencyId: null }, data: { agencyId } })],
    ['notificationLog',   () => prisma.notificationLog.updateMany({ where: { agencyId: null }, data: { agencyId } })],
    ['user',              () => prisma.user.updateMany({ where: { agencyId: null }, data: { agencyId } })],
  ]

  for (const [name, fn] of tables) {
    const res = await fn()
    console.log(`  ${name}: ${res.count} fila(s) asignada(s) a la agencia`)
  }

  // 3. (Opcional) Restaurar settings desde backup si la tabla quedó vacía
  if (RESTORE_SETTINGS_FROM) {
    const existing = await prisma.settings.count({ where: { agencyId } })
    if (existing === 0) {
      const backup = JSON.parse(readFileSync(RESTORE_SETTINGS_FROM, 'utf8'))
      const rows = backup?.tables?.settings?.data ?? []
      let restored = 0
      for (const r of rows) {
        if (!r.key) continue
        await prisma.settings.upsert({
          where: { agencyId_key: { agencyId, key: r.key } },
          update: { value: String(r.value ?? '') },
          create: { agencyId, key: r.key, value: String(r.value ?? '') },
        })
        restored++
      }
      console.log(`✓ Settings restaurados desde backup: ${restored}`)
    } else {
      console.log(`• Settings ya tenían ${existing} filas — no se restaura desde backup`)
    }
  }

  // Resumen final
  const userCount = await prisma.user.count({ where: { agencyId } })
  const clientCount = await prisma.client.count({ where: { agencyId } })
  console.log(`\n✅ Migración completa. Agencia "${agency.name}": ${userCount} usuario(s), ${clientCount} cliente(s).`)
  console.log('   Ahora todos tus usuarios y datos pertenecen a esta agencia.')
}

main()
  .catch(e => { console.error('✗ Error en la migración:', e); process.exit(1) })
  .finally(() => prisma.$disconnect())
