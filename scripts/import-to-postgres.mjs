// Imports the JSON produced by scripts/export-sqlite-data.mjs into the new
// PostgreSQL (Neon) database, preserving IDs and relations.
//
// PRE-REQUISITES:
//   1. DATABASE_URL in .env (or .env.local) must point to your NEW Neon Postgres DB
//   2. The schema must already be pushed to that DB:  npx prisma db push
//   3. data-export.json must exist (run scripts/export-sqlite-data.mjs first)
//
// Usage:
//   node scripts/import-to-postgres.mjs
//
// Safe to re-run: uses upsert, so it won't create duplicates.

import { PrismaClient } from '../src/generated/prisma/index.js'
import { PrismaPg } from '@prisma/adapter-pg'
import fs from 'fs'
import path from 'path'

const connectionString = process.env.DATABASE_URL
if (!connectionString) {
  console.error('✗ DATABASE_URL is not set. Point it at your Neon Postgres DB before running this.')
  process.exit(1)
}
if (connectionString.includes('localhost') || connectionString.includes('127.0.0.1')) {
  console.error('✗ DATABASE_URL looks like a local placeholder, not your Neon DB. Aborting to avoid mistakes.')
  process.exit(1)
}

const adapter = new PrismaPg({ connectionString })
const prisma = new PrismaClient({ adapter })

const file = path.resolve(process.cwd(), 'data-export.json')
if (!fs.existsSync(file)) {
  console.error('✗ data-export.json not found. Run scripts/export-sqlite-data.mjs first.')
  process.exit(1)
}
const data = JSON.parse(fs.readFileSync(file, 'utf-8'))

// SQLite stores datetimes as ISO strings or epoch — Prisma normally handles
// the conversion, but since we're using raw exported rows we need to coerce
// known date fields back into JS Date objects for Postgres.
const DATE_FIELDS = {
  user: ['createdAt', 'updatedAt'],
  settings: ['updatedAt'],
  commissionRate: ['updatedAt'],
  client: [
    'contractDate', 'birthDate', 'wnContractDate', 'cancellationDate',
    'activationDate', 'renewalDate', 'policyExpirationDate', 'firstPaymentDate',
    'createdAt', 'updatedAt',
  ],
  dependent: ['birthDate'],
  appointment: ['date', 'createdAt'],
  activity: ['createdAt'],
  policyHistory: ['recordedAt'],
  document: ['uploadedAt'],
  notificationLog: ['sentAt'],
  prospect: ['assignedDate', 'consentAt', 'callbackAt', 'followUpAt', 'createdAt', 'updatedAt'],
}

// Boolean fields stored as 0/1 in SQLite need coercion to real booleans for Postgres.
const BOOL_FIELDS = {
  client: [
    'filesTaxes', 'wnSecondPaymentReceived', 'wnClawbackReturned',
    'firstPaymentPaid', 'applicantInPolicy', 'active',
  ],
  dependent: ['inPolicy'],
  user: ['active'],
}

function coerceRow(model, row) {
  const out = { ...row }
  for (const f of DATE_FIELDS[model] || []) {
    if (out[f] != null) out[f] = new Date(out[f])
  }
  for (const f of BOOL_FIELDS[model] || []) {
    if (out[f] != null) out[f] = !!out[f] && out[f] !== 0
  }
  return out
}

// Import order matters: parents before children (FK constraints).
const ORDER = [
  'user', 'settings', 'commissionRate', 'client',
  'dependent', 'appointment', 'activity', 'policyHistory', 'document',
  'notificationLog', 'prospect',
]

async function main() {
  for (const model of ORDER) {
    const rows = data[model] || []
    let count = 0
    for (const raw of rows) {
      const row = coerceRow(model, raw)
      let where
      if (model === 'settings') where = { key: row.key }
      else if (model === 'commissionRate') where = { id: row.id }
      else if (model === 'notificationLog') where = { type_refId: { type: row.type, refId: row.refId } }
      else where = { id: row.id }
      await prisma[model].upsert({ where, create: row, update: row })
      count++
    }
    console.log(`  ${model}: ${count} rows imported`)
  }
  console.log('\n✓ Import complete')
}

main()
  .catch((e) => { console.error(e); process.exit(1) })
  .finally(() => prisma.$disconnect())
