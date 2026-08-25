// ─────────────────────────────────────────────────────────────────────────────
// RESTABLECER LA CONTRASEÑA DE UN USUARIO DEL CRM
//
// El CRM no tiene recuperación por email, así que este script es la salida
// cuando alguien olvida su contraseña.
//
// La contraseña se pide OCULTA por teclado, nunca como argumento: un argumento
// quedaría escrito en el historial del terminal y en la lista de procesos, a la
// vista de cualquiera que use el equipo después.
//
//   node --env-file=.env scripts/reset-password.mjs                  → lista usuarios
//   node --env-file=.env scripts/reset-password.mjs tu@email.com     → cambia la clave
//   node --env-file=.env scripts/reset-password.mjs tu@email.com --2fa
//        → además borra la verificación en dos pasos (solo si TAMBIÉN perdiste
//          el acceso a Google Authenticator; tendrás que volver a registrarlo)
// ─────────────────────────────────────────────────────────────────────────────

import { createInterface } from 'node:readline'
import bcrypt from 'bcryptjs'
import { PrismaClient } from '../src/generated/prisma/client.js'
import { PrismaNeon } from '@prisma/adapter-neon'

const MIN_LEN = 10

const prisma = new PrismaClient({
  adapter: new PrismaNeon({ connectionString: process.env.DATABASE_URL }),
})

// Lee del teclado sin mostrar lo tecleado: se silencia la salida de readline
// mientras se escribe, así la contraseña no queda a la vista de nadie.
function askHidden(question) {
  return new Promise(resolve => {
    const rl = createInterface({ input: process.stdin, output: process.stdout, terminal: true })
    let muted = false
    rl._writeToOutput = function (texto) { if (!muted) rl.output.write(texto) }
    rl.question(question, respuesta => {
      rl.close()
      process.stdout.write('\n')
      resolve(respuesta)
    })
    muted = true
  })
}

async function main() {
  const [email, ...flags] = process.argv.slice(2)
  const reset2fa = flags.includes('--2fa')

  if (!process.env.DATABASE_URL) {
    console.error('❌ Falta DATABASE_URL. Ejecuta el comando con  --env-file=.env')
    process.exit(1)
  }

  if (!email) {
    const usuarios = await prisma.user.findMany({
      select: { email: true, name: true, role: true, active: true, totpEnabled: true },
      orderBy: { email: 'asc' },
    })
    console.log('\nUsuarios del CRM:\n')
    for (const u of usuarios) {
      console.log('  ' + u.email)
      console.log('     ' + u.name + ' · ' + u.role + (u.active ? '' : ' · DESACTIVADO') + ' · 2FA: ' + (u.totpEnabled ? 'activada' : 'no'))
    }
    console.log('\nPara cambiar una contraseña:')
    console.log('  node --env-file=.env scripts/reset-password.mjs TU@EMAIL.COM\n')
    return
  }

  const objetivo = email.trim().toLowerCase()
  const user = await prisma.user.findFirst({ where: { email: objetivo } })
  if (!user) {
    console.error('❌ No existe ningún usuario con el email "' + objetivo + '".')
    console.error('   Ejecuta el script sin argumentos para ver la lista.')
    process.exit(1)
  }

  console.log('\nUsuario: ' + user.name + ' <' + user.email + '> · ' + user.role)
  console.log('2FA (Google Authenticator): ' + (user.totpEnabled ? 'ACTIVADA' : 'no activada'))
  if (user.totpEnabled && !reset2fa) {
    console.log('→ Tras cambiar la contraseña seguirás necesitando tu código del autenticador.')
    console.log('  Si también lo perdiste, vuelve a ejecutar añadiendo  --2fa')
  }
  console.log()

  const pass1 = await askHidden('Nueva contraseña (mínimo ' + MIN_LEN + ' caracteres): ')
  if (pass1.length < MIN_LEN) {
    console.error('\n❌ Demasiado corta: ' + pass1.length + ' caracteres, mínimo ' + MIN_LEN + '. No se cambió nada.')
    process.exit(1)
  }
  const pass2 = await askHidden('Repítela para confirmar: ')
  if (pass1 !== pass2) {
    console.error('\n❌ Las dos contraseñas no coinciden. No se cambió nada.')
    process.exit(1)
  }

  // Mismo coste que usa el CRM al cambiar la contraseña desde Configuración.
  const hashed = await bcrypt.hash(pass1, 12)

  await prisma.user.update({
    where: { id: user.id },
    data: {
      password: hashed,
      ...(reset2fa ? { totpSecret: null, totpEnabled: false, backupCodes: null } : {}),
    },
  })

  // Quitar el bloqueo por intentos fallidos: si no, tras varios intentos el
  // usuario sigue sin poder entrar aunque la contraseña ya sea correcta.
  const borrados = await prisma.loginAttempt.deleteMany({
    where: { identifier: { in: [objetivo, user.email] } },
  })

  console.log('\n✅ Contraseña cambiada.')
  if (borrados.count) console.log('✅ Bloqueo por intentos fallidos eliminado.')
  if (reset2fa) {
    console.log('✅ Verificación en dos pasos borrada: al entrar te pedirá registrarla de nuevo.')
    console.log('   Ten a mano Google Authenticator para escanear el código QR.')
  }
  console.log('\nEntra en https://crm-seguros-mendoza.netlify.app con tu email y la contraseña nueva.\n')
}

main()
  .catch(e => { console.error('\n❌', e.message); process.exit(1) })
  .finally(() => prisma.$disconnect())
