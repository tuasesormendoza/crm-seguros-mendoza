// Exports ALL data from the current SQLite dev.db into a single JSON file
// (data-export.json). This is the safety net for the SQLite -> PostgreSQL
// (Neon) migration — run this BEFORE switching DATABASE_URL to Postgres,
// then run scripts/import-to-postgres.mjs against the new Neon database.
//
// Usage:
//   node scripts/export-sqlite-data.mjs
//
// Produces: ./data-export.json  (gitignored — contains real client PII:
// SSNs, bank accounts, portal passwords, medical info — never commit it)

import Database from 'better-sqlite3'
import path from 'path'
import fs from 'fs'

const dbPath = path.resolve(process.cwd(), 'dev.db')
const db = new Database(dbPath, { readonly: true })

// Map: output key -> actual SQLite table name (Prisma default = model name,
// PascalCase, matching the @@map absence in schema.prisma)
const TABLES = {
  user: 'User',
  settings: 'Settings',
  commissionRate: 'CommissionRate',
  client: 'Client',
  dependent: 'Dependent',
  appointment: 'Appointment',
  activity: 'Activity',
  policyHistory: 'PolicyHistory',
  document: 'Document',
  notificationLog: 'NotificationLog',
  prospect: 'Prospect',
}

function main() {
  const out = {}
  for (const [key, table] of Object.entries(TABLES)) {
    try {
      const rows = db.prepare(`SELECT * FROM "${table}"`).all()
      out[key] = rows
      console.log(`  ${key} (${table}): ${rows.length} rows`)
    } catch (e) {
      console.warn(`  ! skipping ${table}: ${e.message}`)
      out[key] = []
    }
  }
  fs.writeFileSync(
    path.resolve(process.cwd(), 'data-export.json'),
    JSON.stringify(out, null, 2)
  )
  console.log('\n✓ Exported to data-export.json (DO NOT commit — contains real client PII)')
}

main()
db.close()
