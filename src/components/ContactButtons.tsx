'use client'

import { useEffect, useState, memo } from 'react'

interface Props {
  clientName: string
  clientPhone: string | null | undefined
  size?: 'sm' | 'md'
  showLabel?: boolean
}

function cleanPhone(raw: string | null | undefined): string {
  if (!raw) return ''
  const digits = raw.replace(/\D/g, '')
  // Add US country code if 10 digits
  return digits.length === 10 ? `1${digits}` : digits
}

function buildWhatsAppMsg(template: string, name: string): string {
  return template
    .replace(/\{nombre\}/g, name.split(' ')[0])
    .replace(/\{link\}/g, '')
    .trim()
}

// Cache settings to avoid re-fetching per component instance
let cachedSettings: Record<string, string> | null = null
let fetchPromise: Promise<void> | null = null

async function loadSettings() {
  if (cachedSettings) return
  if (!fetchPromise) {
    fetchPromise = fetch('/api/settings')
      .then(r => r.json())
      .then(d => { cachedSettings = d })
      .catch(() => { cachedSettings = {} })
  }
  await fetchPromise
}

const ContactButtons = memo(function ContactButtons({ clientName, clientPhone, size = 'md', showLabel = true }: Props) {
  const [settings, setSettings] = useState<Record<string, string> | null>(null)

  useEffect(() => {
    loadSettings().then(() => setSettings(cachedSettings))
  }, [])

  const phone = cleanPhone(clientPhone)
  if (!phone) return null

  const defaultMsg = settings
    ? buildWhatsAppMsg(
        settings.whatsappTemplate || 'Hola {nombre}, ¿en qué te puedo ayudar con tu póliza de seguro?',
        clientName
      )
    : `Hola ${clientName.split(' ')[0]}, ¿en qué te puedo ayudar con tu póliza de seguro?`

  const waUrl = `https://wa.me/${phone}?text=${encodeURIComponent(defaultMsg)}`
  const telUrl = `tel:+${phone}`

  const btnBase = size === 'sm'
    ? 'inline-flex items-center gap-1 px-2 py-1 rounded-lg text-xs font-medium transition-all hover:opacity-80'
    : 'inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium transition-all hover:opacity-80'

  return (
    <div className="flex items-center gap-1.5">
      {/* WhatsApp */}
      <a
        href={waUrl}
        target="_blank"
        rel="noopener noreferrer"
        className={btnBase}
        style={{ background: '#25d366', color: '#ffffff' }}
        title={`Enviar WhatsApp a ${clientName}`}
      >
        <span>{size === 'sm' ? '💬' : '💬'}</span>
        {showLabel && <span>WhatsApp</span>}
      </a>

      {/* Llamar */}
      <a
        href={telUrl}
        className={btnBase}
        style={{ background: '#429EBD', color: '#ffffff' }}
        title={`Llamar a ${clientName}`}
      >
        <span>📞</span>
        {showLabel && <span>Llamar</span>}
      </a>
    </div>
  )
})

export default ContactButtons
