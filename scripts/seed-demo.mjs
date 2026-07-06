// ─────────────────────────────────────────────────────────────────────────────
// USUARIO DEMO — agencia de demostración con datos ficticios.
//
// Crea (o RESETEA) la agencia "Agencia Demo" con un usuario admin y datos de
// muestra 100% ficticios, aislados por multi-tenant: el usuario demo JAMÁS ve
// los datos reales de otras agencias.
//
//   Login:      demo@agenciademo.com
//   Contraseña: Demo2026!
//
// Las fechas se generan RELATIVAS al momento de correr el script (citas hoy,
// cumpleaños esta semana, renovaciones próximas), así el demo siempre se ve
// "vivo". Correrlo de nuevo BORRA todos los datos de la agencia demo (lo que
// el prospecto haya tocado) y los vuelve a sembrar — úsalo como botón de
// reset antes de cada presentación.
//
// Uso:
//   node --env-file=.env scripts/seed-demo.mjs
//
// No siembra SSN ni datos bancarios (quedan vacíos): el demo no necesita PII.
// ─────────────────────────────────────────────────────────────────────────────

import { PrismaClient } from '../src/generated/prisma/index.js'
import { PrismaPg } from '@prisma/adapter-pg'
import bcrypt from 'bcryptjs'

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL })
const prisma = new PrismaClient({ adapter })

const AGENCY_NAME = 'Agencia Demo'
const DEMO_EMAIL = 'demo@agenciademo.com'
const DEMO_PASSWORD = 'Demo2026!'
const DEMO_USER_NAME = 'Alex Rivera'

// ── Helpers de fechas relativas ───────────────────────────────────────────────
const now = new Date()
const days = n => new Date(now.getTime() + n * 24 * 60 * 60 * 1000)
const at = (d, h, m = 0) => { const x = new Date(d); x.setHours(h, m, 0, 0); return x }
// Cumpleaños: nace en `year`, pero el mes/día cae dentro de `inDays` días desde hoy.
const birthday = (year, inDays) => {
  const d = days(inDays)
  return new Date(Date.UTC(year, d.getMonth(), d.getDate()))
}
const ym = d => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
const lastMonth = ym(new Date(now.getFullYear(), now.getMonth() - 1, 1))

