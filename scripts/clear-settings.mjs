// Vacía SOLO la tabla Settings (no toca clientes ni nada más).
//
// Por qué: el cambio de esquema agrega una columna `id` requerida a Settings,
// y Prisma no puede hacerlo si la tabla ya tiene filas. Tus 32 settings ya
// están en tu respaldo (backup JSON), así que los borramos aquí y el script
// migrate-to-multitenant.mjs los restaura después del `db push`.
//
// Uso:
//   node --env-file=.env scripts/clear-settings.mjs

import { PrismaClient } from '../src/generated/prisma/index.js'
import { PrismaPg } from '@prisma/adapter-pg'

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL })
const prisma = new PrismaClient({ adapter })

async function main() {
  if (!process.env.DATABASE_URL) throw new Error('Falta DATABASE_URL')
  // Raw SQL para no depender de que el esquema del cliente coincida con el de la BD.
  const count = await prisma.$executeRawUnsafe('DELETE FROM "Settings"')
  console.log(`✓ Tabla Settings vaciada: ${count} fila(s) borradas.`)
  console.log('  (Están a salvo en tu respaldo — se restauran en el paso 3.)')
}

main()
  .catch(e => { console.error('✗ Error:', e); process.exit(1) })
  .finally(() => prisma.$disconnect())
