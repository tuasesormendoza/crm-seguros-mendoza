'use client'

import { useEffect, useState, useRef } from 'react'

const TEMPLATES = [
  { id: 'welcome', name: 'Carta de Bienvenida', icon: '👋', desc: 'Para enviar al nuevo cliente al confirmar su póliza' },
  { id: 'birthday', name: 'Carta de Cumpleaños', icon: '🎂', desc: 'Felicitación especial para el día del cumpleaños del cliente' },
  { id: 'renewal_reminder', name: 'Carta de Renovación AEP', icon: '🗓️', desc: 'Enviar las primeras 2 semanas de noviembre — avisa que pronto te comunicarás para actualizar su plan' },
  { id: 'first_payment', name: 'Recordatorio Primer Pago', icon: '💳', desc: 'Recordatorio de pago de primera prima' },
  { id: 'wn_intro', name: 'Presentación Washington National', icon: '🛡️', desc: 'Introducción a los beneficios de Washington National' },
  { id: 'farewell', name: 'Carta de Despedida', icon: '🤝', desc: 'Para clientes que continuaron con otro agente — agradecimiento y encuesta de satisfacción' },
]

interface Client {
  id: string; fullName: string; insurer: string | null; planName: string | null; planCategory: string | null
  totalMonthly: number | null; contractDate: string | null; activationDate: string | null; renewalDate: string | null
  policyExpirationDate: string | null
  phone: string | null; email: string | null
  wnPolicies: string | null; acaPrice: number | null; coverageType: string | null
  planNetwork?: string | null; planDeductible?: string | null; planMaxOOP?: string | null
  planPCP?: string | null; planSpecialist?: string | null; planUrgentCare?: string | null
  planHospital?: string | null; planRxGeneric?: string | null
  planXray?: string | null; planCTScan?: string | null; planLab?: string | null
  planReferral?: string | null
}

function fmt(dateStr: string | null | undefined): string {
  if (!dateStr) return '—'
  try {
    const d = new Date(dateStr)
    return `${String(d.getUTCMonth()+1).padStart(2,'0')}/${String(d.getUTCDate()).padStart(2,'0')}/${d.getUTCFullYear()}`
  } catch { return dateStr }
}

function fmtLong(dateStr: string | null | undefined): string {
  if (!dateStr) return '—'
  try {
    const d = new Date(dateStr)
    return new Date(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate())
      .toLocaleDateString('es-US', { year: 'numeric', month: 'long', day: 'numeric' })
  } catch { return dateStr }
}

/** Policy activates on the 1st of the month AFTER the contract date */
/**
 * Policy activates on the 1st of the NEXT month after contractDate.
 * Example: contracted 04/15/2026 → activates 05/01/2026
 */
function getActivationDate(contractDate: string | null): string {
  if (!contractDate) return '—'
  try {
    const d = new Date(contractDate)
    // Use UTC values to avoid timezone shifts
    const utcYear  = d.getUTCFullYear()
    const utcMonth = d.getUTCMonth()  // 0-indexed: April = 3
    // Move to 1st of next month
    const nextMonth = utcMonth + 1        // May = 4
    const activYear = nextMonth > 11 ? utcYear + 1 : utcYear
    const activMonth = nextMonth > 11 ? 0 : nextMonth
    const activation = new Date(activYear, activMonth, 1)
    // Format: May 1, 2026
    return activation.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })
  } catch { return '—' }
}

/**
 * Policy expires 12/31 of the activation year.
 * Example: activates 05/01/2026 → expires 12/31/2026
 */
function getExpirationDate(contractDate: string | null): string {
  if (!contractDate) return '—'
  try {
    const d = new Date(contractDate)
    const utcMonth = d.getUTCMonth()
    const utcYear  = d.getUTCFullYear()
    const activYear = (utcMonth + 1) > 11 ? utcYear + 1 : utcYear
    return `December 31, ${activYear}`
  } catch { return '—' }
}

