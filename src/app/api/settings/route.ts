import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getSession } from '@/lib/session'

// Keys that must never be sent to non-admin users
const SECRET_KEYS = ['cmsApiKey', 'anthropicApiKey', 'smtpUser', 'smtpPass']

// Default values shown when no settings exist yet
const DEFAULTS: Record<string, string> = {
  // Brand colors — must match THEME_DEFAULTS in /api/theme and globals.css
  themeBrand800:          '#053F5C',
  themeBrand500:          '#429EBD',
  themeBrand300:          '#9FE7F5',
  themeAccent:            '#F7AD19',
  agentName:              'Omar Mendoza',
  agentPhone:             '(407)-436-4366',
  agentWhatsApp:          '14074364366',
  anthropicApiKey:        '',
  agentEmail:             '',
  agentLicense:           '',
  healthSherpaConsentUrl: '',
  cmsApiKey:              '',
  fplYear:                '2026',
  fpl1Person:             '15650',
  fplPerPerson:           '5500',
  aptcMaxPct:             '8.5',
  bestPlansRankMode:      'protection',
  birthdayTemplate:       'Hola {nombre}, ¡feliz cumpleaños! 🎂🎉 Que tengas un día muy especial lleno de alegría. Con cariño, {agente}',
  googleReviewLink:       'https://g.page/r/CbFgt44hL28OEAE/review',
  whatsappTemplate:       'Hola {nombre}, fue un placer atenderte. Te agradecería mucho si pudieras dejarnos una reseña en Google, solo toma 1 minuto 🙏: {link}',
  whatsappReminderTemplate: 'Hola {nombre}, quería recordarte que nos encantaría contar con tu reseña en Google: {link} ¡Gracias!',
  defaultPolicyYear:      new Date().getFullYear().toString(),
  defaultRenewalDate:     '11/15',
  defaultExpirationDate:  '12/31',
  wnCommissionPct:        '25',
  emailEnabled:           'false',
  emailFrom:              '',
  emailTo:                '',
  smtpHost:               'smtp.gmail.com',
  smtpPort:               '587',
  smtpUser:               '',
  smtpPass:               '',
}

export async function GET() {
  const session = await getSession()
  const rows = await prisma.settings.findMany()
  const map: Record<string, string> = { ...DEFAULTS }
  rows.forEach(r => { map[r.key] = r.value })

  if (session.role !== 'admin') {
    // Don't leak secret values to non-admins, but preserve a "is it configured?"
    // signal — e.g. the APTC calculator needs to know if a CMS API key exists
    // without seeing it, to decide whether to show the "add your key" warning.
    for (const key of SECRET_KEYS) {
      map[key] = map[key] ? '••••••••' : ''
    }
  }

  return NextResponse.json(map)
}

export async function PUT(request: NextRequest) {
  const session = await getSession()
  if (!session.isLoggedIn || session.role !== 'admin') {
    return NextResponse.json({ error: 'No autorizado' }, { status: 403 })
  }

  const body: Record<string, string> = await request.json()

  // Upsert each key (skip password — handled by change-password endpoint)
  const entries = Object.entries(body).filter(([k]) => k !== 'passwordHash')
  await Promise.all(entries.map(([key, value]) =>
    prisma.settings.upsert({
      where: { key },
      update: { value },
      create: { key, value },
    })
  ))
  return NextResponse.json({ success: true })
}
