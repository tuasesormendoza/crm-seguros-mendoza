// Plantillas de documentos para clientes: catálogo (TEMPLATES) y generador
// (generateDoc) que produce el HTML para email, texto plano y versión WhatsApp.
// Lógica pura sin React — extraída de la página de Documentos.

export const TEMPLATES = [
  { id: 'welcome', name: 'Carta de Bienvenida', icon: '👋', desc: 'Para enviar al nuevo cliente al confirmar su póliza' },
  { id: 'birthday', name: 'Carta de Cumpleaños', icon: '🎂', desc: 'Felicitación especial para el día del cumpleaños del cliente' },
  { id: 'renewal_reminder', name: 'Carta de Renovación AEP', icon: '🗓️', desc: 'Enviar las primeras 2 semanas de noviembre — avisa que pronto te comunicarás para actualizar su plan' },
  { id: 'first_payment', name: 'Recordatorio Primer Pago', icon: '💳', desc: 'Recordatorio de pago de primera prima' },
  { id: 'wn_intro', name: 'Presentación Washington National', icon: '🛡️', desc: 'Introducción a los beneficios de Washington National' },
  { id: 'farewell', name: 'Carta de Despedida', icon: '🤝', desc: 'Para clientes que continuaron con otro agente — agradecimiento y encuesta de satisfacción' },
  { id: 'employer_coverage', name: 'Carta — Seguro por Trabajo', icon: '💼', desc: 'Para clientes que se van porque su trabajo les da seguro — felicitación, aviso de cancelar el Marketplace y encuesta' },
]