function generateDoc(templateId: string, client: Client, agent: Record<string, string>, sendDate?: string, appUrl?: string): { html: string; text: string; whatsapp: string } {
  const today = sendDate || new Date().toLocaleDateString('es-US', { year: 'numeric', month: 'long', day: 'numeric' })
  const agentName = agent.agentName || 'Agente'
  const agentPhone = agent.agentPhone || ''
  const agentEmail = agent.agentEmail || ''

  // Logo for email: must be a real, public HTTPS image URL. Gmail and other
  // clients BLOCK inline `data:` base64 images, and Netlify won't serve files
  // written to public/ at runtime — so we point at the public /api/logo/[agencyId]
  // endpoint, which streams the logo bytes stored in the DB. This renders in
  // every email client. We only fall back to base64/raw when there's no agencyId
  // or app origin (e.g. server-side preview without a window).
  const base = appUrl || ''
  // The /api/logo endpoint can only stream what's stored in DB (logoBase64).
  // Prefer it whenever that exists — it's the only source that renders in email.
  const logoUrl = (agent.logoBase64 && agent.agencyId && base)
    ? `${base}/api/logo/${agent.agencyId}`
    : (agent.logoBase64
        ? agent.logoBase64
        : (agent.logoUrl && !agent.logoUrl.startsWith('undefined') ? agent.logoUrl : null))
  const agentNPN = agent.agentLicense || ''
  const header = `<div style="border-bottom:2px solid #10253f;padding-bottom:14px;margin-bottom:20px">
    <div style="display:flex;justify-content:space-between;align-items:center">
      <div>
        ${logoUrl ? `<img src="${logoUrl}" alt="Logo" style="max-height:60px;max-width:220px;object-fit:contain;margin-bottom:4px;display:block">` : ''}
        <div style="font-size:18px;font-weight:bold;color:#10253f">${agentName}</div>
        <div style="font-size:12px;color:#64748b">Agente Autorizado de Seguros de Salud${agentNPN ? ` · NPN: ${agentNPN}` : ''}</div>
      </div>
      <div style="text-align:right;font-size:12px;color:#64748b">
        ${agentPhone ? `📞 ${agentPhone}` : ''}
        ${agentEmail ? `<br>✉️ ${agentEmail}` : ''}
        <br>🌐 www.tuasesormendoza.com
      </div>
    </div>
  </div>`

  const footer = `<div style="margin-top:32px;padding-top:16px;border-top:1px solid #e2e8f0;font-size:12px;color:#94a3b8;text-align:center">Documento generado el ${today} · CRM Agentes de Seguros</div>`

  if (templateId === 'welcome') {
    // Use stored activationDate from client profile (most accurate)
    // Fall back to calculation only if not set
    const activationDate = client.activationDate
      ? fmtLong(client.activationDate)
      : getActivationDate(client.contractDate)

    // Expiration = 12/31 of the activation year
    const activationYear = client.activationDate
      ? new Date(client.activationDate).getUTCFullYear()
      : (() => {
          const d = new Date(client.contractDate || '')
          return (d.getUTCMonth() + 1) > 11 ? d.getUTCFullYear() + 1 : d.getUTCFullYear()
        })()
    const expirationDate = `December 31, ${activationYear}`
    const agentWA = agent.agentWhatsApp || ''
    const waLink  = agentWA ? `https://wa.me/${agentWA}` : ''

    // Build plan benefits rows (only show fields that have data)
    const benefitRows = [
      { label: 'Tipo de Red',              val: client.planNetwork },
      { label: 'Deducible',                val: client.planDeductible },
      { label: 'Máx. de Bolsillo',         val: client.planMaxOOP },
      { label: 'Médico Primario (PCP)',     val: client.planPCP },
      { label: 'Especialista',             val: client.planSpecialist },
      { label: 'Urgent Care',              val: client.planUrgentCare },
      { label: 'Hospitalización',          val: client.planHospital },
      { label: 'Medicamentos Genéricos',   val: client.planRxGeneric },
      { label: 'Rayos X',                  val: client.planXray },
      { label: 'CT / PET / MRI',           val: client.planCTScan },
      { label: 'Laboratorios',             val: client.planLab },
      { label: 'Referido p/ Especialista', val: client.planReferral },
    ].filter(r => r.val)

    const benefitsTable = benefitRows.length > 0 ? `
      <h3 style="color:#10253f;margin:20px 0 10px;font-size:14px;text-transform:uppercase;letter-spacing:.05em;border-bottom:1px solid #e2e8f0;padding-bottom:6px">Resumen de Beneficios</h3>
      <table style="width:100%;border-collapse:collapse;font-size:13px">
        ${benefitRows.map((r, i) => `
          <tr style="background:${i%2===0?'#f8fafc':'#fff'}">
            <td style="padding:7px 10px;color:#64748b;width:50%">${r.label}</td>
            <td style="padding:7px 10px;font-weight:600;color:#0f172a">${r.val}</td>
          </tr>`).join('')}
      </table>` : ''

    const html = `<div style="font-family:Arial,Helvetica,sans-serif;max-width:700px;margin:auto;padding:0;color:#1e293b;line-height:1.75">

      <!-- Gradient header -->
      <div style="background:linear-gradient(135deg,#10253f 0%,#1e4a6e 60%,#0891b2 100%);padding:32px 36px 28px">
        <div style="display:flex;justify-content:space-between;align-items:center">
          <div>
            ${logoUrl ? `<img src="${logoUrl}" alt="Logo" style="max-height:50px;max-width:180px;object-fit:contain;display:block;margin-bottom:6px">` : ''}
            <div style="color:#ffffff;font-size:16px;font-weight:700">${agentName}</div>
            <div style="color:rgba(255,255,255,.65);font-size:11px">Agente Autorizado de Seguros de Salud${agentNPN ? ` · NPN: ${agentNPN}` : ''}</div>
          </div>
          <div style="text-align:right;color:rgba(255,255,255,.6);font-size:12px">${today}</div>
        </div>
      </div>

      <!-- Welcome banner -->
      <div style="background:#f59e0b;padding:10px 36px;text-align:center">
        <p style="margin:0;color:#1c1917;font-size:13px;font-weight:700">
          👋 ¡BIENVENIDO/A A NUESTRA FAMILIA DE CLIENTES! · ${new Date().getFullYear()}
        </p>
      </div>

      <!-- Body -->
      <div style="padding:36px;background:#ffffff">

      <p style="font-size:16px;margin-bottom:8px">Estimado/a <strong style="color:#10253f">${client.fullName}</strong>,</p>

      <p style="font-size:14px">Es un placer darle la <strong>bienvenida</strong> a nuestra familia de clientes. Estamos muy contentos de ser su agencia de seguros de salud y estaremos aquí para apoyarle en cada paso del camino.</p>

      <p>A continuación encontrará los detalles de su póliza de salud contratada:</p>

      <!-- PLAN INFO -->
      <div style="background:#f0f7fb;border:1.5px solid #b8d4e8;border-radius:12px;padding:20px;margin:20px 0">
        <h3 style="color:#10253f;margin:0 0 14px;font-size:15px">📋 Información de su Póliza ACA</h3>
        <table style="width:100%;border-collapse:collapse">
          <tr><td style="padding:7px 0;color:#64748b;width:45%">Aseguradora:</td><td style="padding:7px 0;font-weight:bold;font-size:15px;color:#10253f">${client.insurer || '—'}</td></tr>
          <tr><td style="padding:7px 0;color:#64748b">Nombre del Plan:</td><td style="padding:7px 0;font-weight:bold">${client.planName || '—'}</td></tr>
          <tr><td style="padding:7px 0;color:#64748b">Categoría del Plan:</td><td style="padding:7px 0">${client.planCategory || '—'}${client.coverageType ? ` · ${client.coverageType}` : ''}</td></tr>
          <tr style="background:rgba(5,150,105,.06)">
            <td style="padding:8px 0;color:#064e3b;font-weight:600">💰 Costo Mensual:</td>
            <td style="padding:8px 0;font-weight:bold;font-size:16px;color:#059669">$${client.totalMonthly?.toFixed(2) || '0.00'}/mes</td>
          </tr>
          <tr><td style="padding:7px 0;color:#64748b">📅 Fecha de Activación:</td><td style="padding:7px 0;font-weight:bold;color:#1e40af">${activationDate}</td></tr>
          <tr><td style="padding:7px 0;color:#64748b">📅 Vencimiento de Póliza:</td><td style="padding:7px 0;font-weight:bold">${expirationDate}</td></tr>
        </table>
        ${benefitsTable}
      </div>

      <!-- RENEWAL NOTICE -->
      <div style="background:#fef9c3;border:1.5px solid #fde68a;border-radius:10px;padding:16px;margin:16px 0">
        <p style="margin:0;color:#78350f;font-size:13px">
          🗓️ <strong>Período de Renovación:</strong> Recuerde que el período de renovación (Open Enrollment) comienza el <strong>15 de noviembre</strong> de cada año. Le contactaremos con anticipación para revisar su plan y asegurarnos de tener la mejor cobertura para el siguiente año.
        </p>
      </div>

      <!-- MEDICAL APPOINTMENTS + WHATSAPP -->
      <div style="background:#f0fdf4;border:1.5px solid #a7f3d0;border-radius:10px;padding:16px;margin:16px 0">
        <p style="margin:0 0 10px;color:#065f46;font-size:13px">
          🏥 <strong>Citas Médicas:</strong> Para coordinar una cita con su médico de manera rápida y sencilla, visítenos en:
          <br><br>
          <strong style="font-size:14px">🌐 <a href="https://www.tuasesormendoza.com" style="color:#059669">www.tuasesormendoza.com</a></strong>
          <br><span style="font-size:12px;color:#047857">Sección: <em>Citas Médicas</em></span>
        </p>
        ${waLink ? `
        <div style="margin-top:12px;padding-top:12px;border-top:1px solid #a7f3d0">
          <p style="margin:0;color:#065f46;font-size:13px">
            💬 <strong>WhatsApp:</strong> También puede contactarme directamente por WhatsApp para cualquier pregunta sobre su cobertura:
            <br><br>
            <a href="${waLink}" style="display:inline-block;background:#25d366;color:white;padding:8px 18px;border-radius:8px;text-decoration:none;font-weight:bold;font-size:13px">
              💬 Enviar mensaje por WhatsApp
            </a>
            ${agentPhone ? `<span style="font-size:12px;color:#047857;margin-left:10px">${agentPhone}</span>` : ''}
          </p>
        </div>` : ''}
      </div>

      <p>Si tiene alguna pregunta sobre su cobertura, necesita ayuda para encontrar un médico en su red, o simplemente desea hablar sobre su plan, no dude en contactarme directamente. Estoy aquí para servirle.</p>

      <div style="margin-top:28px">
        <p style="margin:0">Cordialmente,</p>
        <p style="margin:8px 0 2px;font-size:16px;font-weight:bold;color:#10253f">${agentName}</p>
        <p style="margin:0;font-size:12px;color:#64748b">Agente Autorizado de Seguros de Salud${agentNPN ? ` · NPN: ${agentNPN}` : ''}</p>
        ${agentPhone ? `<p style="margin:4px 0;font-size:13px">📞 ${agentPhone}</p>` : ''}
        ${waLink ? `<p style="margin:4px 0;font-size:13px">💬 <a href="${waLink}" style="color:#25d366;font-weight:bold">WhatsApp</a>${agentPhone ? ` · ${agentPhone}` : ''}</p>` : ''}
        ${agentEmail ? `<p style="margin:4px 0;font-size:13px">✉️ ${agentEmail}</p>` : ''}
        <p style="margin:4px 0;font-size:13px">🌐 <a href="https://www.tuasesormendoza.com" style="color:#2a6496">www.tuasesormendoza.com</a></p>
      </div>

      </div><!-- end body -->

      <!-- Footer -->
      <div style="background:#10253f;padding:14px 36px;text-align:center">
        <p style="color:rgba(255,255,255,.45);font-size:11px;margin:0">
          CRM Agentes de Seguros · ${today} · Documento de carácter informativo.
        </p>
      </div>
    </div>`

    const benefitsList = benefitRows.map(r => `• ${r.label}: ${r.val}`).join('\n')
    const text = `Estimado/a ${client.fullName},

Es un placer darle la bienvenida a nuestra agencia de seguros de salud.

DATOS DE SU PÓLIZA:
━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Aseguradora: ${client.insurer || '—'}
Plan: ${client.planName || '—'}
Categoría: ${client.planCategory || '—'}
Costo Mensual: $${client.totalMonthly?.toFixed(2) || '0.00'}/mes
Activación: ${activationDate}
Vencimiento: ${expirationDate}
${benefitsList ? `\nBENEFICIOS:\n${benefitsList}` : ''}

RENOVACIÓN: El período de renovación (Open Enrollment) comienza el 15 de noviembre.

CITAS MÉDICAS: www.tuasesormendoza.com > Sección "Citas Médicas"

CONTACTO:
${agentName}${agentPhone ? `\n📞 ${agentPhone}` : ''}${waLink ? `\n💬 WhatsApp: ${waLink}` : ''}${agentEmail ? `\n✉️ ${agentEmail}` : ''}
🌐 www.tuasesormendoza.com`

    const whatsapp = `👋 *¡Bienvenido/a ${client.fullName.split(' ')[0]}!*

Es un placer tenerle como cliente. Aquí el resumen de su póliza:

🏥 *Aseguradora:* ${client.insurer || '—'}
📋 *Plan:* ${client.planName || '—'} (${client.planCategory || '—'})
💰 *Costo mensual:* $${client.totalMonthly?.toFixed(2) || '0.00'}
📅 *Activación:* ${activationDate}
📅 *Vence:* ${expirationDate}
${client.planDeductible ? `\n🔹 *Deducible:* ${client.planDeductible}` : ''}${client.planPCP ? `\n🔹 *Médico PCP:* ${client.planPCP}` : ''}${client.planSpecialist ? `\n🔹 *Especialista:* ${client.planSpecialist}` : ''}

🗓️ *Renovación:* El Open Enrollment inicia el 15 de noviembre.

🏥 *Citas médicas:* www.tuasesormendoza.com > Citas Médicas

📞 *Contáctame cuando lo necesites:*
${agentPhone ? `• Llamada/WhatsApp: ${agentPhone}` : ''}${waLink ? `\n• WhatsApp directo: ${waLink}` : ''}
• Web: www.tuasesormendoza.com

Estoy aquí para servirle. 🙏 - *${agentName}*`

    return { html, text, whatsapp }
  }

  if (templateId === 'birthday') {
    const firstName = client.fullName.split(' ')[0]
    const agentWA = agent.agentWhatsApp || ''
    const waLink = agentWA ? `https://wa.me/${agentWA}` : ''

    const html = `<div style="font-family:Arial,Helvetica,sans-serif;max-width:680px;margin:auto;padding:0;color:#1e293b;line-height:1.75">

      <!-- Decorative header banner -->
      <div style="background:linear-gradient(135deg,#10253f 0%,#1e4a6e 50%,#0891b2 100%);padding:40px 36px 32px;text-align:center;position:relative;overflow:hidden">
        <div style="font-size:52px;margin-bottom:10px;letter-spacing:4px">🎂 🎉 🎈</div>
        <h1 style="color:#ffffff;font-size:28px;font-weight:900;margin:0 0 6px;letter-spacing:-0.5px">¡Feliz Cumpleaños!</h1>
        <p style="color:rgba(255,255,255,.75);font-size:14px;margin:0">Un día muy especial merece una felicitación muy especial</p>
      </div>

      <!-- Body -->
      <div style="padding:36px;background:#ffffff">

        <!-- Agent header (small) -->
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:28px;padding-bottom:16px;border-bottom:1px solid #e2e8f0">
          <div>
            ${logoUrl ? `<img src="${logoUrl}" alt="Logo" style="max-height:44px;max-width:160px;object-fit:contain;display:block;margin-bottom:4px">` : ''}
            <div style="font-size:14px;font-weight:700;color:#10253f">${agentName}</div>
            <div style="font-size:11px;color:#94a3b8">Agente de Seguros de Salud</div>
          </div>
          <div style="text-align:right;font-size:12px;color:#64748b">
            ${today}
          </div>
        </div>

        <!-- Greeting -->
        <p style="font-size:17px;margin-bottom:6px">Estimado/a <strong style="color:#10253f">${client.fullName}</strong>,</p>

        <!-- Main message -->
        <div style="background:linear-gradient(135deg,#fdf4ff,#fce7f3);border:1.5px solid #f9a8d4;border-radius:14px;padding:24px 28px;margin:20px 0;text-align:center">
          <p style="font-size:22px;font-weight:800;color:#9d174d;margin:0 0 10px;line-height:1.3">
            ¡Que este día esté lleno de alegría,<br>amor y momentos inolvidables!
          </p>
          <p style="font-size:15px;color:#be185d;margin:0">🌟 🎊 🌟</p>
        </div>

        <p style="font-size:14px;color:#334155;margin:20px 0">
          En este día tan especial, quiero hacerle llegar mis más sinceras felicitaciones.
          Es un honor para mí poder acompañarle en cada etapa de su vida,
          y hoy más que nunca quiero que sepa que cuenta con todo mi apoyo y dedicación.
        </p>

        <p style="font-size:14px;color:#334155;margin:20px 0">
          Que este nuevo año de vida le traiga salud, bienestar, prosperidad y muchas
          razones para sonreír cada día. Usted se merece todo lo mejor que la vida tiene
          para ofrecer.
        </p>

        <!-- Warm closing -->
        <div style="background:#f0f7fb;border-left:4px solid #0891b2;border-radius:0 10px 10px 0;padding:16px 20px;margin:24px 0">
          <p style="font-size:14px;color:#1e4a6e;margin:0;font-style:italic;line-height:1.8">
            "Que cada vela que apague este año encienda nuevos sueños,
            y que cada deseo pedido se convierta en realidad."
          </p>
        </div>

        <p style="font-size:14px;color:#334155;margin:20px 0">
          Con toda la calidez del mundo, le deseo un cumpleaños maravilloso rodeado
          de las personas que más quiere.
        </p>

        <!-- Signature -->
        <div style="margin-top:32px">
          <p style="margin:0 0 2px;font-size:13px;color:#64748b">Con cariño,</p>
          <p style="margin:6px 0 2px;font-size:17px;font-weight:800;color:#10253f">${agentName}</p>
          <p style="margin:0;font-size:12px;color:#94a3b8">Agente de Seguros de Salud${agentNPN ? ` · NPN: ${agentNPN}` : ''}</p>
          ${agentPhone ? `<p style="margin:4px 0;font-size:13px;color:#475569">📞 ${agentPhone}</p>` : ''}
          ${waLink ? `<p style="margin:4px 0;font-size:13px"><a href="${waLink}" style="color:#25d366;font-weight:700">💬 WhatsApp</a></p>` : ''}
          <p style="margin:4px 0;font-size:13px"><a href="https://www.tuasesormendoza.com" style="color:#2a6496">🌐 www.tuasesormendoza.com</a></p>
        </div>
      </div>

      <!-- Footer banner -->
      <div style="background:#10253f;padding:14px 36px;text-align:center">
        <p style="color:rgba(255,255,255,.5);font-size:11px;margin:0">
          CRM Agentes de Seguros · ${today}
        </p>
      </div>
    </div>`

    const text = `¡Feliz Cumpleaños, ${client.fullName}! 🎂

En este día tan especial, quiero hacerle llegar mis más sinceras felicitaciones.

Que este nuevo año de vida le traiga salud, bienestar, prosperidad y muchas razones para sonreír.

¡Que este día esté lleno de alegría, amor y momentos inolvidables!

Con cariño,
${agentName}${agentPhone ? `\n📞 ${agentPhone}` : ''}${waLink ? `\n💬 WhatsApp: ${waLink}` : ''}
🌐 www.tuasesormendoza.com`

    const whatsapp = `🎂🎉 *¡Feliz Cumpleaños, ${firstName}!* 🎈

Hoy es tu día especial y quería ser uno de los primeros en felicitarte.

✨ *Que este nuevo año de vida te traiga:*
🌟 Salud y bienestar para ti y tu familia
💫 Prosperidad y nuevas oportunidades
❤️ Momentos llenos de alegría y amor

_"Que cada vela que apagues encienda nuevos sueños."_ 🕯️

Ha sido un honor acompañarte y cuidar tu salud. ¡Que lo disfrutes mucho!

Con cariño,
*${agentName}*${agentPhone ? `\n📞 ${agentPhone}` : ''}
🌐 www.tuasesormendoza.com`

    return { html, text, whatsapp }
  }

  if (templateId === 'renewal_reminder') {
    const firstName = client.fullName.split(' ')[0]
    const agentWA = agent.agentWhatsApp || ''
    const waLink = agentWA ? `https://wa.me/${agentWA}` : ''
    const nextYear = new Date().getFullYear() + 1

    const html = `<div style="font-family:Arial,Helvetica,sans-serif;max-width:680px;margin:auto;padding:0;color:#1e293b;line-height:1.8">

      <!-- Header banner -->
      <div style="background:linear-gradient(135deg,#10253f 0%,#1e4a6e 60%,#0891b2 100%);padding:32px 36px 28px">
        <div style="display:flex;justify-content:space-between;align-items:center">
          <div>
            ${logoUrl ? `<img src="${logoUrl}" alt="Logo" style="max-height:50px;max-width:180px;object-fit:contain;display:block;margin-bottom:6px">` : ''}
            <div style="color:#ffffff;font-size:16px;font-weight:700">${agentName}</div>
            <div style="color:rgba(255,255,255,.65);font-size:11px">Agente Autorizado de Seguros de Salud${agentNPN ? ` · NPN: ${agentNPN}` : ''}</div>
          </div>
          <div style="text-align:right;color:rgba(255,255,255,.6);font-size:12px">${today}</div>
        </div>
      </div>

      <!-- AEP banner -->
      <div style="background:#f59e0b;padding:10px 36px;text-align:center">
        <p style="margin:0;color:#1c1917;font-size:13px;font-weight:700">
          📅 PERÍODO DE INSCRIPCIÓN ABIERTA (AEP) · NOVIEMBRE ${new Date().getFullYear()} – ENERO ${nextYear}
        </p>
      </div>

      <!-- Body -->
      <div style="padding:36px;background:#ffffff">

        <p style="font-size:16px;margin-bottom:4px">Estimado/a <strong style="color:#10253f">${client.fullName}</strong>,</p>
        <p style="color:#64748b;font-size:13px;margin-top:0;margin-bottom:24px">${today}</p>

        <p style="font-size:14px;color:#334155">
          Espero que se encuentre muy bien. Me comunico con usted porque se acerca una
          <strong>fecha muy importante para su cobertura de salud</strong>: el Período de
          Inscripción Abierta (AEP) del Mercado de Salud, que comienza el
          <strong style="color:#10253f">1 de noviembre</strong> y se extiende hasta el
          <strong style="color:#10253f">15 de enero de ${nextYear}</strong>.
        </p>

        <!-- Info boxes -->
        <div style="background:#f0f7fb;border:1.5px solid #b8d4e8;border-radius:12px;padding:20px 24px;margin:20px 0">
          <h3 style="color:#10253f;font-size:15px;margin:0 0 12px;font-weight:700">
            📌 ¿Qué significa esto para usted?
          </h3>
          <ul style="margin:0;padding-left:20px;color:#334155;font-size:14px">
            <li style="margin-bottom:8px">Su póliza actual <strong>vence el 31 de diciembre de ${new Date().getFullYear()}</strong>. Para continuar con cobertura en ${nextYear}, es necesario renovar o aplicar a un nuevo plan.</li>
            <li style="margin-bottom:8px">Este es el <strong>único período del año</strong> en que puede cambiar, actualizar o renovar su plan de salud sin necesitar un evento calificativo.</li>
            <li style="margin-bottom:8px">Pueden existir <strong>nuevos planes disponibles</strong> con mejores beneficios o precios más convenientes para ${nextYear}.</li>
          </ul>
        </div>

        <!-- What to expect -->
        <div style="background:#f0fdf4;border:1.5px solid #a7f3d0;border-radius:12px;padding:20px 24px;margin:20px 0">
          <h3 style="color:#065f46;font-size:15px;margin:0 0 12px;font-weight:700">
            📞 ¿Qué sigue? — Me pondré en contacto con usted
          </h3>
          <p style="color:#064e3b;font-size:14px;margin:0 0 10px">
            En los próximos días estaré comunicándome personalmente para:
          </p>
          <ul style="margin:0;padding-left:20px;color:#065f46;font-size:14px">
            <li style="margin-bottom:8px">✅ <strong>Revisar sus datos actuales</strong> — ingresos, composición familiar, médicos preferidos</li>
            <li style="margin-bottom:8px">✅ <strong>Comparar las opciones disponibles</strong> para ${nextYear} y encontrar el mejor plan para su situación</li>
            <li style="margin-bottom:8px">✅ <strong>Completar la aplicación</strong> a tiempo para que su cobertura inicie el 1 de enero de ${nextYear}</li>
          </ul>
        </div>

        <!-- Current plan reminder -->
        <div style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:10px;padding:16px 20px;margin:20px 0">
          <p style="color:#64748b;font-size:12px;font-weight:700;text-transform:uppercase;letter-spacing:.05em;margin:0 0 8px">Su plan actual (${new Date().getFullYear()})</p>
          <table style="width:100%;border-collapse:collapse;font-size:13px">
            <tr><td style="padding:4px 0;color:#94a3b8;width:45%">Aseguradora:</td><td style="padding:4px 0;font-weight:600;color:#0f172a">${client.insurer || '—'}</td></tr>
            <tr><td style="padding:4px 0;color:#94a3b8">Plan:</td><td style="padding:4px 0;color:#334155">${client.planName || '—'}</td></tr>
            <tr><td style="padding:4px 0;color:#94a3b8">Prima mensual:</td><td style="padding:4px 0;font-weight:700;color:#059669">$${client.totalMonthly?.toFixed(2) || '0.00'}/mes</td></tr>
          </table>
        </div>

        <!-- Action prompt -->
        <p style="font-size:14px;color:#334155;margin:20px 0">
          Si desea adelantarse y programar nuestra cita de revisión, puede contactarme
          directamente por cualquiera de los siguientes medios. Estoy a su entera disposición.
        </p>

        <!-- Contact buttons -->
        <div style="margin:24px 0;display:flex;gap:12px;flex-wrap:wrap">
          ${agentPhone ? `<a href="tel:${agentPhone.replace(/\D/g,'')}" style="display:inline-block;background:#10253f;color:#ffffff;padding:10px 20px;border-radius:8px;text-decoration:none;font-weight:700;font-size:13px">📞 Llamar: ${agentPhone}</a>` : ''}
          ${waLink ? `<a href="${waLink}" style="display:inline-block;background:#25d366;color:#ffffff;padding:10px 20px;border-radius:8px;text-decoration:none;font-weight:700;font-size:13px">💬 WhatsApp</a>` : ''}
          <a href="https://www.tuasesormendoza.com" style="display:inline-block;background:#f0f7fb;color:#2a6496;padding:10px 20px;border-radius:8px;text-decoration:none;font-weight:700;font-size:13px;border:1px solid #b8d4e8">🌐 www.tuasesormendoza.com</a>
        </div>

        <p style="font-size:14px;color:#334155;margin:20px 0">
          Agradezco su confianza y me comprometo a encontrar la mejor opción para usted
          y su familia en ${nextYear}. ¡Nos hablamos pronto!
        </p>

        <!-- Signature -->
        <div style="margin-top:28px;padding-top:20px;border-top:1px solid #e2e8f0">
          <p style="margin:0 0 2px;font-size:13px;color:#64748b">Cordialmente,</p>
          <p style="margin:6px 0 2px;font-size:17px;font-weight:800;color:#10253f">${agentName}</p>
          <p style="margin:0;font-size:12px;color:#94a3b8">Agente Autorizado de Seguros de Salud${agentNPN ? ` · NPN: ${agentNPN}` : ''}</p>
          ${agentPhone ? `<p style="margin:4px 0;font-size:13px">📞 ${agentPhone}</p>` : ''}
          ${agentEmail ? `<p style="margin:4px 0;font-size:13px">✉️ ${agentEmail}</p>` : ''}
          ${waLink ? `<p style="margin:4px 0;font-size:13px"><a href="${waLink}" style="color:#25d366;font-weight:700">💬 WhatsApp</a></p>` : ''}
          <p style="margin:4px 0;font-size:13px"><a href="https://www.tuasesormendoza.com" style="color:#2a6496">🌐 www.tuasesormendoza.com</a></p>
        </div>
      </div>

      <!-- Footer -->
      <div style="background:#10253f;padding:14px 36px;text-align:center">
        <p style="color:rgba(255,255,255,.45);font-size:11px;margin:0">
          CRM Agentes de Seguros · ${today} · Este mensaje es de carácter informativo y no constituye una oferta formal de cobertura.
        </p>
      </div>
    </div>`

    const text = `Estimado/a ${client.fullName},

El Período de Inscripción Abierta (AEP) se acerca — ${new Date().getFullYear()} – ${nextYear}.

Su póliza actual vence el 31 de diciembre de ${new Date().getFullYear()}.

En los próximos días me pondré en contacto con usted para:
✅ Revisar sus datos actuales
✅ Comparar las opciones disponibles para ${nextYear}
✅ Completar la aplicación a tiempo

Su plan actual (${new Date().getFullYear()}):
• Aseguradora: ${client.insurer || '—'}
• Plan: ${client.planName || '—'}
• Prima mensual: $${client.totalMonthly?.toFixed(2) || '0.00'}/mes

Para adelantarse y agendar nuestra cita, contácteme:
${agentName}${agentPhone ? `\n📞 ${agentPhone}` : ''}${waLink ? `\n💬 WhatsApp: ${waLink}` : ''}
🌐 www.tuasesormendoza.com

¡Nos hablamos pronto!
${agentName}`

    const whatsapp = `📅 *Aviso Importante — Renovación de su Seguro de Salud ${nextYear}*

Hola ${firstName}, espero que esté muy bien.

Me comunico porque se acerca el *Período de Inscripción Abierta (AEP)* del Mercado de Salud:

📆 *Del 1 de noviembre al 15 de enero de ${nextYear}*

Su póliza actual vence el *31 de diciembre de ${new Date().getFullYear()}*, por lo que es importante actuar a tiempo.

En los próximos días me pondré en contacto para:
✅ Revisar sus datos actualizados
✅ Comparar los nuevos planes disponibles para ${nextYear}
✅ Completar su aplicación antes de la fecha límite

Si desea adelantarse, puede contactarme:
📞 ${agentPhone || 'Ver datos de contacto'}${waLink ? `\n💬 WhatsApp: ${waLink}` : ''}
🌐 www.tuasesormendoza.com

¡Estoy aquí para ayudarle a encontrar el mejor plan para ${nextYear}!

— *${agentName}*`

    return { html, text, whatsapp }
  }

  if (templateId === 'first_payment') {
    const html = `<div style="font-family:Georgia,serif;max-width:680px;margin:auto;padding:32px;color:#1e293b;line-height:1.7">
      ${header}
      <p style="text-align:right;color:#64748b;font-size:13px">${today}</p>
      <p>Estimado/a <strong>${client.fullName}</strong>,</p>
      <p>Le informamos que para activar su cobertura de salud es necesario confirmar el pago de su primera prima. Los detalles de su plan son:</p>
      <div style="background:#fef2f2;border:1px solid #fca5a5;border-radius:10px;padding:20px;margin:20px 0">
        <table style="width:100%;border-collapse:collapse">
          <tr><td style="padding:6px 0;color:#991b1b;width:160px">Plan:</td><td style="padding:6px 0;font-weight:bold">${client.planName || '—'}</td></tr>
          <tr><td style="padding:6px 0;color:#991b1b">Aseguradora:</td><td style="padding:6px 0">${client.insurer || '—'}</td></tr>
          <tr><td style="padding:6px 0;color:#991b1b">Monto a pagar:</td><td style="padding:6px 0;font-weight:bold;color:#dc2626">$${client.totalMonthly?.toFixed(2) || '0.00'}</td></tr>
          <tr><td style="padding:6px 0;color:#991b1b">Fecha contrato:</td><td style="padding:6px 0">${fmt(client.contractDate)}</td></tr>
        </table>
      </div>
      <p>Si ya realizó el pago, por favor infórmeme para actualizar su registro. Si tiene alguna duda sobre el proceso de pago, estoy a su disposición.</p>
      <p><strong>${agentName}</strong>${agentPhone ? `<br>${agentPhone}` : ''}${agentEmail ? `<br>${agentEmail}` : ''}</p>
      ${footer}
    </div>`
    const text = `Estimado/a ${client.fullName},\n\nLe recordamos que su primera prima de $${client.totalMonthly?.toFixed(2) || '0.00'} para el plan ${client.planName || '—'} (${client.insurer || '—'}) está pendiente.\n\nPara activar su cobertura, realice el pago lo antes posible.\n\n${agentName}${agentPhone ? `\n${agentPhone}` : ''}`
    const whatsapp = `💳 *Recordatorio de Primer Pago*\n\nHola ${client.fullName.split(' ')[0]},\n\nPara activar tu cobertura necesitamos confirmar tu primer pago:\n\n🏥 *Plan:* ${client.planName || '—'} (${client.insurer || '—'})\n💰 *Monto:* $${client.totalMonthly?.toFixed(2) || '0.00'}\n\nSi ya lo pagaste, avísame para actualizarlo. ¡Gracias! - ${agentName}`
    return { html, text, whatsapp }
  }

  if (templateId === 'farewell') {
    const agentWA = agent.agentWhatsApp || ''
    const waLink = agentWA ? `https://wa.me/${agentWA}` : ''

    const surveyUrl = `${appUrl || ''}/encuesta/${client.id}`

    const html = `<div style="font-family:Arial,Helvetica,sans-serif;max-width:700px;margin:auto;padding:0;color:#1e293b;line-height:1.75">

      <!-- Gradient header — igual que carta de bienvenida -->
      <div style="background:linear-gradient(135deg,#10253f 0%,#1e4a6e 60%,#0891b2 100%);padding:32px 36px 28px">
        <div style="display:flex;justify-content:space-between;align-items:center">
          <div>
            ${logoUrl ? `<img src="${logoUrl}" alt="Logo" style="max-height:50px;max-width:180px;object-fit:contain;display:block;margin-bottom:6px">` : ''}
            <div style="color:#ffffff;font-size:16px;font-weight:700">${agentName}</div>
            <div style="color:rgba(255,255,255,.65);font-size:11px">Agente Autorizado de Seguros de Salud${agentNPN ? ` · NPN: ${agentNPN}` : ''}</div>
          </div>
          <div style="text-align:right;color:rgba(255,255,255,.6);font-size:12px">${today}</div>
        </div>
      </div>

      <!-- Banner -->
      <div style="background:#305a72;padding:10px 36px;text-align:center">
        <p style="margin:0;color:#ffffff;font-size:13px;font-weight:700">
          GRACIAS POR HABER CONFIADO EN NOSOTROS · SIEMPRE BIENVENIDO/A DE REGRESO
        </p>
      </div>

      <!-- Body -->
      <div style="padding:36px;background:#ffffff">

        <p style="font-size:16px;margin-bottom:8px">Estimado/a <strong style="color:#10253f">${client.fullName}</strong>,</p>

        <p style="font-size:14px;margin-bottom:14px">
          Ha sido un verdadero privilegio haberle acompañado como su agente de seguros de salud.
          Gracias de corazón por la confianza que depositó en mí y en mi agencia durante este tiempo —
          fue un honor poder servirle y velar por su bienestar.
        </p>

        <p style="font-size:14px;margin-bottom:14px">
          Entiendo perfectamente que ha decidido continuar su camino con otro agente, y lo respeto
          completamente. Lo más importante para mí siempre será que usted y su familia estén bien
          protegidos, sin importar con quién sea.
        </p>

        <p style="font-size:14px;margin-bottom:20px">
          Antes de despedirme, me gustaría pedirle un último favor con mucho respeto:
          <strong style="color:#10253f">¿podría compartir conmigo cómo fue su experiencia trabajando conmigo?</strong>
          Su opinión honesta es un regalo invaluable que me permite crecer y servir mejor a quienes vengan.
        </p>

        <!-- Survey CTA -->
        <div style="background:#f0f7fb;border:1.5px solid #b8d4e8;border-radius:12px;padding:24px;margin:20px 0;text-align:center">
          <p style="color:#10253f;font-size:14px;font-weight:700;margin:0 0 6px">
            ⭐ Encuesta de satisfacción
          </p>
          <p style="color:#64748b;font-size:13px;margin:0 0 18px;line-height:1.6">
            Solo toma un minuto. Califique mi servicio del 1 al 5, indique si me recomendaría
            y deje cualquier comentario que desee compartir.
          </p>
          <a href="${surveyUrl}"
            style="display:inline-block;background:linear-gradient(135deg,#10253f,#0891b2);color:#ffffff;padding:12px 28px;border-radius:10px;text-decoration:none;font-weight:700;font-size:14px">
            Completar encuesta →
          </a>
          <p style="color:#94a3b8;font-size:11px;margin:14px 0 0">Sus respuestas son confidenciales.</p>
        </div>

        <!-- Closing -->
        <p style="font-size:14px;margin-top:20px;color:#475569">
          Recuerde que si en algún momento necesita orientación sobre seguros, desea regresar, o simplemente
          tiene alguna duda, mis puertas siempre estarán abiertas para usted con el mismo cariño de siempre.
          Fue un verdadero gusto conocerle y acompañarle.
        </p>

        <!-- Signature -->
        <div style="margin-top:28px;padding-top:20px;border-top:1px solid #e2e8f0">
          <p style="margin:0 0 2px;font-size:13px;color:#64748b">Cordialmente y con todo el afecto,</p>
          <p style="margin:6px 0 2px;font-size:16px;font-weight:bold;color:#10253f">${agentName}</p>
          <p style="margin:0;font-size:12px;color:#94a3b8">Agente Autorizado de Seguros de Salud${agentNPN ? ` · NPN: ${agentNPN}` : ''}</p>
          ${agentPhone ? `<p style="margin:4px 0;font-size:13px">📞 ${agentPhone}</p>` : ''}
          ${waLink ? `<p style="margin:4px 0;font-size:13px"><a href="${waLink}" style="color:#25d366;font-weight:700">💬 WhatsApp</a>${agentPhone ? ` · ${agentPhone}` : ''}</p>` : ''}
          ${agentEmail ? `<p style="margin:4px 0;font-size:13px">✉️ ${agentEmail}</p>` : ''}
          <p style="margin:4px 0;font-size:13px">🌐 <a href="https://www.tuasesormendoza.com" style="color:#2a6496">www.tuasesormendoza.com</a></p>
        </div>

      </div><!-- end body -->

      <!-- Footer oscuro — igual que bienvenida -->
      <div style="background:#10253f;padding:14px 36px;text-align:center">
        <p style="color:rgba(255,255,255,.45);font-size:11px;margin:0">
          CRM Agentes de Seguros · ${today} · Documento de carácter confidencial.
        </p>
      </div>
    </div>`

    const text = `Estimado/a ${client.fullName},

Ha sido un privilegio acompañarle como su agente de seguros de salud. Gracias de corazón por la confianza que depositó en mí durante este tiempo.

Entiendo que ha decidido continuar con otro agente, y lo respeto completamente. Su bienestar siempre será lo más importante.

Antes de despedirme, le agradecería mucho si pudiera compartir conmigo su experiencia. Solo toma un minuto:

👉 ${surveyUrl}

Recuerde que mis puertas siempre estarán abiertas para usted.

Cordialmente y con todo el afecto,
${agentName}${agentPhone ? `\n📞 ${agentPhone}` : ''}${agentEmail ? `\n✉️ ${agentEmail}` : ''}
🌐 www.tuasesormendoza.com`

    const whatsapp = `🤝 *Un mensaje con todo el cariño, ${client.fullName.split(' ')[0]}*

Quería tomarme un momento para agradecerle de todo corazón por haber confiado en mí como su agente de seguros.

Entiendo que ha decidido continuar con otro agente, y lo respeto completamente. Su bienestar siempre será lo primero.

Me gustaría pedirle un pequeño favor — ¿podría compartirme su opinión sobre mi servicio? Solo toma un minuto:

👉 ${surveyUrl}

_Su respuesta honesta es un regalo invaluable que me ayuda a mejorar._

Recuerde que mis puertas siempre estarán abiertas para usted. ¡Fue un gusto acompañarle!

Con cariño,
*${agentName}*${agentPhone ? `\n📞 ${agentPhone}` : ''}
🌐 www.tuasesormendoza.com`

    return { html, text, whatsapp }
  }

  // wn_intro
  const agentWA_wn = agent.agentWhatsApp || ''
  const waLink_wn = agentWA_wn ? `https://wa.me/${agentWA_wn}` : ''
  const firstName_wn = client.fullName.split(' ')[0]

  const html = `<div style="font-family:Arial,Helvetica,sans-serif;max-width:700px;margin:auto;padding:0;color:#1e293b;line-height:1.75">

    <!-- Gradient header — igual que bienvenida -->
    <div style="background:linear-gradient(135deg,#10253f 0%,#1e4a6e 60%,#0891b2 100%);padding:32px 36px 28px">
      <div style="display:flex;justify-content:space-between;align-items:center">
        <div>
          ${logoUrl ? `<img src="${logoUrl}" alt="Logo" style="max-height:50px;max-width:180px;object-fit:contain;display:block;margin-bottom:6px">` : ''}
          <div style="color:#ffffff;font-size:16px;font-weight:700">${agentName}</div>
          <div style="color:rgba(255,255,255,.65);font-size:11px">Agente Autorizado de Seguros de Salud${agentNPN ? ` · NPN: ${agentNPN}` : ''}</div>
        </div>
        <div style="text-align:right;color:rgba(255,255,255,.6);font-size:12px">${today}</div>
      </div>
    </div>

    <!-- Alert banner -->
    <div style="background:#dc2626;padding:12px 36px;text-align:center">
      <p style="margin:0;color:#ffffff;font-size:13px;font-weight:700;letter-spacing:.02em">
        ⚠️ SU SEGURO MÉDICO TIENE HUECOS — ESTO ES LO QUE NO CUBRE
      </p>
    </div>

    <!-- Body -->
    <div style="padding:36px;background:#ffffff">

      <p style="font-size:16px;margin-bottom:8px">Estimado/a <strong style="color:#10253f">${client.fullName}</strong>,</p>

      <!-- Opening hook: narrative scenario -->
      <p style="font-size:14px;color:#334155;margin-bottom:14px">
        Imagine esto: mañana, yendo al trabajo, sufre un accidente de auto. La ambulancia, la sala de emergencias, los estudios de imagen, los días sin trabajar… Su seguro de salud cubre una parte — pero le deja con miles de dólares de deducibles, copagos y gastos que nadie más va a pagar.
      </p>
      <p style="font-size:14px;color:#334155;margin-bottom:20px">
        <strong style="color:#10253f">Eso es exactamente para lo que existe Washington National.</strong> No es un reemplazo de su plan médico — es el colchón financiero que lo protege cuando el plan médico llega a su límite.
      </p>

      <!-- Stats box — agitation -->
      <div style="background:#fef2f2;border:1.5px solid #fca5a5;border-radius:12px;padding:20px 24px;margin:0 0 20px">
        <p style="color:#991b1b;font-size:12px;font-weight:700;text-transform:uppercase;letter-spacing:.06em;margin:0 0 12px">La realidad que su seguro no le dice</p>
        <div style="display:flex;flex-wrap:wrap;gap:16px">
          <div style="flex:1;min-width:160px;text-align:center;background:#fff;border-radius:10px;padding:14px 10px">
            <div style="font-size:26px;font-weight:900;color:#dc2626">1 de 7</div>
            <div style="font-size:12px;color:#64748b;margin-top:4px">americanos busca atención médica por accidentes cada año</div>
          </div>
          <div style="flex:1;min-width:160px;text-align:center;background:#fff;border-radius:10px;padding:14px 10px">
            <div style="font-size:26px;font-weight:900;color:#dc2626">$1,091</div>
            <div style="font-size:12px;color:#64748b;margin-top:4px">costo promedio de una sola visita a emergencias, sin contar hospitalización</div>
          </div>
          <div style="flex:1;min-width:160px;text-align:center;background:#fff;border-radius:10px;padding:14px 10px">
            <div style="font-size:26px;font-weight:900;color:#dc2626">$100,000</div>
            <div style="font-size:12px;color:#64748b;margin-top:4px">en efectivo que puede recibir ante un diagnóstico de enfermedad crítica</div>
          </div>
        </div>
      </div>

      <!-- Key differentiator -->
      <div style="background:linear-gradient(135deg,#10253f,#1e4a6e);border-radius:12px;padding:20px 24px;margin:0 0 24px;text-align:center">
        <p style="color:#ffffff;font-size:15px;font-weight:700;margin:0 0 6px">💡 La diferencia que lo cambia todo</p>
        <p style="color:rgba(255,255,255,.85);font-size:13px;margin:0;line-height:1.7">
          Con Washington National, el dinero <strong style="color:#38bdf8">va directo a su bolsillo</strong> — no al hospital, no al médico, no a la farmacia. <br>
          Úselo para lo que necesite: renta, comida, deudas, o lo que su familia requiera mientras se recupera.
        </p>
      </div>

      <!-- The 3 pillars -->
      <h2 style="color:#10253f;font-size:15px;font-weight:800;text-transform:uppercase;letter-spacing:.05em;margin:0 0 16px;border-bottom:2px solid #e2e8f0;padding-bottom:8px">
        Los 3 escudos que protegen su economía familiar
      </h2>

      <!-- Pillar 1: Accident -->
      <div style="border:1.5px solid #bfdbfe;border-radius:12px;overflow:hidden;margin-bottom:16px">
        <div style="background:#1e40af;padding:12px 20px;display:flex;align-items:center;gap:10px">
          <span style="font-size:22px">🚑</span>
          <div>
            <div style="color:#ffffff;font-size:14px;font-weight:800">Seguro de Accidentes</div>
            <div style="color:rgba(255,255,255,.7);font-size:11px">Cobertura cuando más inesperado es el golpe</div>
          </div>
        </div>
        <div style="padding:16px 20px;background:#f0f7ff">
          <p style="color:#1e3a8a;font-size:13px;margin:0 0 12px;font-style:italic">
            "Caídas, accidentes de auto, fracturas… ocurren sin avisar, generalmente en el peor momento."
          </p>
          <table style="width:100%;border-collapse:collapse;font-size:13px">
            <tr><td style="padding:5px 0;color:#64748b;width:50%">✅ Visitas a emergencias</td><td style="padding:5px 0;color:#64748b">✅ Fracturas y dislocaciones</td></tr>
            <tr><td style="padding:5px 0;color:#64748b">✅ Hospitalización e ICU</td><td style="padding:5px 0;color:#64748b">✅ Transporte y alojamiento familiar</td></tr>
            <tr><td style="padding:5px 0;color:#64748b">✅ Incapacidad temporal</td><td style="padding:5px 0;color:#64748b">✅ Muerte accidental</td></tr>
          </table>
          <div style="margin-top:12px;padding:10px 14px;background:#dbeafe;border-radius:8px">
            <p style="margin:0;font-size:12px;color:#1e40af;font-weight:600">
              💰 El pago va directo a usted — no importa qué más tenga contratado. Sin papeleo de reclamaciones médicas.
            </p>
          </div>
        </div>
      </div>

      <!-- Pillar 2: Hospital Indemnity -->
      <div style="border:1.5px solid #a7f3d0;border-radius:12px;overflow:hidden;margin-bottom:16px">
        <div style="background:#065f46;padding:12px 20px;display:flex;align-items:center;gap:10px">
          <span style="font-size:22px">🏥</span>
          <div>
            <div style="color:#ffffff;font-size:14px;font-weight:800">Hospitalización (Hospital Indemnity)</div>
            <div style="color:rgba(255,255,255,.7);font-size:11px">Dinero en efectivo por cada día que esté internado</div>
          </div>
        </div>
        <div style="padding:16px 20px;background:#f0fdf4">
          <p style="color:#064e3b;font-size:13px;margin:0 0 12px;font-style:italic">
            "El plan médico cubre la cama — pero ¿quién paga la renta, los víveres y los gastos del hogar mientras usted está internado?"
          </p>
          <table style="width:100%;border-collapse:collapse;font-size:13px">
            <tr><td style="padding:5px 0;color:#64748b;width:50%">✅ Beneficio diario por internamiento</td><td style="padding:5px 0;color:#64748b">✅ Admisiones a UCI</td></tr>
            <tr><td style="padding:5px 0;color:#64748b">✅ Cirugías y procedimientos</td><td style="padding:5px 0;color:#64748b">✅ Convalecencia post-hospitalaria</td></tr>
          </table>
          <div style="margin-top:12px;padding:10px 14px;background:#d1fae5;border-radius:8px">
            <p style="margin:0;font-size:12px;color:#065f46;font-weight:600">
              💰 Se paga POR DÍA de hospitalización — sin importar cuánto cubra su otro seguro. Un complemento real, no un duplicado.
            </p>
          </div>
        </div>
      </div>

      <!-- Pillar 3: Critical Illness -->
      <div style="border:1.5px solid #ddd6fe;border-radius:12px;overflow:hidden;margin-bottom:24px">
        <div style="background:#4c1d95;padding:12px 20px;display:flex;align-items:center;gap:10px">
          <span style="font-size:22px">❤️‍🩹</span>
          <div>
            <div style="color:#ffffff;font-size:14px;font-weight:800">Enfermedad Crítica (Critical Illness)</div>
            <div style="color:rgba(255,255,255,.7);font-size:11px">Un solo diagnóstico puede cambiar todo — prepárese antes</div>
          </div>
        </div>
        <div style="padding:16px 20px;background:#faf5ff">
          <p style="color:#3b0764;font-size:13px;margin:0 0 12px;font-style:italic">
            "El 80% de pacientes con enfermedades graves reporta dificultades financieras severas. El tratamiento salva la vida — pero también puede destruir las finanzas."
          </p>
          <table style="width:100%;border-collapse:collapse;font-size:13px">
            <tr><td style="padding:5px 0;color:#64748b;width:50%">✅ Cáncer</td><td style="padding:5px 0;color:#64748b">✅ Infarto al corazón</td></tr>
            <tr><td style="padding:5px 0;color:#64748b">✅ Derrame cerebral (ACV)</td><td style="padding:5px 0;color:#64748b">✅ Diabetes avanzada</td></tr>
            <tr><td style="padding:5px 0;color:#64748b">✅ Alzheimer</td><td style="padding:5px 0;color:#64748b">✅ Falla renal terminal</td></tr>
          </table>
          <div style="margin-top:12px;padding:10px 14px;background:#ede9fe;border-radius:8px">
            <p style="margin:0;font-size:12px;color:#4c1d95;font-weight:600">
              💰 Hasta $100,000 en efectivo de una sola vez al recibir el diagnóstico — para tratamientos, viajes, pérdida de ingresos, o lo que su familia necesite.
            </p>
          </div>
        </div>
      </div>

      <!-- What it is NOT -->
      <div style="background:#f0f7fb;border:1.5px solid #b8d4e8;border-radius:12px;padding:18px 22px;margin-bottom:24px">
        <p style="color:#10253f;font-size:14px;font-weight:700;margin:0 0 10px">¿Y cuánto cuesta esta tranquilidad?</p>
        <p style="color:#334155;font-size:13px;margin:0 0 10px;line-height:1.7">
          Los planes de Washington National se adaptan a su presupuesto — hay opciones desde unos pocos dólares al mes. Y lo mejor: <strong>pueden ser contratados junto a cualquier plan de salud</strong>, incluyendo su póliza ACA actual. No hay conflicto, no hay exclusiones por tener otro seguro.
        </p>
        <p style="color:#334155;font-size:13px;margin:0">
          Mi trabajo es encontrar la combinación exacta que se ajuste a su situación, familia y presupuesto. <strong style="color:#10253f">Sin compromiso, sin presión — solo información clara.</strong>
        </p>
      </div>

      <!-- CTA -->
      <div style="background:linear-gradient(135deg,#10253f,#0891b2);border-radius:14px;padding:24px;text-align:center;margin-bottom:28px">
        <p style="color:#ffffff;font-size:16px;font-weight:800;margin:0 0 8px">
          ¿Le gustaría conocer cuánto costaría proteger a su familia hoy?
        </p>
        <p style="color:rgba(255,255,255,.8);font-size:13px;margin:0 0 18px">
          Le preparo una cotización personalizada completamente gratis — sin obligación de compra.
        </p>
        <div style="display:flex;gap:10px;justify-content:center;flex-wrap:wrap">
          ${agentPhone ? `<a href="tel:${agentPhone.replace(/\D/g,'')}" style="display:inline-block;background:#ffffff;color:#10253f;padding:10px 22px;border-radius:9px;text-decoration:none;font-weight:800;font-size:13px">📞 Llamar ahora: ${agentPhone}</a>` : ''}
          ${waLink_wn ? `<a href="${waLink_wn}" style="display:inline-block;background:#25d366;color:#ffffff;padding:10px 22px;border-radius:9px;text-decoration:none;font-weight:800;font-size:13px">💬 WhatsApp</a>` : ''}
        </div>
      </div>

      <!-- Signature -->
      <div style="padding-top:20px;border-top:1px solid #e2e8f0">
        <p style="margin:0 0 2px;font-size:13px;color:#64748b">Cordialmente,</p>
        <p style="margin:6px 0 2px;font-size:17px;font-weight:800;color:#10253f">${agentName}</p>
        <p style="margin:0;font-size:12px;color:#94a3b8">Agente Autorizado de Seguros de Salud${agentNPN ? ` · NPN: ${agentNPN}` : ''}</p>
        ${agentPhone ? `<p style="margin:4px 0;font-size:13px">📞 ${agentPhone}</p>` : ''}
        ${waLink_wn ? `<p style="margin:4px 0;font-size:13px"><a href="${waLink_wn}" style="color:#25d366;font-weight:700">💬 WhatsApp</a></p>` : ''}
        ${agentEmail ? `<p style="margin:4px 0;font-size:13px">✉️ ${agentEmail}</p>` : ''}
        <p style="margin:4px 0;font-size:13px">🌐 <a href="https://www.tuasesormendoza.com" style="color:#2a6496">www.tuasesormendoza.com</a></p>
      </div>

    </div><!-- end body -->

    <!-- Footer -->
    <div style="background:#10253f;padding:14px 36px;text-align:center">
      <p style="color:rgba(255,255,255,.45);font-size:11px;margin:0">
        Washington National Insurance Company · Pólizas de beneficios suplementarios · ${today}
      </p>
    </div>
  </div>`

  const text = `Estimado/a ${client.fullName},

¿Sabía que su seguro de salud tiene huecos que nadie le está cubriendo?

LA REALIDAD:
• 1 de cada 7 americanos busca atención médica por accidentes cada año
• Una visita a emergencias cuesta en promedio $1,091 — sin contar hospitalización
• Un diagnóstico de enfermedad crítica puede generar más de $200,000 en gastos directos e indirectos

Washington National ofrece seguros complementarios que pagan DIRECTAMENTE A USTED — sin pasar por médicos ni hospitales.

🚑 SEGURO DE ACCIDENTES
Fracturas, emergencias, hospitalización, transporte, incapacidad temporal. Dinero en su bolsillo cuando más lo necesita.

🏥 HOSPITALIZACIÓN (HOSPITAL INDEMNITY)
Un beneficio en efectivo por cada día que esté internado. Úselo para renta, comida, o lo que su familia necesite.

❤️‍🩹 ENFERMEDAD CRÍTICA
Hasta $100,000 en efectivo de una sola vez al recibir el diagnóstico de cáncer, infarto, ACV, diabetes avanzada, y más.

La mejor parte: estos planes funcionan JUNTO a su seguro ACA actual. No reemplazan nada — complementan todo.

¿Le interesa una cotización personalizada sin compromiso?

${agentName}${agentPhone ? `\n📞 ${agentPhone}` : ''}${waLink_wn ? `\n💬 WhatsApp: ${waLink_wn}` : ''}${agentEmail ? `\n✉️ ${agentEmail}` : ''}
🌐 www.tuasesormendoza.com`

  const whatsapp = `🛡️ *${firstName_wn}, ¿sabe que su seguro médico tiene huecos?*

Quiero compartirle algo importante que puede proteger a su familia sin cambiar su plan actual.

*Washington National* paga directamente a USTED — no al médico, no al hospital. El dinero es suyo para usarlo en lo que necesite.

*Los 3 escudos:*

🚑 *Accidentes* — emergencias, fracturas, hospitalización, incapacidad temporal
🏥 *Hospitalización* — efectivo por cada día internado
❤️‍🩹 *Enfermedad Crítica* — hasta $100,000 de golpe al diagnosticarse cáncer, infarto, ACV y más

📊 *¿Por qué importa?*
• 1 de 7 americanos visita urgencias cada año
• Una emergencia promedio cuesta $1,091 sin incluir hospitalización
• El 80% de pacientes con enfermedades graves enfrenta dificultades financieras severas

✅ Funciona junto a su seguro ACA actual
✅ Desde unos pocos dólares al mes
✅ Cotización gratis, sin compromiso

¿Le gustaría que le prepare una propuesta personalizada para su familia? 🙏

— *${agentName}*${agentPhone ? `\n📞 ${agentPhone}` : ''}${waLink_wn ? `\n💬 ${waLink_wn}` : ''}`

  return { html, text, whatsapp }
}

