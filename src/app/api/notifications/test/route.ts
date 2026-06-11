import { NextResponse } from 'next/server'
import { sendEmail } from '@/lib/email'
import { requireAdmin } from '@/lib/auth'

export async function POST() {
  const auth = await requireAdmin()
  if (auth instanceof NextResponse) return auth
  const res = await sendEmail(
    auth.agencyId,
    '✅ CRM Seguros — Email configurado correctamente',
    `<div style="font-family:sans-serif;padding:20px;max-width:500px;margin:auto">
      <h2 style="color:#10253f">✅ ¡Email funcionando!</h2>
      <p>Tu CRM de seguros enviará notificaciones automáticas a este correo.</p>
      <ul>
        <li>🎂 Cumpleaños de clientes</li>
        <li>🔄 Renovaciones próximas (7 días)</li>
        <li>⚠️ Primer pago vencido</li>
      </ul>
      <p style="color:#94a3b8;font-size:12px;margin-top:16px">CRM Agentes de Seguros · ${new Date().toLocaleDateString('en-US')}</p>
    </div>`
  )
  if (res.sent) return NextResponse.json({ success: true })
  return NextResponse.json({ success: false, reason: res.reason }, { status: 400 })
}