export interface Client {
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

export function generateDoc(templateId: string, client: Client, agent: Record<string, string>, sendDate?: string, appUrl?: string): { html: string; text: string; whatsapp: string } {
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

  // La página web sale de la Configuración de la agencia ("Tarjeta de Plan →
  // Página web"). Si no la ha puesto, la línea se OMITE entera: mandar a sus
  // clientes al sitio de otra agencia es peor que no poner nada.
  const website = (agent.cardWebsite || '').trim().replace(/^https?:\/\//, '').replace(/\/+$/, '')
  const websiteUrl = website ? `https://${website}` : ''
  /** Línea de web para los pies HTML; vacía si la agencia no tiene web. */
  const webLine = (color = '#2a6496') => website
    ? `<p style="margin:4px 0;font-size:13px">🌐 <a href="${websiteUrl}" style="color:${color}">${website}</a></p>`
    : ''
  /** Igual, para texto plano y WhatsApp. Ya trae el salto de línea delante. */
  const webText = website ? `\n🌐 ${website}` : ''

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
        ${website ? `<br>🌐 ${website}` : ''}
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

      <!-- MEDICAL APPOINTMENTS + WHATSAPP — sin web ni WhatsApp la caja entera sobra -->
      ${website || waLink ? `<div style="background:#f0fdf4;border:1.5px solid #a7f3d0;border-radius:10px;padding:16px;margin:16px 0">
        ${website ? `<p style="margin:0 0 10px;color:#065f46;font-size:13px">
          🏥 <strong>Citas Médicas:</strong> Para coordinar una cita con su médico de manera rápida y sencilla, visítenos en:
          <br><br>
          <strong style="font-size:14px">🌐 <a href="${websiteUrl}" style="color:#059669">${website}</a></strong>
          <br><span style="font-size:12px;color:#047857">Sección: <em>Citas Médicas</em></span>
        </p>` : ''}
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
      </div>` : ''}

      <p>Si tiene alguna pregunta sobre su cobertura, necesita ayuda para encontrar un médico en su red, o simplemente desea hablar sobre su plan, no dude en contactarme directamente. Estoy aquí para servirle.</p>

      <div style="margin-top:28px">
        <p style="margin:0">Cordialmente,</p>
        <p style="margin:8px 0 2px;font-size:16px;font-weight:bold;color:#10253f">${agentName}</p>
        <p style="margin:0;font-size:12px;color:#64748b">Agente Autorizado de Seguros de Salud${agentNPN ? ` · NPN: ${agentNPN}` : ''}</p>
        ${agentPhone ? `<p style="margin:4px 0;font-size:13px">📞 ${agentPhone}</p>` : ''}
        ${waLink ? `<p style="margin:4px 0;font-size:13px">💬 <a href="${waLink}" style="color:#25d366;font-weight:bold">WhatsApp</a>${agentPhone ? ` · ${agentPhone}` : ''}</p>` : ''}
        ${agentEmail ? `<p style="margin:4px 0;font-size:13px">✉️ ${agentEmail}</p>` : ''}
        ${webLine()}
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

${website ? `CITAS MÉDICAS: ${website} > Sección "Citas Médicas"` : ''}

CONTACTO:
${agentName}${agentPhone ? `\n📞 ${agentPhone}` : ''}${waLink ? `\n💬 WhatsApp: ${waLink}` : ''}${agentEmail ? `\n✉️ ${agentEmail}` : ''}${webText}`

    const whatsapp = `👋 *¡Bienvenido/a ${client.fullName.split(' ')[0]}!*

Es un placer tenerle como cliente. Aquí el resumen de su póliza:

🏥 *Aseguradora:* ${client.insurer || '—'}
📋 *Plan:* ${client.planName || '—'} (${client.planCategory || '—'})
💰 *Costo mensual:* $${client.totalMonthly?.toFixed(2) || '0.00'}
📅 *Activación:* ${activationDate}
📅 *Vence:* ${expirationDate}
${client.planDeductible ? `\n🔹 *Deducible:* ${client.planDeductible}` : ''}${client.planPCP ? `\n🔹 *Médico PCP:* ${client.planPCP}` : ''}${client.planSpecialist ? `\n🔹 *Especialista:* ${client.planSpecialist}` : ''}

🗓️ *Renovación:* El Open Enrollment inicia el 15 de noviembre.

${website ? `🏥 *Citas médicas:* ${website} > Citas Médicas` : ''}

📞 *Contáctame cuando lo necesites:*
${agentPhone ? `• Llamada/WhatsApp: ${agentPhone}` : ''}${waLink ? `\n• WhatsApp directo: ${waLink}` : ''}${website ? `
• Web: ${website}` : ''}

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
          ${webLine()}
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
${agentName}${agentPhone ? `\n📞 ${agentPhone}` : ''}${waLink ? `\n💬 WhatsApp: ${waLink}` : ''}${webText}`

    const whatsapp = `🎂🎉 *¡Feliz Cumpleaños, ${firstName}!* 🎈

Hoy es tu día especial y quería ser uno de los primeros en felicitarte.

✨ *Que este nuevo año de vida te traiga:*
🌟 Salud y bienestar para ti y tu familia
💫 Prosperidad y nuevas oportunidades
❤️ Momentos llenos de alegría y amor

_"Que cada vela que apagues encienda nuevos sueños."_ 🕯️

Ha sido un honor acompañarte y cuidar tu salud. ¡Que lo disfrutes mucho!

Con cariño,
*${agentName}*${agentPhone ? `\n📞 ${agentPhone}` : ''}${webText}`

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
          ${website ? `<a href="${websiteUrl}" style="display:inline-block;background:#f0f7fb;color:#2a6496;padding:10px 20px;border-radius:8px;text-decoration:none;font-weight:700;font-size:13px;border:1px solid #b8d4e8">🌐 ${website}</a>` : ''}
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
          ${webLine()}
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
${agentName}${agentPhone ? `\n📞 ${agentPhone}` : ''}${waLink ? `\n💬 WhatsApp: ${waLink}` : ''}${webText}

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
📞 ${agentPhone || 'Ver datos de contacto'}${waLink ? `\n💬 WhatsApp: ${waLink}` : ''}${webText}

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
          ${webLine()}
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
${agentName}${agentPhone ? `\n📞 ${agentPhone}` : ''}${agentEmail ? `\n✉️ ${agentEmail}` : ''}${webText}`

    const whatsapp = `🤝 *Un mensaje con todo el cariño, ${client.fullName.split(' ')[0]}*

Quería tomarme un momento para agradecerle de todo corazón por haber confiado en mí como su agente de seguros.

Entiendo que ha decidido continuar con otro agente, y lo respeto completamente. Su bienestar siempre será lo primero.

Me gustaría pedirle un pequeño favor — ¿podría compartirme su opinión sobre mi servicio? Solo toma un minuto:

👉 ${surveyUrl}

_Su respuesta honesta es un regalo invaluable que me ayuda a mejorar._

Recuerde que mis puertas siempre estarán abiertas para usted. ¡Fue un gusto acompañarle!

Con cariño,
*${agentName}*${agentPhone ? `\n📞 ${agentPhone}` : ''}${webText}`

    return { html, text, whatsapp }
  }

  // ── Carta para clientes que se van con el seguro de su TRABAJO ─────────────
  // Mismo diseño que la carta de despedida, pero en tono de felicitación y con
  // el aviso clave: cancelar el plan del Mercado para no tener que devolver el
  // crédito fiscal al declarar impuestos.
  if (templateId === 'employer_coverage') {
    const agentWA_e = agent.agentWhatsApp || ''
    const waLink_e = agentWA_e ? `https://wa.me/${agentWA_e}` : ''
    const surveyUrl_e = `${appUrl || ''}/encuesta/${client.id}`
    const firstName_e = client.fullName.split(' ')[0]
    const hasWN_e = !!client.wnPolicies && client.wnPolicies.includes('"type"')

    const html = `<div style="font-family:Arial,Helvetica,sans-serif;max-width:700px;margin:auto;padding:0;color:#1e293b;line-height:1.75">

      <!-- Gradient header — igual que carta de despedida -->
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
          ¡FELICITACIONES POR SU NUEVO SEGURO! · AQUÍ ESTARÉ CUANDO ME NECESITE
        </p>
      </div>

      <!-- Body -->
      <div style="padding:36px;background:#ffffff">

        <p style="font-size:16px;margin-bottom:8px">Estimado/a <strong style="color:#10253f">${client.fullName}</strong>,</p>

        <p style="font-size:14px;margin-bottom:14px">
          ¡Qué buena noticia! Me alegra muchísimo saber que ahora cuenta con un seguro de salud
          a través de su trabajo. Eso habla muy bien de su esfuerzo, y me da mucha tranquilidad
          saber que usted y su familia seguirán protegidos.
        </p>

        <p style="font-size:14px;margin-bottom:20px">
          Fue un verdadero privilegio haberle acompañado durante este tiempo. Antes de cerrar su
          póliza del Mercado de Salud, quiero asegurarme de que la transición sea perfecta y de que
          <strong style="color:#10253f">no tenga ninguna sorpresa al declarar sus impuestos</strong>.
        </p>

        <!-- Aviso importante: cancelar el Marketplace -->
        <div style="background:#fef3c7;border:1.5px solid #fde68a;border-radius:12px;padding:22px;margin:20px 0">
          <p style="color:#92400e;font-size:14px;font-weight:700;margin:0 0 10px">
            ⚠️ Muy importante: hay que cancelar el plan del Mercado
          </p>
          <p style="color:#92400e;font-size:13px;margin:0 0 12px;line-height:1.65">
            Si su plan del Mercado sigue activo mientras ya tiene el seguro del trabajo, el gobierno
            continuará pagando el crédito fiscal (subsidio) — y ese dinero
            <strong>tendría que devolverlo</strong> cuando declare sus impuestos. Para evitarlo:
          </p>
          <ul style="color:#92400e;font-size:13px;margin:0;padding-left:20px;line-height:1.8">
            <li>Confírmeme <strong>la fecha exacta</strong> en que empieza su cobertura del trabajo.</li>
            <li>Yo me encargo de cancelar su plan del Mercado justo para esa fecha.</li>
            <li>Así no queda ningún día sin cobertura, ni pagando de más.</li>
          </ul>
          <p style="color:#92400e;font-size:13px;margin:12px 0 0;line-height:1.65">
            <strong>No cancele por su cuenta sin avisarme</strong> — si lo hacemos juntos, nos aseguramos
            de que las fechas calcen bien.
          </p>
        </div>

        ${hasWN_e ? `
        <!-- Coberturas que puede conservar -->
        <div style="background:#f0fdf4;border:1.5px solid #a7f3d0;border-radius:12px;padding:20px;margin:20px 0">
          <p style="color:#065f46;font-size:14px;font-weight:700;margin:0 0 8px">
            ✅ Sus pólizas complementarias siguen siendo suyas
          </p>
          <p style="color:#047857;font-size:13px;margin:0;line-height:1.65">
            Su cobertura suplementaria (accidentes, hospitalización, enfermedades graves) <strong>no depende
            de su trabajo</strong>: puede conservarla tal como está. De hecho, complementa muy bien el seguro
            del empleo, porque cubre los gastos que la póliza del trabajo no paga (deducibles, copagos,
            gastos diarios). Mi recomendación es mantenerla.
          </p>
        </div>` : ''}

        <p style="font-size:14px;margin-bottom:20px">
          Y algo que quiero que tenga muy presente: <strong style="color:#10253f">si en algún momento deja
          ese trabajo o le quitan el beneficio</strong>, eso le da derecho a un Período Especial de
          Inscripción — puede volver al Mercado de Salud sin esperar a fin de año. Solo escríbame y
          lo resolvemos de inmediato.
        </p>

        <!-- Survey CTA -->
        <div style="background:#f0f7fb;border:1.5px solid #b8d4e8;border-radius:12px;padding:24px;margin:20px 0;text-align:center">
          <p style="color:#10253f;font-size:14px;font-weight:700;margin:0 0 6px">
            ⭐ Encuesta de satisfacción
          </p>
          <p style="color:#64748b;font-size:13px;margin:0 0 18px;line-height:1.6">
            Antes de despedirnos, ¿me regala un minuto? Califique mi servicio del 1 al 5, indique si
            me recomendaría y deje cualquier comentario que desee compartir.
          </p>
          <a href="${surveyUrl_e}"
            style="display:inline-block;background:linear-gradient(135deg,#10253f,#0891b2);color:#ffffff;padding:12px 28px;border-radius:10px;text-decoration:none;font-weight:700;font-size:14px">
            Completar encuesta →
          </a>
          <p style="color:#94a3b8;font-size:11px;margin:14px 0 0">Sus respuestas son confidenciales.</p>
        </div>

        <!-- Closing -->
        <p style="font-size:14px;margin-top:20px;color:#475569">
          Gracias de corazón por la confianza que depositó en mí. Aunque ahora su seguro venga del trabajo,
          siga contando conmigo para cualquier duda sobre su cobertura — y si conoce a algún familiar o
          amigo que necesite orientación, me encantaría atenderlo con el mismo cariño con el que le atendí
          a usted. ¡Le deseo mucho éxito en esta nueva etapa!
        </p>

        <!-- Signature -->
        <div style="margin-top:28px;padding-top:20px;border-top:1px solid #e2e8f0">
          <p style="margin:0 0 2px;font-size:13px;color:#64748b">Con mucho aprecio y toda mi admiración,</p>
          <p style="margin:6px 0 2px;font-size:16px;font-weight:bold;color:#10253f">${agentName}</p>
          <p style="margin:0;font-size:12px;color:#94a3b8">Agente Autorizado de Seguros de Salud${agentNPN ? ` · NPN: ${agentNPN}` : ''}</p>
          ${agentPhone ? `<p style="margin:4px 0;font-size:13px">📞 ${agentPhone}</p>` : ''}
          ${waLink_e ? `<p style="margin:4px 0;font-size:13px"><a href="${waLink_e}" style="color:#25d366;font-weight:700">💬 WhatsApp</a>${agentPhone ? ` · ${agentPhone}` : ''}</p>` : ''}
          ${agentEmail ? `<p style="margin:4px 0;font-size:13px">✉️ ${agentEmail}</p>` : ''}
          ${webLine()}
        </div>

      </div><!-- end body -->

      <!-- Footer oscuro — igual que despedida -->
      <div style="background:#10253f;padding:14px 36px;text-align:center">
        <p style="color:rgba(255,255,255,.45);font-size:11px;margin:0">
          CRM Agentes de Seguros · ${today} · Documento de carácter confidencial.
        </p>
      </div>
    </div>`

    const text = `Estimado/a ${client.fullName},

¡Qué buena noticia! Me alegra saber que ahora cuenta con un seguro de salud a través de su trabajo.

IMPORTANTE — Hay que cancelar su plan del Mercado:
Si su plan del Mercado sigue activo mientras ya tiene el seguro del trabajo, el gobierno seguirá pagando el crédito fiscal (subsidio) y ese dinero tendría que devolverlo al declarar impuestos.

Para evitarlo:
- Confírmeme la fecha exacta en que empieza su cobertura del trabajo.
- Yo cancelo su plan del Mercado justo para esa fecha.
- Así no queda ningún día sin cobertura ni pagando de más.

No cancele por su cuenta sin avisarme: si lo hacemos juntos nos aseguramos de que las fechas calcen bien.
${hasWN_e ? `
Sus pólizas complementarias (accidentes, hospitalización, enfermedades graves) NO dependen de su trabajo: puede conservarlas y complementan muy bien el seguro del empleo.
` : ''}
Y recuerde: si en algún momento deja ese trabajo o le quitan el beneficio, tiene derecho a un Período Especial de Inscripción para volver al Mercado sin esperar a fin de año. Solo escríbame.

Antes de despedirnos, ¿me regala un minuto para contarme su experiencia?
👉 ${surveyUrl_e}

Gracias de corazón por su confianza. ¡Mucho éxito en esta nueva etapa!

Con mucho aprecio,
${agentName}${agentPhone ? `\n📞 ${agentPhone}` : ''}${agentEmail ? `\n✉️ ${agentEmail}` : ''}${webText}`

    const whatsapp = `💼 *¡Felicitaciones ${firstName_e}!*

Me alegra mucho saber que ahora tiene seguro de salud por su trabajo. 🎉

⚠️ *Algo muy importante:* hay que cancelar su plan del Mercado. Si se queda activo mientras ya tiene el del trabajo, el gobierno sigue pagando el subsidio y *tendría que devolver ese dinero* al declarar impuestos.

Para evitarlo:
✅ Dígame la fecha exacta en que empieza su seguro del trabajo
✅ Yo cancelo el del Mercado justo para esa fecha
✅ Así no queda ni un día sin cobertura
${hasWN_e ? `
✅ Sus pólizas complementarias NO dependen del trabajo — puede conservarlas, complementan muy bien el seguro del empleo.
` : ''}
_Por favor no cancele por su cuenta sin avisarme._

Y recuerde: si algún día deja ese trabajo, puede volver al Mercado de inmediato (Período Especial de Inscripción). Aquí estaré.

¿Me regala un minuto para contarme su experiencia?
👉 ${surveyUrl_e}

¡Gracias por su confianza y mucho éxito!
*${agentName}*${agentPhone ? `\n📞 ${agentPhone}` : ''}${webText}`

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
        ${webLine()}
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

${agentName}${agentPhone ? `\n📞 ${agentPhone}` : ''}${waLink_wn ? `\n💬 WhatsApp: ${waLink_wn}` : ''}${agentEmail ? `\n✉️ ${agentEmail}` : ''}${webText}`

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
