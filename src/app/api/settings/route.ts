import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getSession } from '@/lib/session'
import { getAuth, requireAdmin } from '@/lib/auth'
import { isOwner, getPlatformSettings, PLATFORM_KEYS, PLATFORM_SECRET_KEYS } from '@/lib/platform'

// Keys that must never be sent to non-admin users
const SECRET_KEYS = ['cmsApiKey', 'anthropicApiKey', 'smtpUser', 'smtpPass']

// Default values shown when no settings exist yet.
//
// OJO: los datos del AGENTE (nombre, teléfono, WhatsApp, link de reseñas, web)
// nacen VACÍOS a propósito. El CRM se vende a otras agencias: si trajeran un
// valor precargado, el agente que acaba de comprarlo firmaría sus mensajes con
// el nombre de otro y pediría reseñas para el negocio de otro sin enterarse.
// Vacío hace que la app enseñe el aviso de "completa tu perfil" (ver
// src/lib/agentProfile.ts) en lugar de datos ajenos.
const DEFAULTS: Record<string, string> = {
  // Brand colors — must match THEME_DEFAULTS in /api/theme and globals.css
  themeBrand800:          '#053F5C',
  themeBrand500:          '#429EBD',
  themeBrand300:          '#9FE7F5',
  themeAccent:            '#F7AD19',
  agentName:              '',
  agentPhone:             '',
  agentWhatsApp:          '',
  anthropicApiKey:        '',
  agentEmail:             '',
  agentLicense:           '',
  agentAddress:           '',
  agentStateLicenses:     '',
  gaAccessPhone:          '8883124237',
  marketplacePhone:       '8557886275',
  healthSherpaConsentUrl: '',
  cmsApiKey:              '',
  fplYear:                '2026',
  fpl1Person:             '15650',
  fplPerPerson:           '5500',
  aptcMaxPct:             '8.5',
  bestPlansRankMode:      'protection',
  birthdayTemplate:       'Hola {nombre}, ¡feliz cumpleaños! 🎂🎉 Que tengas un día muy especial lleno de alegría. Con cariño, {agente}',
  googleReviewLink:       '',
  whatsappTemplate:       'Hola {nombre}, fue un placer atenderte. Te agradecería mucho si pudieras dejarnos una reseña en Google, solo toma 1 minuto 🙏: {link}',
  whatsappReminderTemplate: 'Hola {nombre}, quería recordarte que nos encantaría contar con tu reseña en Google: {link} ¡Gracias!',
  defaultPolicyYear:      new Date().getFullYear().toString(),
  defaultRenewalDate:     '11/15',
  defaultExpirationDate:  '12/31',
  wnCommissionPct:        '25',
  // Marca de la Tarjeta de Plan (white-label por agencia)
  cardWebsite:            '',
  cardHeaderColor:        '#0D2A4A',
  cardAccentColor:        '#F0C040',
  // Carpeta de Google Drive donde se guardan los respaldos diarios.
  driveBackupFolder:      'CRM Seguros - Backups',
  emailEnabled:           'false',
  emailFrom:              '',
  emailTo:                '',
  smtpHost:               'smtp.gmail.com',
  smtpPort:               '587',
  smtpUser:               '',
  smtpPass:               '',
}

export async function GET() {
  const auth = await getAuth()
  if (auth instanceof NextResponse) return auth
  const session = await getSession()
  const rows = await prisma.settings.findMany({ where: { agencyId: auth.agencyId } })
  const map: Record<string, string> = { ...DEFAULTS }
  rows.forEach(r => { map[r.key] = r.value })
  // Expose the tenant id so the client can build the public logo URL
  // (/api/logo/[agencyId]) used in outgoing email HTML.
  map.agencyId = auth.agencyId

  // Claves de PLATAFORMA (CMS, Claude AI, FPL): son GLOBALES, del dueño del CRM.
  // Se resuelven desde su cuenta (o env) para que todas las agencias las hereden,
  // en vez de mostrar el valor —vacío— de la agencia cliente.
  const owner = await isOwner(auth)
  const platform = await getPlatformSettings(PLATFORM_KEYS)
  for (const key of PLATFORM_KEYS) { if (platform[key]) map[key] = platform[key] }
  // La UI usa este flag para mostrar/ocultar las secciones exclusivas del dueño.
  map.__isOwner = owner ? 'true' : 'false'

  if (session.role !== 'admin') {
    // Don't leak secret values to non-admins, but preserve a "is it configured?"
    // signal — e.g. the APTC calculator needs to know if a CMS API key exists
    // without seeing it, to decide whether to show the "add your key" warning.
    for (const key of SECRET_KEYS) {
      map[key] = map[key] ? '••••••••' : ''
    }
  }

  // Aunque sea admin: si NO es el dueño, nunca revelamos las llaves secretas de
  // plataforma (solo un indicador de "configurada" para que la app sepa que la
  // función está activa, sin poder verlas ni copiarlas).
  if (!owner) {
    for (const key of PLATFORM_SECRET_KEYS) {
      map[key] = map[key] ? '••••••••' : ''
    }
  }

  return NextResponse.json(map)
}

export async function PUT(request: NextRequest) {
  const auth = await requireAdmin()
  if (auth instanceof NextResponse) return auth

  const body: Record<string, string> = await request.json()

  // Solo el DUEÑO del CRM puede escribir las claves de plataforma (CMS, Claude
  // AI, FPL). Una agencia cliente no puede fijarlas ni sobrescribirlas — se
  // ignoran silenciosamente aunque las mande en el request.
  const owner = await isOwner(auth)
  const blocked = new Set<string>(owner ? [] : PLATFORM_KEYS)

  // Upsert each key (skip password — handled by change-password endpoint,
  // and el flag interno __isOwner nunca se persiste)
  const entries = Object.entries(body)
    .filter(([k]) => k !== 'passwordHash' && k !== '__isOwner' && !blocked.has(k))
  await Promise.all(entries.map(([key, value]) =>
    prisma.settings.upsert({
      where: { agencyId_key: { agencyId: auth.agencyId, key } },
      update: { value },
      create: { agencyId: auth.agencyId, key, value },
    })
  ))
  return NextResponse.json({ success: true })
}
