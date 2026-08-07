'use client'

import { useEffect, useState, useCallback } from 'react'
import UserManagement from '@/components/settings/UserManagement'
import LogoUploader from '@/components/settings/LogoUploader'
import ColorSettings from '@/components/settings/ColorSettings'
import GoogleCalendar from '@/components/settings/GoogleCalendar'
import PublicIntakePanel from '@/components/settings/PublicIntakePanel'
import TwoFactorPanel from '@/components/settings/TwoFactorPanel'
import { INPUT, LABEL, SECTION, TITLE, SaveBtn, type Settings } from '@/components/settings/shared'
import { missingProfileFields } from '@/lib/agentProfile'

// Pestañas de Configuración: agrupan las secciones en categorías para una
// navegación profesional (en lugar de un scroll interminable).
const SETTINGS_TABS = [
  { id: 'marca', label: 'Marca', icon: '🎨' },
  { id: 'perfil', label: 'Perfil y Metas', icon: '👤' },
  { id: 'mensajes', label: 'Mensajería', icon: '💬' },
  { id: 'herramientas', label: 'Cálculos y AI', icon: '🧮' },
  { id: 'integraciones', label: 'Integraciones y Respaldo', icon: '🔗' },
  { id: 'cuenta', label: 'Cuenta y Usuarios', icon: '🔐' },
] as const
type SettingsTabId = typeof SETTINGS_TABS[number]['id']