export default function DocumentosPage() {
  const [clients, setClients] = useState<Client[]>([])
  const [search, setSearch] = useState('')
  const [selectedClient, setSelectedClient] = useState<Client | null>(null)
  const [templateId, setTemplateId] = useState('welcome')
  const [agent, setAgent] = useState<Record<string, string>>({})
  const [copied, setCopied] = useState<'text' | 'whatsapp' | null>(null)
  const [sendDate, setSendDate] = useState('')
  const previewRef = useRef<HTMLDivElement>(null)

  // Email modal state
  const [showEmailModal, setShowEmailModal] = useState(false)
  const [emailTo, setEmailTo] = useState('')
  const [emailSubject, setEmailSubject] = useState('')
  const [emailSending, setEmailSending] = useState(false)
  const [emailResult, setEmailResult] = useState<{ success?: boolean; error?: string } | null>(null)

  useEffect(() => {
    fetch('/api/clients').then(r => r.json()).then(setClients)
    fetch('/api/settings').then(r => r.json()).then(setAgent)
  }, [])

  const filtered = search.length >= 2 ? clients.filter(c => c.fullName.toLowerCase().includes(search.toLowerCase())).slice(0, 10) : []
  const appUrl = typeof window !== 'undefined' ? window.location.origin : ''
  const doc = selectedClient ? generateDoc(templateId, selectedClient, agent, sendDate || undefined, appUrl) : null
  const template = TEMPLATES.find(t => t.id === templateId)!

  async function copyText() {
    if (!doc) return
    await navigator.clipboard.writeText(doc.text)
    setCopied('text'); setTimeout(() => setCopied(null), 2000)
  }

  async function copyWhatsApp() {
    if (!doc) return
    await navigator.clipboard.writeText(doc.whatsapp)
    setCopied('whatsapp'); setTimeout(() => setCopied(null), 2000)
  }

  function print() {
    if (!previewRef.current) return
    const w = window.open('', '_blank')
    if (!w) return
    w.document.write(`<html><head><title>Documento</title><style>body{margin:0;padding:0}@media print{body{margin:0}}</style></head><body>${previewRef.current.innerHTML}</body></html>`)
    w.document.close()
    w.focus()
    w.print()
  }

  async function sendEmail() {
    if (!doc || !selectedClient) return
    setEmailSending(true)
    setEmailResult(null)
    const res = await fetch('/api/documents/send', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        toEmail: emailTo,
        toName: selectedClient.fullName,
        subject: emailSubject,
        html: doc.html,
      }),
    })
    const data = await res.json()
    setEmailSending(false)
    setEmailResult(data)

    // Log activity in client profile when email is sent successfully
    if (data.success) {
      fetch(`/api/clients/${selectedClient.id}/activities`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: 'email',
          content: `📧 Email enviado: "${emailSubject}" → ${emailTo}`,
        }),
      }).catch(() => {})
    }
  }

  return (
    <div className="space-y-5 animate-fade-in">
      <div>
        <h1 className="text-2xl font-bold" style={{ color: '#10253f' }}>📄 Generador de Documentos</h1>
        <p className="text-sm text-gray-500 mt-1">Genera cartas y documentos personalizados para tus clientes</p>
      </div>

      {/* ── Email Modal ── */}
      {showEmailModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-6">
            <h3 className="text-lg font-bold mb-1" style={{ color: '#10253f' }}>📧 Enviar por Email</h3>
            <p className="text-sm text-gray-500 mb-4">
              Se enviará: <strong>{template?.name}</strong> a <strong>{selectedClient?.fullName}</strong>
            </p>

            <div className="space-y-3">
              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1">Email del destinatario</label>
                <input
                  type="email" value={emailTo} onChange={e => setEmailTo(e.target.value)}
                  placeholder="cliente@email.com"
                  className="w-full border border-gray-300 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#2a6496]"
                />
                {!selectedClient?.email && (
                  <p className="text-xs text-amber-600 mt-1">⚠️ Este cliente no tiene email guardado en su perfil</p>
                )}
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1">Asunto</label>
                <input
                  type="text" value={emailSubject} onChange={e => setEmailSubject(e.target.value)}
                  className="w-full border border-gray-300 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#2a6496]"
                />
              </div>

              {/* Result */}
              {emailResult?.success && (
                <div className="flex items-center gap-2 px-3 py-2.5 rounded-xl text-sm font-semibold"
                  style={{ background: '#d1fae5', color: '#065f46' }}>
                  ✅ Email enviado correctamente a {emailTo}
                </div>
              )}
              {emailResult?.error && (
                <div className="px-3 py-2.5 rounded-xl text-sm" style={{ background: '#fee2e2', color: '#dc2626' }}>
                  ⚠️ {emailResult.error}
                  {emailResult.error.includes('SMTP') && (
                    <a href="/settings" className="block mt-1 text-xs underline font-semibold">
                      Ir a Configuración → Notificaciones por Email →
                    </a>
                  )}
                </div>
              )}
            </div>

            <div className="flex gap-2 mt-5">
              {!emailResult?.success ? (
                <button onClick={sendEmail} disabled={emailSending || !emailTo || !emailSubject}
                  className="flex-1 py-2.5 rounded-xl text-sm font-bold text-white disabled:opacity-50"
                  style={{ background: emailSending ? '#64748b' : 'linear-gradient(135deg, #2a6496, #0891b2)' }}>
                  {emailSending ? '⏳ Enviando...' : '📧 Enviar email'}
                </button>
              ) : (
                <button onClick={() => { setShowEmailModal(false); setEmailResult(null) }}
                  className="flex-1 py-2.5 rounded-xl text-sm font-bold text-white"
                  style={{ background: '#059669' }}>
                  ✓ Cerrar
                </button>
              )}
              {!emailResult?.success && (
                <button onClick={() => { setShowEmailModal(false); setEmailResult(null) }}
                  className="px-5 py-2.5 rounded-xl text-sm border border-gray-200 text-gray-600">
                  Cancelar
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      <div className="flex gap-5 items-start flex-col lg:flex-row">
        {/* Left panel */}
        <div className="w-full lg:w-80 shrink-0 space-y-4">
          {/* Client selector */}
          <div className="bg-white rounded-xl border border-gray-200 p-5">
            <h3 className="font-semibold text-sm mb-3" style={{ color: '#10253f' }}>1. Selecciona el cliente</h3>
            <div className="relative">
              <input
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#0891b2]"
                placeholder="Buscar cliente..."
                value={selectedClient ? selectedClient.fullName : search}
                onChange={e => { setSearch(e.target.value); if (selectedClient) setSelectedClient(null) }}
              />
              {filtered.length > 0 && !selectedClient && (
                <div className="absolute top-full left-0 right-0 mt-1 bg-white rounded-lg border border-gray-200 shadow-lg z-20 overflow-hidden max-h-52 overflow-y-auto">
                  {filtered.map(c => (
                    <button key={c.id} onClick={() => { setSelectedClient(c); setSearch('') }}
                      className="w-full px-3 py-2.5 text-left hover:bg-gray-50 transition-colors border-b border-gray-100">
                      <div className="text-sm font-medium" style={{ color: '#0f172a' }}>{c.fullName}</div>
                      <div className="text-xs text-gray-500">{c.insurer || '—'} · {c.planName || '—'}</div>
                    </button>
                  ))}
                </div>
              )}
            </div>
            {selectedClient && (
              <div className="mt-3 p-3 rounded-lg" style={{ background: '#f0f9ff', border: '1px solid #bae6fd' }}>
                <div className="text-sm font-semibold" style={{ color: '#0369a1' }}>{selectedClient.fullName}</div>
                <div className="text-xs text-gray-500 mt-0.5">{selectedClient.insurer} · {selectedClient.planName}</div>
                <button onClick={() => { setSelectedClient(null); setSearch('') }}
                  className="text-xs mt-2" style={{ color: '#dc2626' }}>✕ Cambiar cliente</button>
              </div>
            )}
          </div>

          {/* Template selector */}
          <div className="bg-white rounded-xl border border-gray-200 p-5">
            <h3 className="font-semibold text-sm mb-3" style={{ color: '#10253f' }}>2. Elige el documento</h3>
            <div className="space-y-2">
              {TEMPLATES.map(t => (
                <button key={t.id} onClick={() => setTemplateId(t.id)}
                  className="w-full text-left px-3 py-3 rounded-lg border transition-all"
                  style={templateId === t.id
                    ? { background: '#f0f9ff', border: '1.5px solid #0891b2', color: '#0369a1' }
                    : { background: '#f8fafc', border: '1px solid #e2e8f0', color: '#475569' }}>
                  <div className="flex items-center gap-2">
                    <span className="text-base">{t.icon}</span>
                    <div>
                      <div className="text-xs font-semibold">{t.name}</div>
                      <div className="text-xs mt-0.5 opacity-70">{t.desc}</div>
                    </div>
                  </div>
                </button>
              ))}
            </div>
          </div>

          {/* Extra fields */}
          <div className="bg-white rounded-xl border border-gray-200 p-5">
            <h3 className="font-semibold text-sm mb-3" style={{ color: '#10253f' }}>3. Opciones adicionales</h3>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Fecha del documento</label>
              <input type="date" className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#0891b2]"
                value={sendDate} onChange={e => setSendDate(e.target.value)} />
              <p className="text-xs text-gray-400 mt-1">Deja vacío para usar la fecha actual</p>
            </div>
          </div>
        </div>

        {/* Right panel: preview */}
        <div className="flex-1 min-w-0">
          {!selectedClient ? (
            <div className="bg-white rounded-xl border border-gray-200 p-12 text-center">
              <div className="text-4xl mb-3">📄</div>
              <div className="font-semibold text-gray-600">Selecciona un cliente para generar el documento</div>
              <div className="text-sm text-gray-400 mt-1">Elige el cliente y el tipo de documento en el panel izquierdo</div>
            </div>
          ) : (
            <div className="space-y-3">
              {/* Actions bar */}
              <div className="bg-white rounded-xl border border-gray-200 px-4 py-3 flex items-center gap-3 flex-wrap">
                <div className="flex items-center gap-2 flex-1 min-w-0">
                  <span className="text-lg">{template.icon}</span>
                  <div className="min-w-0">
                    <div className="text-sm font-semibold truncate" style={{ color: '#10253f' }}>{template.name}</div>
                    <div className="text-xs text-gray-500 truncate">{selectedClient.fullName}</div>
                  </div>
                </div>
                <div className="flex items-center gap-2 shrink-0 flex-wrap">
                  <button onClick={print}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold border transition-all hover:bg-gray-50"
                    style={{ border: '1px solid #cbd5e1', color: '#334155' }}>
                    🖨️ Imprimir
                  </button>
                  <button onClick={() => {
                    setEmailTo(selectedClient.email || '')
                    setEmailSubject(`${template.name} — ${selectedClient.fullName}`)
                    setEmailResult(null)
                    setShowEmailModal(true)
                  }}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold text-white transition-all hover:opacity-90"
                    style={{ background: '#2a6496' }}>
                    📧 Enviar por Email
                  </button>
                  <button onClick={copyText}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all"
                    style={{ background: copied === 'text' ? '#d1fae5' : '#f1f5f9', color: copied === 'text' ? '#065f46' : '#334155' }}>
                    {copied === 'text' ? '✓ Copiado' : '📋 Copiar texto'}
                  </button>
                  <button onClick={copyWhatsApp}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold text-white transition-all"
                    style={{ background: copied === 'whatsapp' ? '#059669' : '#25d366' }}>
                    {copied === 'whatsapp' ? '✓ Copiado' : '💬 WhatsApp'}
                  </button>
                </div>
              </div>

              {/* Document preview */}
              <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
                <div ref={previewRef} dangerouslySetInnerHTML={{ __html: doc?.html || '' }}
                  className="p-2" style={{ minHeight: 400 }} />
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