async function main() {
  if (!process.env.DATABASE_URL) throw new Error('Falta DATABASE_URL (usa: node --env-file=.env scripts/seed-demo.mjs)')

  // 1. Agencia demo (crear o reutilizar)
  let agency = await prisma.agency.findFirst({ where: { name: AGENCY_NAME } })
  if (!agency) {
    agency = await prisma.agency.create({ data: { name: AGENCY_NAME } })
    console.log(`✔ Agencia creada: ${AGENCY_NAME}`)
  } else {
    console.log(`↻ Agencia existente: ${AGENCY_NAME} — reseteando sus datos...`)
  }
  const agencyId = agency.id

  // 2. RESET: borrar todos los datos de la agencia demo (no el usuario/agencia)
  //    Orden: hijos → padres. Los cascades del schema cubren la mayoría al
  //    borrar clients, pero borramos explícito para no dejar huérfanos.
  for (const model of [
    'claim', 'surveyResponse', 'commissionCheck', 'insurerHistory', 'policyHistory',
    'activity', 'appointment', 'dependent', 'document', 'calendarEvent',
    'googleEventLink', 'campaign', 'prospect', 'commissionPayment', 'commissionRate',
    'notificationLog', 'auditLog', 'settings', 'client',
  ]) {
    await prisma[model].deleteMany({ where: { agencyId } })
  }

  // 3. Usuario demo (admin, para que se vea TODO el sistema)
  const password = await bcrypt.hash(DEMO_PASSWORD, 12)
  const existingUser = await prisma.user.findUnique({ where: { email: DEMO_EMAIL } })
  if (existingUser) {
    await prisma.user.update({ where: { email: DEMO_EMAIL }, data: { agencyId, password, name: DEMO_USER_NAME, role: 'admin', active: true } })
    console.log('↻ Usuario demo reseteado (contraseña restaurada)')
  } else {
    await prisma.user.create({ data: { agencyId, email: DEMO_EMAIL, name: DEMO_USER_NAME, password, role: 'admin', active: true } })
    console.log('✔ Usuario demo creado')
  }

  // 4. Configuración de la agencia demo
  const settings = {
    agentName: DEMO_USER_NAME,
    agentPhone: '(407) 555-0142',
    agentWhatsApp: '14075550142',
    agentEmail: DEMO_EMAIL,
    agentLicense: '99887766',
    agentAddress: '123 Demo Blvd, Orlando, FL 32801',
    birthdayTemplate: '¡Hola {nombre}! 🎂 Todo el equipo de {agente} te desea un feliz cumpleaños. ¡Que lo disfrutes mucho!',
    productionGoals: JSON.stringify({ newClientsMonthly: 5, newClientsAnnual: 50, revenueMonthly: 800, revenueAnnual: 9600, wnClientsMonthly: 2 }),
  }
  for (const [key, value] of Object.entries(settings)) {
    await prisma.settings.create({ data: { agencyId, key, value } })
  }

  // 5. Clientes ficticios (variedad para que cada página tenga contenido)
  const mkClient = data => prisma.client.create({ data: { agencyId, policyYear: now.getFullYear(), coverageType: 'ACA', status: 'Activo', preferredLanguage: 'Español', filesTaxes: true, employmentType: '1099', applicantInPolicy: true, firstPaymentPaid: true, contractDate: days(-200), activationDate: days(-170), renewalDate: new Date(now.getFullYear(), 11, 15), ...data } })

  // Familia completa: ACA + WN + dental, la tarjeta "estrella" del demo
  const carlos = await mkClient({
    fullName: 'Carlos Rodríguez', phone: '(407) 555-0101', email: 'carlos.demo@example.com',
    birthDate: new Date(Date.UTC(1985, 2, 14)), maritalStatus: 'Casado', filingStatus: 'Casado en conjunto',
    address: '742 Palm Ave', city: 'Orlando', state: 'FL', zipCode: '32801', county: 'Orange',
    insurer: 'Ambetter', planName: 'Ambetter Balanced Care 12', planCategory: 'Plata', planNetwork: 'HMO',
    planDeductible: '$1,500', planMaxOOP: '$8,700', planPCP: '$5 copago', planSpecialist: '$40 copago',
    planUrgentCare: '$75 copago', planRxGeneric: '$3 copago',
    affiliatesCount: 4, acaPrice: 1240, aptcAmount: 1180, totalMonthly: 60, annualIncome: 52000,
    dentalInsurer: 'Ameritas', dentalMonthly: 42, dentalDeductible: '$50', dentalMaxBenefit: '$2,000',
    wnPolicies: JSON.stringify([{ type: 'Accidente', monthly: 48 }, { type: 'Hospitalización', monthly: 62 }]),
    wnContractDate: days(-150), tags: JSON.stringify(['VIP']),
    referralRequestStage: 'Refirió', googleReview: 'Sí',
    notes: 'Cliente ejemplar. Refirió a su cuñado en marzo.',
  })
  await prisma.dependent.createMany({ data: [
    { agencyId, clientId: carlos.id, type: 'Cónyuge', name: 'Laura Jiménez', birthDate: new Date(Date.UTC(1987, 6, 22)), inPolicy: true },
    { agencyId, clientId: carlos.id, type: 'Hijo/a', name: 'Mateo Rodríguez', birthDate: new Date(Date.UTC(2015, 4, 3)), inPolicy: true },
    { agencyId, clientId: carlos.id, type: 'Hijo/a', name: 'Valentina Rodríguez', birthDate: new Date(Date.UTC(2018, 9, 17)), inPolicy: true },
  ] })

  // Cumpleaños en 2 días (aparece en "Hoy" y Calendario) + objetivo de venta cruzada (sin dental ni WN)
  const maria = await mkClient({
    fullName: 'María Fernández', phone: '(321) 555-0117', email: 'maria.demo@example.com',
    birthDate: birthday(1992, 2), maritalStatus: 'Soltera', filingStatus: 'Soltero',
    city: 'Kissimmee', state: 'FL', zipCode: '34741', county: 'Osceola',
    insurer: 'Oscar', planName: 'Oscar Bronze Classic', planCategory: 'Bronce',
    affiliatesCount: 1, acaPrice: 385, aptcAmount: 385, totalMonthly: 0, annualIncome: 28000,
  })

  // Primera prima SIN pagar (alerta en "Hoy") — pareja
  const jose = await mkClient({
    fullName: 'José Martínez', phone: '(689) 555-0163', email: 'jose.demo@example.com',
    birthDate: new Date(Date.UTC(1978, 0, 30)), maritalStatus: 'Casado',
    city: 'Tampa', state: 'FL', zipCode: '33601', county: 'Hillsborough',
    insurer: 'Molina', planName: 'Molina Silver 4', planCategory: 'Plata',
    affiliatesCount: 2, acaPrice: 890, aptcAmount: 810, totalMonthly: 80, annualIncome: 41000,
    contractDate: days(-12), activationDate: days(18), firstPaymentPaid: false,
  })
  await prisma.dependent.create({ data: { agencyId, clientId: jose.id, type: 'Cónyuge', name: 'Rosa Martínez', birthDate: new Date(Date.UTC(1980, 3, 12)), inPolicy: true } })

  // Cancelada (para el filtro de estatus y estadísticas)
  await mkClient({
    fullName: 'Ana López', phone: '(407) 555-0129',
    birthDate: new Date(Date.UTC(1990, 7, 8)), city: 'Orlando', state: 'FL',
    insurer: 'Ambetter', planName: 'Ambetter Everyday 5', planCategory: 'Bronce',
    affiliatesCount: 1, acaPrice: 410, aptcAmount: 410, totalMonthly: 0,
    status: 'Cancelado', cancellationDate: days(-35), notes: 'Consiguió trabajo W-2 con beneficios.',
  })

  // Cliente WN con reclamos (para la página Reclamos WN)
  const pedro = await mkClient({
    fullName: 'Pedro Sánchez', phone: '(863) 555-0148', email: 'pedro.demo@example.com',
    birthDate: new Date(Date.UTC(1969, 10, 2)), city: 'Lakeland', state: 'FL',
    insurer: 'Cigna', planName: 'Cigna Connect Silver', planCategory: 'Plata',
    affiliatesCount: 1, acaPrice: 720, aptcAmount: 650, totalMonthly: 70, annualIncome: 36000,
    wnPolicies: JSON.stringify([{ type: 'Cáncer', monthly: 55 }]), wnContractDate: days(-300),
    wnSecondPaymentReceived: true,
  })
  await prisma.claim.createMany({ data: [
    { agencyId, clientId: pedro.id, type: 'Hospitalización', status: 'Pagado', claimNumber: 'WN-88412', serviceDate: days(-90), filedDate: days(-85), amount: 3500, amountPaid: 3500, notes: 'Pagado en 3 semanas.' },
    { agencyId, clientId: pedro.id, type: 'Accidente', status: 'En revisión', claimNumber: 'WN-90233', serviceDate: days(-10), filedDate: days(-7), amount: 1200 },
  ] })

  // Top referidora (para Referidos)
  const luisa = await mkClient({
    fullName: 'Luisa Torres', phone: '(407) 555-0186', email: 'luisa.demo@example.com',
    birthDate: new Date(Date.UTC(1983, 1, 19)), city: 'Winter Park', state: 'FL',
    insurer: 'Oscar', planName: 'Oscar Silver Saver', planCategory: 'Plata',
    affiliatesCount: 1, acaPrice: 610, aptcAmount: 540, totalMonthly: 70, annualIncome: 33000,
    dentalInsurer: 'Guardian', dentalMonthly: 35,
    referralRequestStage: 'Refirió', googleReview: 'Sí',
  })

  // Titular NO cubierto en la póliza (demuestra pólizas vs vidas)
  const roberto = await mkClient({
    fullName: 'Roberto Díaz', phone: '(305) 555-0171',
    birthDate: new Date(Date.UTC(1975, 5, 27)), city: 'Miami', state: 'FL',
    insurer: 'Aetna CVS', planName: 'Aetna Silver 2', planCategory: 'Plata',
    affiliatesCount: 3, applicantInPolicy: false, applicantExclusionReason: 'Tiene Medicare',
    acaPrice: 760, aptcAmount: 700, totalMonthly: 60, annualIncome: 39000,
  })
  await prisma.dependent.createMany({ data: [
    { agencyId, clientId: roberto.id, type: 'Cónyuge', name: 'Elena Díaz', birthDate: new Date(Date.UTC(1979, 8, 5)), inPolicy: true },
    { agencyId, clientId: roberto.id, type: 'Hijo/a', name: 'Andrés Díaz', birthDate: new Date(Date.UTC(2010, 11, 1)), inPolicy: true },
  ] })

  // Cumpleaños HOY (impacto inmediato al abrir "Hoy")
  await mkClient({
    fullName: 'Carmen Ruiz', phone: '(786) 555-0154',
    birthDate: birthday(1995, 0), city: 'Hialeah', state: 'FL',
    insurer: 'Ambetter', planName: 'Ambetter Clear 30', planCategory: 'Plata',
    affiliatesCount: 1, acaPrice: 520, aptcAmount: 470, totalMonthly: 50, annualIncome: 30000,
  })

  // Renovación en 20 días (aparece en renovaciones/dashboard)
  const miguel = await mkClient({
    fullName: 'Miguel Herrera', phone: '(941) 555-0139',
    birthDate: new Date(Date.UTC(1988, 3, 9)), city: 'Sarasota', state: 'FL',
    insurer: 'Molina', planName: 'Molina Bronze 1', planCategory: 'Bronce',
    affiliatesCount: 1, acaPrice: 340, aptcAmount: 340, totalMonthly: 0,
    renewalDate: days(20),
  })

  // Cambió de aseguradora (historial de aseguradoras + conciliación)
  await prisma.insurerHistory.create({ data: {
    agencyId, clientId: miguel.id, insurer: 'Oscar',
    startDate: new Date(now.getFullYear() - 1, 0, 1), endDate: new Date(now.getFullYear(), 2, 1),
    notes: 'Cambió a Molina en marzo por mejor red de doctores.',
  } })
  await prisma.policyHistory.create({ data: {
    agencyId, clientId: carlos.id, year: now.getFullYear() - 1, insurer: 'Ambetter',
    planName: 'Ambetter Balanced Care 4', planCategory: 'Plata', acaPrice: 1150, totalMonthly: 55,
  } })

  // 6. Actividades, citas y eventos de calendario
  await prisma.activity.createMany({ data: [
    { agencyId, clientId: carlos.id, type: 'Llamada', content: 'Revisión anual de cobertura. Interesado en subir el plan a Oro el próximo OEP.', createdAt: days(-3) },
    { agencyId, clientId: jose.id, type: 'Nota', content: 'Se le envió recordatorio de pago de la primera prima por WhatsApp.', createdAt: days(-1) },
    { agencyId, clientId: pedro.id, type: 'Nota', content: 'Se envió el reclamo WN-90233 a Washington National con las facturas del hospital.', createdAt: days(-7) },
    { agencyId, clientId: maria.id, type: 'Llamada', content: 'Se le ofreció plan dental. Pidió que la llamen después de su cumpleaños.', createdAt: days(-2) },
  ] })
  await prisma.appointment.createMany({ data: [
    { agencyId, clientId: carlos.id, date: at(now, 10, 30), notes: 'Revisión de póliza y cotizar visión', status: 'Programada' },
    { agencyId, clientId: jose.id, date: at(now, 15, 0), notes: 'Confirmar pago de primera prima', status: 'Programada' },
    { agencyId, clientId: maria.id, date: at(days(3), 11, 0), notes: 'Cotización de plan dental', status: 'Programada' },
  ] })
  await prisma.calendarEvent.createMany({ data: [
    { agencyId, title: 'Webinar: novedades del Marketplace', date: at(days(1), 9, 0), notes: 'Enlace en el email de CMS', source: 'crm' },
    { agencyId, title: 'Seguimiento reclamo WN de Pedro', date: at(days(5), 14, 0), clientId: pedro.id, source: 'crm' },
  ] })

  // 7. Pipeline de prospectos
  await prisma.prospect.createMany({ data: [
    { agencyId, fullName: 'Gabriela Núñez', phone: '(407) 555-0192', state: 'FL', source: 'Facebook', stage: 'Nuevo Lead (Por Contactar)', zipCode: '32809', householdSize: '3', income: '45000' },
    { agencyId, fullName: 'Andrés Peña', phone: '(321) 555-0175', state: 'FL', source: 'Referido', stage: 'En Espera de Decisión / Docs', referredByClientId: luisa.id, referredByName: 'Luisa Torres', callbackAt: at(days(1), 16, 0), notes: 'Referido por Luisa. Falta prueba de ingresos.' },
    { agencyId, fullName: 'Diana Castillo', phone: '(689) 555-0110', state: 'FL', source: 'Google', stage: 'Contactado', consentAt: days(-2), sherpaStatus: 'enviado' },
    { agencyId, fullName: 'Héctor Molina', phone: '(863) 555-0121', state: 'GA', source: 'Llamada', stage: 'Cerrado - Ganado', notes: 'Convertido a cliente en el último OEP.' },
    { agencyId, fullName: 'Patricia Vega', phone: '(305) 555-0138', state: 'FL', source: 'Facebook', stage: 'Cerrado - Perdido', lossReason: 'PRECIO_INGRESOS' },
  ] })

  // 8. Comisiones: tasas, un pago del mes pasado y conciliación
  await prisma.commissionRate.createMany({ data: [
    { agencyId, insurer: 'Ambetter', pmpm: 20, paymentDay: 15, monthsToFirstPayment: 2 },
    { agencyId, insurer: 'Oscar', pmpm: 18, paymentDay: 20, monthsToFirstPayment: 1 },
    { agencyId, insurer: 'Molina', pmpm: 17, paymentDay: 15, monthsToFirstPayment: 2 },
    { agencyId, insurer: 'Cigna', pmpm: 19, paymentDay: 25, monthsToFirstPayment: 2 },
    { agencyId, insurer: 'Aetna CVS', pmpm: 18, paymentDay: 20, monthsToFirstPayment: 2 },
  ] })
  await prisma.commissionPayment.create({ data: {
    agencyId, insurer: 'Ambetter', period: lastMonth, amount: 100, receivedDate: days(-15),
    notes: 'Depósito directo', items: JSON.stringify([
      { clientId: carlos.id, name: 'Carlos Rodríguez', amount: 80 },
      { clientId: 'demo', name: 'Carmen Ruiz', amount: 20 },
    ]),
  } })
  await prisma.commissionCheck.createMany({ data: [
    { agencyId, clientId: carlos.id, period: lastMonth, received: true },
    { agencyId, clientId: luisa.id, period: lastMonth, received: true },
    { agencyId, clientId: miguel.id, period: lastMonth, received: false, gapReason: 'broker' },
  ] })

  // 9. Campañas (historial con una enviada y un borrador)
  await prisma.campaign.createMany({ data: [
    { agencyId, subject: '🦷 Protege tu sonrisa: planes dentales desde $25/mes', message: 'Hola {nombre},\n\n¿Sabías que tu plan de salud no cubre limpiezas ni tratamientos dentales? Tenemos opciones desde $25 al mes.\n\nResponde este correo o escríbenos por WhatsApp para una cotización sin compromiso.', segment: JSON.stringify({ missing: 'dental' }), sentAt: days(-9), sentCount: 5, failedCount: 0 },
    { agencyId, subject: 'Recordatorio: renovación de tu póliza', message: 'Hola {nombre},\n\nSe acerca el período de renovación. Agenda tu cita para revisar tu cobertura y tu crédito fiscal.', segment: JSON.stringify({ status: 'Activo' }) },
  ] })

  // 10. Encuesta de satisfacción respondida
  await prisma.surveyResponse.create({ data: {
    agencyId, clientId: carlos.id, ratingAtention: 5, ratingClarity: 5, ratingSpeed: 4, ratingDedication: 5,
    recommends: 'Sí', comments: 'Excelente servicio, siempre disponible.', submittedAt: days(-20),
  } })

  const nClients = await prisma.client.count({ where: { agencyId } })
  console.log(`\n✅ Demo listo — ${nClients} clientes, 5 prospectos, 2 reclamos, 2 campañas.`)
  console.log('────────────────────────────────────────')
  console.log(`   Agencia:    ${AGENCY_NAME}`)
  console.log(`   Usuario:    ${DEMO_EMAIL}`)
  console.log(`   Contraseña: ${DEMO_PASSWORD}`)
  console.log('────────────────────────────────────────')
  console.log('Para resetear el demo antes de una presentación, vuelve a correr este script.')
}

main()
  .catch(e => { console.error(e); process.exit(1) })
  .finally(() => prisma.$disconnect())