export default function SettingsPage() {
  const [settings, setSettings] = useState<Settings>({})
  const [loading, setLoading] = useState(true)

  // Pestaña activa. Si venimos del redirect de OAuth de Google (?google=...),
  // abrimos directo la pestaña de Integraciones para que se vea el mensaje.
  const [tab, setTab] = useState<SettingsTabId>(() => {
    if (typeof window !== 'undefined' && new URLSearchParams(window.location.search).get('google')) return 'integraciones'
    return 'marca'
  })

  // Only admins can access this page — everyone else sees a friendly message
  // instead of the full settings UI (and instead of a hard crash from /api/users
  // returning a 403 to non-admins).
  const [role, setRole] = useState<string | null>(null)
  useEffect(() => {
    fetch('/api/auth')
      .then(res => res.ok ? res.json() : { role: 'agent' })
      .then(data => setRole(data.role || 'agent'))
      .catch(() => setRole('agent'))
  }, [])

  // Per-section save states
  const [savingProfile, setSavingProfile] = useState(false)
  const [savedProfile, setSavedProfile] = useState(false)
  const [savingReview, setSavingReview] = useState(false)
  const [savedReview, setSavedReview] = useState(false)
  const [savingPolicy, setSavingPolicy] = useState(false)
  const [savedPolicy, setSavedPolicy] = useState(false)
  const [savingCard, setSavingCard] = useState(false)
  const [savedCard, setSavedCard] = useState(false)

  // Email section
  const [savingEmail, setSavingEmail] = useState(false)
  const [savedEmail, setSavedEmail] = useState(false)
  const [testingEmail, setTestingEmail] = useState(false)
  const [testEmailResult, setTestEmailResult] = useState<string | null>(null)
  const [checkingNotif, setCheckingNotif] = useState(false)
  const [checkNotifResult, setCheckNotifResult] = useState<string | null>(null)
  const [showSmtpPass, setShowSmtpPass] = useState(false)

  // Goals section
  const [savingGoals, setSavingGoals] = useState(false)
  const [savedGoals, setSavedGoals] = useState(false)
  const [goals, setGoals] = useState({ newClientsMonthly: '5', newClientsAnnual: '50', revenueMonthly: '500', revenueAnnual: '6000', wnClientsMonthly: '2' })

  // Password
  const [currentPw, setCurrentPw] = useState('')
  const [newPw, setNewPw] = useState('')
  const [confirmPw, setConfirmPw] = useState('')
  const [pwError, setPwError] = useState('')
  const [pwSuccess, setPwSuccess] = useState(false)
  const [savingPw, setSavingPw] = useState(false)
  const [showPw, setShowPw] = useState(false)

  // ¿Es el DUEÑO del CRM? Solo él ve/edita la config de plataforma (CMS API Key,
  // FPL y Claude AI). Las agencias cliente heredan esos valores sin verlos.
  const [isOwner, setIsOwner] = useState(false)

  const load = useCallback(async () => {
    const res = await fetch('/api/settings')
    const data = await res.json()
    setSettings(data)
    setIsOwner(data.__isOwner === 'true')
    setLoading(false)
    // Load goals from productionGoals setting
    if (data.productionGoals) {
      try {
        const g = JSON.parse(data.productionGoals)
        setGoals({
          newClientsMonthly: String(g.newClientsMonthly ?? 5),
          newClientsAnnual: String(g.newClientsAnnual ?? 50),
          revenueMonthly: String(g.revenueMonthly ?? 500),
          revenueAnnual: String(g.revenueAnnual ?? 6000),
          wnClientsMonthly: String(g.wnClientsMonthly ?? 2),
        })
      } catch { /* ignore */ }
    }
  }, [])

  useEffect(() => { load() }, [load])

  const set = (key: string, value: string) =>
    setSettings(s => ({ ...s, [key]: value }))

  async function saveSection(keys: string[], setSaving: (v: boolean) => void, setSaved: (v: boolean) => void, overrides?: Record<string, string>) {
    setSaving(true)
    const partial: Settings = {}
    keys.forEach(k => { partial[k] = overrides?.[k] ?? settings[k] ?? '' })
    await fetch('/api/settings', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(partial),
    })
    setSaving(false)
    setSaved(true)
    setTimeout(() => setSaved(false), 3000)
  }

  async function testEmail() {
    setTestingEmail(true)
    setTestEmailResult(null)
    try {
      const res = await fetch('/api/notifications/test', { method: 'POST' })
      const text = await res.text()
      const data = text ? JSON.parse(text) : {}
      setTestEmailResult(data.success ? '✅ Email enviado correctamente' : `❌ Error: ${data.reason || 'Configura el email primero'}`)
    } catch {
      setTestEmailResult('❌ Error al conectar con el servidor')
    }
    setTestingEmail(false)
  }

  async function checkNotifications() {
    setCheckingNotif(true)
    setCheckNotifResult(null)
    const res = await fetch('/api/notifications/check', { method: 'POST' })
    const data = await res.json()
    setCheckingNotif(false)
    setCheckNotifResult(`✅ Verificado — ${data.sent} notificaciones enviadas${data.results?.length ? ': ' + data.results.join(', ') : ''}`)
  }

  async function saveGoals(e: React.FormEvent) {
    e.preventDefault()
    setSavingGoals(true)
    const parsed = {
      newClientsMonthly: parseInt(goals.newClientsMonthly) || 0,
      newClientsAnnual: parseInt(goals.newClientsAnnual) || 0,
      revenueMonthly: parseInt(goals.revenueMonthly) || 0,
      revenueAnnual: parseInt(goals.revenueAnnual) || 0,
      wnClientsMonthly: parseInt(goals.wnClientsMonthly) || 0,
    }
    await fetch('/api/settings', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ productionGoals: JSON.stringify(parsed) }),
    })
    setSavingGoals(false)
    setSavedGoals(true)
    setTimeout(() => setSavedGoals(false), 3000)
  }

  async function handlePasswordChange(e: React.FormEvent) {
    e.preventDefault()
    setPwError('')
    setPwSuccess(false)
    if (newPw !== confirmPw) { setPwError('Las contraseñas no coinciden'); return }
    if (newPw.length < 8) { setPwError('Mínimo 8 caracteres'); return }
    if (!/[a-zA-Z]/.test(newPw) || !/\d/.test(newPw)) { setPwError('Debe incluir al menos una letra y un número'); return }
    setSavingPw(true)
    const res = await fetch('/api/settings/change-password', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ currentPassword: currentPw, newPassword: newPw }),
    })
    const data = await res.json()
    setSavingPw(false)
    if (!res.ok) { setPwError(data.error || 'Error al cambiar contraseña'); return }
    setPwSuccess(true)
    setCurrentPw(''); setNewPw(''); setConfirmPw('')
    setTimeout(() => setPwSuccess(false), 5000)
  }

  if (role === null) return (
    <div className="flex items-center justify-center h-64">
      <div className="text-gray-400">Cargando configuración...</div>
    </div>
  )

  if (role !== 'admin') return (
    <div className="max-w-md mx-auto mt-20 text-center bg-white rounded-2xl border border-gray-200 p-8">
      <div className="text-5xl mb-4">🔒</div>
      <h1 className="text-xl font-bold mb-2" style={{ color: '#10253f' }}>Acceso no autorizado</h1>
      <p className="text-sm text-gray-500">
        No tienes permisos para acceder a esta sección. Contacta a tu administrador si necesitas realizar cambios aquí.
      </p>
    </div>
  )

  if (loading) return (
    <div className="flex items-center justify-center h-64">
      <div className="text-gray-400">Cargando configuración...</div>
    </div>
  )

  const activeTabLabel = SETTINGS_TABS.find(t => t.id === tab)?.label ?? ''
  // Todo lo que aún no ha rellenado: obligatorio y opcional. El aviso los
  // enumera para que sepa exactamente qué se está quedando en blanco.
  const missingProfile = missingProfileFields(settings)

  return (
    <div className="max-w-6xl mx-auto">
      <div className="mb-6">
        <h1 className="text-2xl font-bold" style={{ color: '#10253f' }}>Configuración</h1>
        <p className="text-sm text-gray-500 mt-1">Personaliza tu CRM desde aquí sin tocar ningún archivo</p>
      </div>

      {/* Aviso de perfil incompleto. El CRM llega sin los datos de nadie: hasta
          que el agente ponga los suyos, hay huecos visibles en documentos,
          mensajes y reportes. Mejor decirlo aquí que dejar que se entere el
          cliente. */}
      {missingProfile.length > 0 && (
        <div className="mb-6 rounded-xl p-4" style={{ background: '#fffbeb', border: '1px solid #fde68a' }}>
          <div className="flex items-start gap-3">
            <span className="text-lg leading-none mt-0.5">⚠️</span>
            <div className="min-w-0">
              <p className="text-sm font-semibold" style={{ color: '#92400e' }}>Completa tu perfil</p>
              <p className="text-xs mt-1" style={{ color: '#b45309' }}>
                El CRM no trae datos de ningún agente precargados. Mientras estos campos estén vacíos,
                los documentos, mensajes y reportes saldrán sin ellos:
              </p>
              <ul className="text-xs mt-1.5 space-y-0.5" style={{ color: '#b45309' }}>
                {missingProfile.map(f => (
                  <li key={f.key}>• <strong>{f.label}</strong> — {f.usedFor}</li>
                ))}
              </ul>
              <button type="button" onClick={() => setTab('perfil')}
                className="text-xs font-semibold underline mt-2" style={{ color: '#92400e' }}>
                Ir a Perfil del Agente →
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="flex flex-col md:flex-row gap-6 items-start">
        {/* ── Navegación lateral (horizontal en móvil, vertical en escritorio) ── */}
        <nav className="w-full md:w-56 shrink-0 md:sticky md:top-4">
          <div className="flex md:flex-col gap-1 overflow-x-auto md:overflow-visible -mx-1 px-1 pb-1 md:pb-0">
            {SETTINGS_TABS.map(t => {
              const active = tab === t.id
              return (
                <button key={t.id} onClick={() => setTab(t.id)}
                  className={`flex items-center gap-2.5 px-3 py-2.5 rounded-lg text-sm font-medium whitespace-nowrap text-left transition-colors ${active ? 'text-white shadow-sm' : 'text-slate-600 hover:bg-gray-100'}`}
                  style={active ? { background: '#10253f' } : undefined}>
                  <span className="text-base">{t.icon}</span>
                  <span>{t.label}</span>
                </button>
              )
            })}
          </div>
        </nav>

        {/* ── Contenido de la pestaña activa ── */}
        <div className="flex-1 min-w-0 w-full space-y-4 md:space-y-6">
          <h2 className="text-lg font-bold md:hidden" style={{ color: '#10253f' }}>{activeTabLabel}</h2>

          {tab === 'marca' && (<>
      {/* ── Logo de la Agencia ───────────────────────────────── */}
      <LogoUploader currentUrl={settings.logoUrl} onUploaded={url => set('logoUrl', url || '')} />

      {/* ── Colores del Sistema ───────────────────────────────── */}
      <ColorSettings settings={settings} set={set} onSave={(overrides) => saveSection(['themeBrand800','themeBrand500','themeBrand300','themeAccent'], () => {}, () => {}, overrides)} />

      {/* ── Tarjeta de Plan (white-label) ─────────────────────── */}
      <div className={SECTION}>
        <h2 className={TITLE} style={{ color: '#10253f' }}>🪪 Tarjeta de Plan</h2>
        <p className="text-xs text-gray-500 mb-4">
          Personaliza la tarjeta que generas para tus clientes. El logo se toma del &quot;Logo de la Agencia&quot; de arriba (si no hay logo, aparece tu nombre).
        </p>
        <form onSubmit={e => { e.preventDefault(); saveSection(['cardWebsite','cardHeaderColor','cardAccentColor'], setSavingCard, setSavedCard) }} className="space-y-4">
          <div>
            <label className={LABEL}>Página web (pie de la tarjeta)</label>
            <input className={INPUT} value={settings.cardWebsite ?? ''} onChange={e => set('cardWebsite', e.target.value)} placeholder="www.tuagencia.com" />
            <p className="text-xs text-gray-400 mt-1">Aparece abajo: &quot;Para agendar una cita con tu médico visita ...&quot;. Déjalo vacío para ocultarlo.</p>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className={LABEL}>Color del encabezado</label>
              <div className="flex items-center gap-2">
                <input type="color" value={settings.cardHeaderColor || '#0D2A4A'} onChange={e => set('cardHeaderColor', e.target.value)}
                  className="w-10 h-10 rounded-lg border border-gray-200 cursor-pointer bg-white p-0.5" />
                <input className={INPUT + ' flex-1'} value={settings.cardHeaderColor ?? '#0D2A4A'} onChange={e => set('cardHeaderColor', e.target.value)} placeholder="#0D2A4A" />
              </div>
            </div>
            <div>
              <label className={LABEL}>Color de acento</label>
              <div className="flex items-center gap-2">
                <input type="color" value={settings.cardAccentColor || '#F0C040'} onChange={e => set('cardAccentColor', e.target.value)}
                  className="w-10 h-10 rounded-lg border border-gray-200 cursor-pointer bg-white p-0.5" />
                <input className={INPUT + ' flex-1'} value={settings.cardAccentColor ?? '#F0C040'} onChange={e => set('cardAccentColor', e.target.value)} placeholder="#F0C040" />
              </div>
            </div>
          </div>
          <div className="flex justify-end">
            <SaveBtn saving={savingCard} saved={savedCard} />
          </div>
        </form>
      </div>

      </>)}

      {tab === 'perfil' && (<>
      {/* ── Perfil del Agente ─────────────────────────────────── */}
      <div className={SECTION}>
        <h2 className={TITLE} style={{ color: '#10253f' }}>👤 Perfil del Agente</h2>
        <p className="text-xs text-gray-500 mb-4">Tu información aparece en reportes y documentos exportados.</p>
        <form onSubmit={e => { e.preventDefault(); saveSection(['agentName','agentPhone','agentWhatsApp','agentEmail','agentLicense','agentAddress','agentStateLicenses','gaAccessPhone','marketplacePhone','healthSherpaConsentUrl'], setSavingProfile, setSavedProfile) }}
          className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className={LABEL}>Nombre completo</label>
              <input className={INPUT} value={settings.agentName ?? ''} onChange={e => set('agentName', e.target.value)} placeholder="Nombre y apellido" />
            </div>
            <div>
              <label className={LABEL}>Teléfono / Llamadas</label>
              <input className={INPUT} value={settings.agentPhone ?? ''} onChange={e => set('agentPhone', e.target.value)} placeholder="(305) 555-0100" />
            </div>
            <div>
              <label className={LABEL}>
                WhatsApp Business
                <span className="ml-2 text-gray-400 font-normal text-xs">Solo dígitos con código de país</span>
              </label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm">💬</span>
                <input className={INPUT + ' pl-8'} value={settings.agentWhatsApp ?? ''} onChange={e => set('agentWhatsApp', e.target.value.replace(/\D/g,''))} placeholder="13055550100" />
              </div>
              {settings.agentWhatsApp && (
                <a href={`https://wa.me/${settings.agentWhatsApp}`} target="_blank" rel="noopener noreferrer"
                  className="text-xs mt-1 inline-block" style={{ color: '#25d366' }}>
                  ✓ Probar: wa.me/{settings.agentWhatsApp} →
                </a>
              )}
            </div>
            <div>
              <label className={LABEL}>Email</label>
              <input className={INPUT} type="email" value={settings.agentEmail ?? ''} onChange={e => set('agentEmail', e.target.value)} placeholder="agente@email.com" />
            </div>
            <div>
              <label className={LABEL}>Número NPN</label>
              <input className={INPUT} value={settings.agentLicense ?? ''} onChange={e => set('agentLicense', e.target.value)} placeholder="Ej. 12345678" />
            </div>
            <div>
              <label className={LABEL}>Dirección</label>
              <input className={INPUT} value={settings.agentAddress ?? ''} onChange={e => set('agentAddress', e.target.value)} placeholder="Calle, Ciudad, Estado, ZIP" />
            </div>
            <div className="md:col-span-2">
              <label className={LABEL}>
                Licencias Activas por Estado
                <span className="ml-2 text-gray-400 font-normal text-xs">Un estado por línea, formato "Estado: Número"</span>
              </label>
              <textarea className={INPUT + ' resize-y'} rows={3} value={settings.agentStateLicenses ?? ''}
                onChange={e => set('agentStateLicenses', e.target.value)}
                placeholder={'FL: 12345678\nGA: 87654321\nTX: 11223344'} />
            </div>
            <div>
              <label className={LABEL}>Teléfono Georgia Access</label>
              <div className="flex gap-2">
                <input className={INPUT} value={settings.gaAccessPhone ?? ''} onChange={e => set('gaAccessPhone', e.target.value.replace(/\D/g,''))} placeholder="8883124237" />
                {settings.gaAccessPhone && (
                  <a href={`tel:+1${settings.gaAccessPhone}`}
                    className="shrink-0 inline-flex items-center gap-1 px-3 rounded-lg text-xs font-semibold text-white"
                    style={{ background: '#10253f' }}>
                    📞 Llamar
                  </a>
                )}
              </div>
            </div>
            <div>
              <label className={LABEL}>Teléfono Mercado de Salud</label>
              <div className="flex gap-2">
                <input className={INPUT} value={settings.marketplacePhone ?? ''} onChange={e => set('marketplacePhone', e.target.value.replace(/\D/g,''))} placeholder="8557886275" />
                {settings.marketplacePhone && (
                  <a href={`tel:+1${settings.marketplacePhone}`}
                    className="shrink-0 inline-flex items-center gap-1 px-3 rounded-lg text-xs font-semibold text-white"
                    style={{ background: '#10253f' }}>
                    📞 Llamar
                  </a>
                )}
              </div>
            </div>
            <div className="md:col-span-2">
              <label className={LABEL}>
                Link de Consentimientos en HealthSherpa
                <span className="ml-2 text-gray-400 font-normal text-xs">Se usa en el botón rápido de "Modo Combate" del Pipeline</span>
              </label>
              <input className={INPUT} value={settings.healthSherpaConsentUrl ?? ''} onChange={e => set('healthSherpaConsentUrl', e.target.value)}
                placeholder="https://www.healthsherpa.com/agents/tu-usuario/consents/list" />
              {settings.healthSherpaConsentUrl && (
                <a href={settings.healthSherpaConsentUrl} target="_blank" rel="noopener noreferrer"
                  className="text-xs mt-1 inline-block" style={{ color: '#507b88' }}>
                  🔗 Probar link →
                </a>
              )}
            </div>
          </div>
          <div className="flex justify-end">
            <SaveBtn saving={savingProfile} saved={savedProfile} />
          </div>
        </form>
      </div>

      {/* ── Objetivos de Producción ───────────────────────────── */}
      <div className={SECTION}>
        <h2 className={TITLE} style={{ color: '#10253f' }}>🎯 Objetivos de Producción</h2>
        <p className="text-xs text-gray-500 mb-4">Define tus metas mensuales y anuales. Se mostrarán como barras de progreso en el dashboard.</p>
        <form onSubmit={saveGoals} className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className={LABEL}>Nuevos clientes por mes</label>
              <input className={INPUT} type="number" min="0" value={goals.newClientsMonthly}
                onChange={e => setGoals(g => ({ ...g, newClientsMonthly: e.target.value }))} />
            </div>
            <div>
              <label className={LABEL}>Nuevos clientes por año</label>
              <input className={INPUT} type="number" min="0" value={goals.newClientsAnnual}
                onChange={e => setGoals(g => ({ ...g, newClientsAnnual: e.target.value }))} />
            </div>
            <div>
              <label className={LABEL}>Ingreso mensual meta ($)</label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm">$</span>
                <input className={INPUT + ' pl-6'} type="number" min="0" value={goals.revenueMonthly}
                  onChange={e => setGoals(g => ({ ...g, revenueMonthly: e.target.value }))} />
              </div>
            </div>
            <div>
              <label className={LABEL}>Ingreso anual meta ($)</label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm">$</span>
                <input className={INPUT + ' pl-6'} type="number" min="0" value={goals.revenueAnnual}
                  onChange={e => setGoals(g => ({ ...g, revenueAnnual: e.target.value }))} />
              </div>
            </div>
            <div>
              <label className={LABEL}>Clientes WN por mes</label>
              <input className={INPUT} type="number" min="0" value={goals.wnClientsMonthly}
                onChange={e => setGoals(g => ({ ...g, wnClientsMonthly: e.target.value }))} />
            </div>
          </div>
          <div className="flex justify-end">
            <SaveBtn saving={savingGoals} saved={savedGoals} />
          </div>
        </form>
      </div>

      </>)}

      {tab === 'mensajes' && (<>
      {/* ── Mensajes de Cumpleaños ───────────────────────────────── */}
      <div className={SECTION}>
        <h2 className={TITLE} style={{ color: '#10253f' }}>🎂 Mensaje de Cumpleaños</h2>
        <p className="text-xs text-gray-500 mb-4">
          Mensaje que se envía por WhatsApp cuando un cliente cumple años.
          Variables disponibles: <code className="bg-gray-100 px-1 rounded">{'{nombre}'}</code> y <code className="bg-gray-100 px-1 rounded">{'{agente}'}</code>
        </p>
        <form onSubmit={e => { e.preventDefault(); saveSection(['birthdayTemplate'], setSavingReview, setSavedReview) }} className="space-y-4">
          <div>
            <label className={LABEL}>Mensaje de felicitación</label>
            <textarea className={INPUT} rows={3}
              value={settings.birthdayTemplate ?? ''}
              onChange={e => set('birthdayTemplate', e.target.value)}
              placeholder="Hola {nombre}, ¡feliz cumpleaños! 🎂..." />
            {settings.birthdayTemplate && settings.agentPhone && (
              <a href={`https://wa.me/1${settings.agentPhone.replace(/\D/g,'')}?text=${encodeURIComponent(settings.birthdayTemplate.replace(/\{nombre\}/g,'Cliente').replace(/\{agente\}/g,settings.agentName||''))}`}
                target="_blank" rel="noopener noreferrer"
                className="text-xs mt-1 inline-block" style={{ color: '#25d366' }}>
                💬 Vista previa del mensaje →
              </a>
            )}
          </div>
          <div className="flex justify-end">
            <SaveBtn saving={savingReview} saved={savedReview} />
          </div>
        </form>
      </div>

      {/* ── Google Review ─────────────────────────────────────── */}
      <div className={SECTION}>
        <h2 className={TITLE} style={{ color: '#10253f' }}>⭐ Google Review</h2>
        <p className="text-xs text-gray-500 mb-4">Configura el link y los mensajes de WhatsApp para solicitar reseñas.</p>
        <form onSubmit={e => { e.preventDefault(); saveSection(['googleReviewLink','whatsappTemplate','whatsappReminderTemplate'], setSavingReview, setSavedReview) }}
          className="space-y-4">
          <div>
            <label className={LABEL}>Link de Google Review</label>
            <input className={INPUT} value={settings.googleReviewLink ?? ''} onChange={e => set('googleReviewLink', e.target.value)}
              placeholder="https://g.page/r/..." />
            {settings.googleReviewLink && (
              <a href={settings.googleReviewLink} target="_blank" rel="noopener noreferrer"
                className="text-xs mt-1 inline-block" style={{ color: '#507b88' }}>
                🔗 Probar link →
              </a>
            )}
          </div>
          <div>
            <label className={LABEL}>
              Mensaje inicial (primera solicitud)
              <span className="ml-2 text-gray-400 font-normal">Variables: {'{nombre}'}, {'{link}'}</span>
            </label>
            <textarea className={INPUT} rows={3} value={settings.whatsappTemplate ?? ''}
              onChange={e => set('whatsappTemplate', e.target.value)} />
          </div>
          <div>
            <label className={LABEL}>
              Mensaje de recordatorio
              <span className="ml-2 text-gray-400 font-normal">Variables: {'{nombre}'}, {'{link}'}</span>
            </label>
            <textarea className={INPUT} rows={3} value={settings.whatsappReminderTemplate ?? ''}
              onChange={e => set('whatsappReminderTemplate', e.target.value)} />
          </div>
          <div className="flex justify-end">
            <SaveBtn saving={savingReview} saved={savedReview} />
          </div>
        </form>
      </div>

      {/* ── Notificaciones por Email ─────────────────────────── */}
      <div className={SECTION}>
        <h2 className={TITLE} style={{ color: '#10253f' }}>📧 Notificaciones por Email</h2>
        <p className="text-xs text-gray-500 mb-1">Recibe alertas automáticas de cumpleaños, renovaciones y pagos pendientes.</p>
        <div className="text-xs mb-4 p-3 rounded-lg" style={{ background: '#f0f9ff', border: '1px solid #bae6fd', color: '#0369a1' }}>
          Para Gmail: Ve a <strong>myaccount.google.com → Seguridad → Contraseñas de aplicaciones</strong> → Genera una para "Correo". Usa esa contraseña aquí, no tu contraseña principal.
        </div>
        <form onSubmit={e => { e.preventDefault(); saveSection(['emailEnabled','leadNotifyEnabled','emailTo','smtpHost','smtpPort','smtpUser','smtpPass'], setSavingEmail, setSavedEmail) }}
          className="space-y-4">
          {/* Toggle */}
          <div className="flex items-center justify-between p-3 rounded-lg" style={{ background: '#f8fafc', border: '1px solid #e2e8f0' }}>
            <div>
              <div className="text-sm font-medium text-gray-800">Activar notificaciones</div>
              <div className="text-xs text-gray-500">Enviar emails automáticos al cargar el dashboard</div>
            </div>
            <button type="button"
              onClick={() => set('emailEnabled', settings.emailEnabled === 'true' ? 'false' : 'true')}
              className="relative inline-flex h-6 w-11 items-center rounded-full transition-colors"
              style={{ background: settings.emailEnabled === 'true' ? '#0891b2' : '#cbd5e1' }}>
              <span className="inline-block h-4 w-4 transform rounded-full bg-white transition-transform shadow"
                style={{ transform: settings.emailEnabled === 'true' ? 'translateX(22px)' : 'translateX(2px)' }} />
            </button>
          </div>

          {/* Aviso inmediato cuando entra un lead por la web */}
          <div className="flex items-center justify-between p-3 rounded-lg" style={{ background: '#f8fafc', border: '1px solid #e2e8f0' }}>
            <div>
              <div className="text-sm font-medium text-gray-800">Avisarme de cada lead nuevo</div>
              <div className="text-xs text-gray-500">Correo al instante cuando alguien deja sus datos en tu página web, con botones para llamar o escribir por WhatsApp</div>
            </div>
            <button type="button"
              onClick={() => set('leadNotifyEnabled', settings.leadNotifyEnabled === 'false' ? 'true' : 'false')}
              className="relative inline-flex h-6 w-11 items-center rounded-full transition-colors"
              style={{ background: settings.leadNotifyEnabled === 'false' ? '#cbd5e1' : '#0891b2' }}>
              <span className="inline-block h-4 w-4 transform rounded-full bg-white transition-transform shadow"
                style={{ transform: settings.leadNotifyEnabled === 'false' ? 'translateX(2px)' : 'translateX(22px)' }} />
            </button>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className={LABEL}>Email del agente (recibe notificaciones)</label>
              <input className={INPUT} type="email" value={settings.emailTo ?? ''} onChange={e => set('emailTo', e.target.value)} placeholder="tu@email.com" />
            </div>
            <div>
              <label className={LABEL}>Usuario Gmail (remitente)</label>
              <input className={INPUT} type="email" value={settings.smtpUser ?? ''} onChange={e => set('smtpUser', e.target.value)} placeholder="tu@gmail.com" />
            </div>
            <div>
              <label className={LABEL}>Contraseña de aplicación Google</label>
              <div className="relative">
                <input className={INPUT + ' pr-16'} type={showSmtpPass ? 'text' : 'password'}
                  value={settings.smtpPass ?? ''} onChange={e => set('smtpPass', e.target.value)} placeholder="xxxx xxxx xxxx xxxx" />
                <button type="button" onClick={() => setShowSmtpPass(v => !v)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-xs font-medium" style={{ color: '#507b88' }}>
                  {showSmtpPass ? '🙈' : '👁'}
                </button>
              </div>
            </div>
            <div>
              <label className={LABEL}>SMTP Host</label>
              <input className={INPUT} value={settings.smtpHost ?? 'smtp.gmail.com'} onChange={e => set('smtpHost', e.target.value)} />
            </div>
            <div>
              <label className={LABEL}>Puerto SMTP</label>
              <input className={INPUT} type="number" value={settings.smtpPort ?? '587'} onChange={e => set('smtpPort', e.target.value)} />
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-3 pt-2">
            <SaveBtn saving={savingEmail} saved={savedEmail} />
            <button type="button" onClick={testEmail} disabled={testingEmail}
              className="px-4 py-2 rounded-lg text-sm font-semibold border transition-all disabled:opacity-50"
              style={{ background: '#f0f9ff', border: '1px solid #0891b2', color: '#0369a1' }}>
              {testingEmail ? 'Enviando...' : '📧 Enviar email de prueba'}
            </button>
            <button type="button" onClick={checkNotifications} disabled={checkingNotif}
              className="px-4 py-2 rounded-lg text-sm font-semibold border transition-all disabled:opacity-50"
              style={{ background: '#f0fdf4', border: '1px solid #10b981', color: '#065f46' }}>
              {checkingNotif ? 'Verificando...' : '🔔 Verificar notificaciones ahora'}
            </button>
          </div>
          {testEmailResult && (
            <div className="text-sm px-3 py-2 rounded-lg" style={{ background: testEmailResult.startsWith('✅') ? '#f0fdf4' : '#fef2f2', color: testEmailResult.startsWith('✅') ? '#065f46' : '#dc2626', border: `1px solid ${testEmailResult.startsWith('✅') ? '#a7f3d0' : '#fca5a5'}` }}>
              {testEmailResult}
            </div>
          )}
          {checkNotifResult && (
            <div className="text-sm px-3 py-2 rounded-lg" style={{ background: '#f0fdf4', color: '#065f46', border: '1px solid #a7f3d0' }}>
              {checkNotifResult}
            </div>
          )}
        </form>
      </div>

      </>)}

      {tab === 'herramientas' && (<>
      {/* ── Valores por defecto de Pólizas ────────────────────── */}
      <div className={SECTION}>
        <h2 className={TITLE} style={{ color: '#10253f' }}>🧮 Calculadora APTC{isOwner ? ' — Niveles de Pobreza (FPL)' : ' y Pólizas'}</h2>
        {isOwner ? (
          <>
            <p className="text-xs text-gray-500 mb-1">
              El gobierno publica nuevos valores FPL cada enero. Actualízalos aquí al inicio de cada año de cobertura.
            </p>
            <a href="https://aspe.hhs.gov/topics/poverty-economic-mobility/poverty-guidelines"
              target="_blank" rel="noopener noreferrer"
              className="text-xs mb-4 inline-block" style={{ color: '#2a6496' }}>
              🔗 Ver valores oficiales HHS →
            </a>
          </>
        ) : (
          <p className="text-xs text-gray-500 mb-4">
            Elige cómo se ordenan los &quot;mejores planes&quot; en la calculadora y define los valores por defecto de las pólizas nuevas.
          </p>
        )}
        <form onSubmit={e => { e.preventDefault(); saveSection(['cmsApiKey','fplYear','fpl1Person','fplPerPerson','aptcMaxPct','bestPlansRankMode','defaultPolicyYear','defaultRenewalDate','defaultExpirationDate','wnCommissionPct'], setSavingPolicy, setSavedPolicy) }}
          className="space-y-4">

          {/* Config de plataforma (CMS API Key + FPL) — SOLO el dueño del CRM */}
          {isOwner && (<>
          {/* CMS API Key */}
          <div className="p-4 rounded-xl" style={{ background: settings.cmsApiKey ? '#d1fae5' : '#fef9c3', border: `1px solid ${settings.cmsApiKey ? '#a7f3d0' : '#fde68a'}` }}>
            <div className="flex items-start gap-3">
              <span className="text-xl">{settings.cmsApiKey ? '✅' : '⚠️'}</span>
              <div className="flex-1">
                <p className="text-sm font-bold" style={{ color: settings.cmsApiKey ? '#065f46' : '#92400e' }}>
                  {settings.cmsApiKey ? 'CMS API Key configurada — datos exactos activos' : 'Sin CMS API Key — la calculadora usa estimados nacionales'}
                </p>
                {!settings.cmsApiKey && (
                  <p className="text-xs mt-1" style={{ color: '#92400e' }}>
                    Obtén tu key GRATIS en{' '}
                    <a href="https://developer.cms.gov/marketplace-api" target="_blank" rel="noopener noreferrer" className="underline font-semibold">
                      developer.cms.gov/marketplace-api
                    </a>
                    {' '}→ "Request API Key" → Llenar formulario → Recibes por email en minutos
                  </p>
                )}
              </div>
            </div>
            <div className="mt-3">
              <label className={LABEL}>CMS Marketplace API Key</label>
              <div className="relative">
                <input
                  className={INPUT + ' pr-16'}
                  type={showPw ? 'text' : 'password'}
                  value={settings.cmsApiKey ?? ''}
                  onChange={e => set('cmsApiKey', e.target.value)}
                  placeholder="Pega aquí tu API Key de CMS"
                />
                <button type="button" onClick={() => setShowPw(v => !v)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-xs font-medium"
                  style={{ color: '#507b88' }}>
                  {showPw ? '🙈' : '👁'}
                </button>
              </div>
            </div>
          </div>

          {/* FPL values */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 p-4 rounded-xl" style={{ background: '#f0f7fb', border: '1px solid #b8d4e8' }}>
            <div>
              <label className={LABEL}>Año del FPL</label>
              <input className={INPUT} value={settings.fplYear ?? '2026'} onChange={e => set('fplYear', e.target.value)} placeholder="2026" />
            </div>
            <div>
              <label className={LABEL}>FPL para 1 persona ($)</label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-gray-400">$</span>
                <input className={INPUT + ' pl-6'} type="number" value={settings.fpl1Person ?? '15650'} onChange={e => set('fpl1Person', e.target.value)} placeholder="15650" />
              </div>
            </div>
            <div>
              <label className={LABEL}>Incremento por persona adicional ($)</label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-gray-400">$</span>
                <input className={INPUT + ' pl-6'} type="number" value={settings.fplPerPerson ?? '5500'} onChange={e => set('fplPerPerson', e.target.value)} placeholder="5500" />
              </div>
            </div>
          </div>
          <div className="text-xs text-gray-400 -mt-2">
            FPL calculado: 1 persona = <strong>${Number(settings.fpl1Person || 15650).toLocaleString()}</strong> · 2 = <strong>${(Number(settings.fpl1Person || 15650) + Number(settings.fplPerPerson || 5500)).toLocaleString()}</strong> · 3 = <strong>${(Number(settings.fpl1Person || 15650) + Number(settings.fplPerPerson || 5500)*2).toLocaleString()}</strong> · 4 = <strong>${(Number(settings.fpl1Person || 15650) + Number(settings.fplPerPerson || 5500)*3).toLocaleString()}</strong>
          </div>
          </>)}

          {/* Best plans ranking mode */}
          <div className="p-4 rounded-xl" style={{ background: '#f8fafc', border: '1px solid #e2e8f0' }}>
            <label className={LABEL}>🏆 Cómo ordenar &quot;Mejores planes&quot; en la Calculadora APTC</label>
            <select className={INPUT} value={settings.bestPlansRankMode ?? 'protection'}
              onChange={e => set('bestPlansRankMode', e.target.value)}>
              <option value="protection">🛡️ Mejor protección financiera (recomendado) — prima + máximo de bolsillo</option>
              <option value="cheapest">💰 Menor costo mensual — el plan más barato primero</option>
            </select>
            <p className="text-xs text-gray-400 mt-1.5">
              {(settings.bestPlansRankMode ?? 'protection') === 'cheapest'
                ? 'Se mostrará primero el plan con el pago mensual más bajo (incluyendo planes a $0/mes), sin importar su deducible o máximo de bolsillo.'
                : 'Se mostrará primero el plan que mejor protege al cliente de gastos médicos grandes — considerando lo que pagaría en el peor caso (prima anual + máximo de bolsillo), no solo el precio mensual.'}
            </p>
          </div>

          {/* Default policy values */}
          <div className="pt-3 border-t border-gray-100">
            <p className="text-xs font-bold uppercase tracking-wide text-gray-400 mb-3">Valores por Defecto — Pólizas ACA</p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className={LABEL}>Año de póliza por defecto</label>
              <input className={INPUT} value={settings.defaultPolicyYear ?? ''} onChange={e => set('defaultPolicyYear', e.target.value)} placeholder="2026" />
            </div>
            <div>
              <label className={LABEL}>Fecha de renovación (MM/DD)</label>
              <input className={INPUT} value={settings.defaultRenewalDate ?? ''} onChange={e => set('defaultRenewalDate', e.target.value)} placeholder="11/15" />
              <p className="text-xs text-gray-400 mt-1">Fecha en que inicia el nuevo período</p>
            </div>
            <div>
              <label className={LABEL}>Vencimiento póliza (MM/DD)</label>
              <input className={INPUT} value={settings.defaultExpirationDate ?? ''} onChange={e => set('defaultExpirationDate', e.target.value)} placeholder="12/31" />
            </div>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2 border-t border-gray-100">
            <div>
              <label className={LABEL}>Comisión Washington National (%)</label>
              <div className="relative">
                <input className={INPUT + ' pr-8'} type="number" min="0" max="100" step="0.1"
                  value={settings.wnCommissionPct ?? '25'} onChange={e => set('wnCommissionPct', e.target.value)} />
                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-sm text-gray-400">%</span>
              </div>
              <p className="text-xs text-gray-400 mt-1">Porcentaje sobre la prima mensual WN</p>
            </div>
          </div>
          <div className="flex justify-end">
            <SaveBtn saving={savingPolicy} saved={savedPolicy} />
          </div>
        </form>
      </div>

      {/* ── Claude AI (Tarjeta de Plan) — SOLO el dueño del CRM ──────── */}
      {isOwner && (
      <div className={SECTION}>
        <h2 className={TITLE} style={{ color: '#10253f' }}>🤖 Claude AI — Generador de Tarjetas</h2>
        <p className="text-xs text-gray-500 mb-4">
          Clave global del CRM: alimenta el generador de tarjetas y el asistente para TODAS las agencias.
          Obtén tu clave en <a href="https://console.anthropic.com" target="_blank" rel="noopener noreferrer" style={{ color: '#305a72' }}>console.anthropic.com</a>
        </p>
        <form onSubmit={e => { e.preventDefault(); saveSection(['anthropicApiKey'], setSavingPolicy, setSavedPolicy) }} className="space-y-4">
          <div className="max-w-md">
            <label className={LABEL}>API Key de Anthropic</label>
            <div className="relative">
              <input
                className={INPUT + ' pr-16'}
                type={showPw ? 'text' : 'password'}
                value={settings.anthropicApiKey ?? ''}
                onChange={e => set('anthropicApiKey', e.target.value)}
                placeholder="sk-ant-api03-..."
              />
              <button type="button" onClick={() => setShowPw(v => !v)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-xs font-medium"
                style={{ color: '#507b88' }}>
                {showPw ? '🙈' : '👁'}
              </button>
            </div>
            {settings.anthropicApiKey && (
              <p className="text-xs text-green-600 mt-1">✓ API Key configurada</p>
            )}
          </div>
          <div className="flex justify-end">
            <SaveBtn saving={savingPolicy} saved={savedPolicy} />
          </div>
        </form>
      </div>
      )}

      </>)}

      {tab === 'cuenta' && (<>
      {/* ── Verificación en dos pasos (2FA) ────────────────────── */}
      <TwoFactorPanel />

      {/* ── Cambiar Contraseña ────────────────────────────────── */}
      <div className={SECTION}>
        <h2 className={TITLE} style={{ color: '#10253f' }}>🔐 Seguridad — Cambiar Contraseña</h2>
        <p className="text-xs text-gray-500 mb-4">La nueva contraseña se guarda de forma segura en la base de datos.</p>
        <form onSubmit={handlePasswordChange} className="space-y-4 max-w-sm">
          <div>
            <label className={LABEL}>Contraseña actual</label>
            <div className="relative">
              <input
                className={INPUT + ' pr-16'}
                type={showPw ? 'text' : 'password'}
                value={currentPw}
                onChange={e => setCurrentPw(e.target.value)}
                required
              />
              <button type="button" onClick={() => setShowPw(v => !v)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-xs font-medium"
                style={{ color: '#507b88' }}>
                {showPw ? '🙈 Ocultar' : '👁 Ver'}
              </button>
            </div>
          </div>
          <div>
            <label className={LABEL}>Nueva contraseña <span className="text-gray-400">(mín. 8 caracteres, con letras y números)</span></label>
            <input className={INPUT} type={showPw ? 'text' : 'password'} value={newPw}
              onChange={e => setNewPw(e.target.value)} required minLength={8} />
          </div>
          <div>
            <label className={LABEL}>Confirmar nueva contraseña</label>
            <input className={INPUT} type={showPw ? 'text' : 'password'} value={confirmPw}
              onChange={e => setConfirmPw(e.target.value)} required minLength={8} />
          </div>
          {pwError && (
            <div className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
              ⚠️ {pwError}
            </div>
          )}
          {pwSuccess && (
            <div className="text-sm text-green-700 bg-green-50 border border-green-200 rounded-lg px-3 py-2">
              ✓ Contraseña actualizada correctamente
            </div>
          )}
          <button type="submit" disabled={savingPw}
            className="px-6 py-2 rounded-lg text-white font-semibold text-sm disabled:opacity-50"
            style={{ background: '#10253f' }}>
            {savingPw ? 'Cambiando...' : 'Cambiar contraseña'}
          </button>
        </form>
      </div>

      </>)}

      {tab === 'integraciones' && (<>
      {/* ── Backup ────────────────────────────────────────────── */}
      <div className={SECTION}>
        <h2 className={TITLE} style={{ color: '#10253f' }}>💾 Respaldo de Datos</h2>
        <p className="text-xs text-gray-500 mb-4">Descarga una copia de seguridad completa de la base de datos.</p>
        <a href="/api/backup" download
          className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-semibold text-white transition-all hover:opacity-90"
          style={{ background: '#305a72' }}>
          💾 Descargar Backup
        </a>
      </div>

      {/* ── Google Calendar ───────────────────────────────────── */}
      <GoogleCalendar />

      {/* ── Entrada de leads desde la web ─────────────────────── */}
      <PublicIntakePanel />

      </>)}

      {tab === 'cuenta' && (<>
      {/* ── Usuarios ──────────────────────────────────────────── */}
      <UserManagement />

      {/* ── Info del sistema ──────────────────────────────────── */}
      <div className="bg-gray-50 rounded-xl border border-gray-200 p-5">
        <h2 className="font-semibold text-sm text-gray-600 mb-3">ℹ️ Información del Sistema</h2>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
          {[
            { label: 'Versión', value: '1.0.0' },
            { label: 'Base de datos', value: 'PostgreSQL (Neon)' },
            { label: 'Framework', value: 'Next.js 16' },
            { label: 'Backup', value: 'Manual (Configuración)' },
          ].map(item => (
            <div key={item.label}>
              <div className="text-xs text-gray-400 uppercase tracking-wide">{item.label}</div>
              <div className="font-medium text-gray-700 mt-0.5">{item.value}</div>
            </div>
          ))}
        </div>
      </div>
      </>)}
        </div>
      </div>
    </div>
  )
}
