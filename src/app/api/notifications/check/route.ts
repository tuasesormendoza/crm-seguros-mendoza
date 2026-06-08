import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { sendEmail } from '@/lib/email'

function monthsBetween(start: Date, end: Date): number {
  let months = (end.getFullYear() - start.getFullYear()) * 12 + (end.getMonth() - start.getMonth())
  if (end.getDate() < start.getDate()) months -= 1
  return Math.max(months, 0)
}

function getAge(birth: Date): number {
  const today = new Date()
  let age = today.getFullYear() - birth.getUTCFullYear()
  const m = today.getMonth() - birth.getUTCMonth()
  if (m < 0 || (m === 0 && today.getDate() < birth.getUTCDate())) age--
  return age
}

export async function POST() {
  const today = new Date()
  const results: string[] = []

  const clients = await prisma.client.findMany({
    where: { status: 'Activo' },
    select: { id: true, fullName: true, phone: true, email: true, birthDate: true, renewalDate: true, firstPaymentPaid: true, contractDate: true, insurer: true }
  })

  const agentName = (await prisma.settings.findUnique({ where: { key: 'agentName' } }))?.value || 'Agente'

  // 1. BIRTHDAYS today
  for (const c of clients) {
    if (!c.birthDate) continue
    const birth = new Date(c.birthDate)
    if (birth.getUTCMonth() === today.getMonth() && birth.getUTCDate() === today.getDate()) {
      const key = `birthday-${c.id}-${today.getFullYear()}`
      const already = await prisma.notificationLog.findUnique({ where: { type_refId: { type: 'birthday', refId: key } } })
      if (!already) {
        const age = getAge(birth)
        const subject = `🎂 Cumpleaños hoy: ${c.fullName}`
        const html = `
          <div style="font-family:sans-serif;max-width:500px;margin:auto;padding:20px">
            <h2 style="color:#10253f">🎂 Hoy es el cumpleaños de ${c.fullName}</h2>
            <p>Tu cliente cumple <strong>${age} años</strong> hoy.</p>
            ${c.phone ? `<p>📱 Teléfono: <a href="tel:${c.phone}">${c.phone}</a></p>` : ''}
            <p style="margin-top:16px">
              <a href="https://wa.me/${c.phone?.replace(/\D/g,'')?.length === 10 ? '1' : ''}${c.phone?.replace(/\D/g,'')}?text=${encodeURIComponent(`Hola ${c.fullName.split(' ')[0]}, ¡feliz cumpleaños! 🎂 Que tengas un excelente día. - ${agentName}`)}"
                style="background:#25d366;color:white;padding:10px 20px;border-radius:8px;text-decoration:none;font-weight:bold">
                💬 Enviar Felicitación por WhatsApp
              </a>
            </p>
            <p style="color:#94a3b8;font-size:12px;margin-top:20px">CRM Agentes de Seguros · ${new Date().toLocaleDateString('en-US')}</p>
          </div>`
        const res = await sendEmail(subject, html)
        if (res.sent) {
          await prisma.notificationLog.create({ data: { type: 'birthday', refId: key } })
          results.push(`✓ Birthday: ${c.fullName}`)
        }
      }
    }
  }

  // 2. RENEWALS in 7 days
  for (const c of clients) {
    if (!c.renewalDate) continue
    const renewal = new Date(c.renewalDate)
    const renewalLocal = new Date(renewal.getUTCFullYear(), renewal.getUTCMonth(), renewal.getUTCDate())
    const in7Local = new Date(today.getFullYear(), today.getMonth(), today.getDate() + 7)
    const todayLocal = new Date(today.getFullYear(), today.getMonth(), today.getDate())
    if (renewalLocal >= todayLocal && renewalLocal <= in7Local) {
      const key = `renewal-${c.id}-${renewalLocal.toISOString().split('T')[0]}`
      const already = await prisma.notificationLog.findUnique({ where: { type_refId: { type: 'renewal', refId: key } } })
      if (!already) {
        const daysLeft = Math.ceil((renewalLocal.getTime() - todayLocal.getTime()) / (1000*60*60*24))
        const subject = `🔄 Renovación en ${daysLeft} días: ${c.fullName}`
        const html = `
          <div style="font-family:sans-serif;max-width:500px;margin:auto;padding:20px">
            <h2 style="color:#10253f">🔄 Renovación próxima</h2>
            <p><strong>${c.fullName}</strong> renueva su póliza en <strong>${daysLeft} días</strong>.</p>
            <table style="width:100%;border-collapse:collapse;margin:16px 0">
              <tr><td style="padding:6px;color:#64748b">Aseguradora:</td><td style="padding:6px;font-weight:bold">${c.insurer || '—'}</td></tr>
              <tr style="background:#f8fafc"><td style="padding:6px;color:#64748b">Fecha renovación:</td><td style="padding:6px;font-weight:bold">${renewalLocal.toLocaleDateString('en-US')}</td></tr>
              ${c.phone ? `<tr><td style="padding:6px;color:#64748b">Teléfono:</td><td style="padding:6px"><a href="tel:${c.phone}">${c.phone}</a></td></tr>` : ''}
            </table>
            <p style="color:#94a3b8;font-size:12px;margin-top:20px">CRM Agentes de Seguros · ${new Date().toLocaleDateString('en-US')}</p>
          </div>`
        const res = await sendEmail(subject, html)
        if (res.sent) {
          await prisma.notificationLog.create({ data: { type: 'renewal', refId: key } })
          results.push(`✓ Renewal: ${c.fullName} (${daysLeft}d)`)
        }
      }
    }
  }

  // 3. FIRST PAYMENT overdue (>30 days unpaid)
  const thirtyDaysAgo = new Date(today); thirtyDaysAgo.setDate(today.getDate() - 30)
  const overdueClients = clients.filter(c =>
    c.contractDate && !c.firstPaymentPaid &&
    new Date(c.contractDate) <= thirtyDaysAgo
  )
  if (overdueClients.length > 0) {
    const key = `firstpayment-overdue-${today.toISOString().split('T')[0]}`
    const already = await prisma.notificationLog.findUnique({ where: { type_refId: { type: 'firstpayment', refId: key } } })
    if (!already) {
      const subject = `⚠️ ${overdueClients.length} cliente(s) con primer pago vencido`
      const html = `
        <div style="font-family:sans-serif;max-width:500px;margin:auto;padding:20px">
          <h2 style="color:#dc2626">⚠️ Primer Pago Vencido</h2>
          <p>${overdueClients.length} cliente(s) llevan más de 30 días sin confirmar su primer pago:</p>
          <ul>${overdueClients.map(c => `<li><strong>${c.fullName}</strong>${c.phone ? ` · ${c.phone}` : ''}</li>`).join('')}</ul>
          <p style="color:#94a3b8;font-size:12px;margin-top:20px">CRM Agentes de Seguros · ${new Date().toLocaleDateString('en-US')}</p>
        </div>`
      const res = await sendEmail(subject, html)
      if (res.sent) {
        await prisma.notificationLog.create({ data: { type: 'firstpayment', refId: key } })
        results.push(`✓ First payment overdue: ${overdueClients.length} clients`)
      }
    }
  }

  // 4. WASHINGTON NATIONAL (WN) — clawback safety reached (month 7) & second
  // commission payment due (month 8). One-time alerts per client/milestone.
  const wnClients = await prisma.client.findMany({
    where: { wnPolicies: { not: null }, status: 'Activo' },
    select: { id: true, fullName: true, phone: true, wnPolicies: true, contractDate: true, wnContractDate: true },
  })
  for (const c of wnClients) {
    let hasWn = false
    try {
      const policies = c.wnPolicies ? JSON.parse(c.wnPolicies) : []
      hasWn = Array.isArray(policies) && policies.some((p: { monthly?: string | number }) => (parseFloat(String(p.monthly)) || 0) > 0)
    } catch { /* ignore */ }
    if (!hasWn) continue

    const startDate = c.wnContractDate ? new Date(c.wnContractDate) : (c.contractDate ? new Date(c.contractDate) : null)
    if (!startDate) continue
    const monthsActive = monthsBetween(startDate, today)

    // Reached month 7 → no more clawback risk on the 75% already received
    if (monthsActive === 7) {
      const key = `wn-clawback-safe-${c.id}`
      const already = await prisma.notificationLog.findUnique({ where: { type_refId: { type: 'wn', refId: key } } })
      if (!already) {
        const subject = `✅ WN: riesgo de devolución superado — ${c.fullName}`
        const html = `
          <div style="font-family:sans-serif;max-width:500px;margin:auto;padding:20px">
            <h2 style="color:#166534">✅ Sin riesgo de devolución (Washington National)</h2>
            <p><strong>${c.fullName}</strong> cumplió <strong>7 meses</strong> con su póliza WN activa — el 75% de la comisión ya recibido queda <strong>asegurado</strong> (no hay que devolverlo aunque cancele después).</p>
            <p style="color:#94a3b8;font-size:12px;margin-top:20px">CRM Agentes de Seguros · ${new Date().toLocaleDateString('en-US')}</p>
          </div>`
        const res = await sendEmail(subject, html)
        if (res.sent) {
          await prisma.notificationLog.create({ data: { type: 'wn', refId: key } })
          results.push(`✓ WN clawback-safe: ${c.fullName}`)
        }
      }
    }

    // Reached month 8 → second payment (25%) should now be coming
    if (monthsActive === 8) {
      const key = `wn-second-payment-${c.id}`
      const already = await prisma.notificationLog.findUnique({ where: { type_refId: { type: 'wn', refId: key } } })
      if (!already) {
        const subject = `💰 WN: 2do pago de comisión esperado — ${c.fullName}`
        const html = `
          <div style="font-family:sans-serif;max-width:500px;margin:auto;padding:20px">
            <h2 style="color:#10253f">💰 Segundo pago de comisión WN esperado</h2>
            <p><strong>${c.fullName}</strong> cumplió <strong>8 meses</strong> con su póliza Washington National activa — el 25% restante de la comisión debería estar por llegar. Verifica y márcalo como recibido en la página de Comisiones.</p>
            <p style="color:#94a3b8;font-size:12px;margin-top:20px">CRM Agentes de Seguros · ${new Date().toLocaleDateString('en-US')}</p>
          </div>`
        const res = await sendEmail(subject, html)
        if (res.sent) {
          await prisma.notificationLog.create({ data: { type: 'wn', refId: key } })
          results.push(`✓ WN second-payment due: ${c.fullName}`)
        }
      }
    }
  }

  return NextResponse.json({ checked: true, sent: results.length, results })
}
