'use client'

import { useEffect, useState, useCallback, useRef } from 'react'
import { THEME_DEFAULTS, applyTheme } from '@/lib/utils'

const INPUT = 'w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#507b88] bg-white'
const LABEL = 'block text-xs font-medium text-gray-600 mb-1'
const SECTION = 'bg-white rounded-xl border border-gray-200 p-6'
const TITLE = 'font-bold text-base mb-1'

type Settings = Record<string, string>

// ── User Management Component ─────────────────────────────────────────────────

interface User {
  id: string; email: string; name: string; role: string; active: boolean; createdAt: string
}

const ROLE_META: Record<string, { label: string; bg: string; color: string; avatarBg: string }> = {
  admin:     { label: 'Admin',     bg: '#dbeafe', color: '#1e40af', avatarBg: 'linear-gradient(135deg, #2a6496, #0891b2)' },
  agent:     { label: 'Agente',    bg: '#f1f5f9', color: '#64748b', avatarBg: '#64748b' },
  assistant: { label: 'Asistente', bg: '#fef3c7', color: '#92400e', avatarBg: '#a16207' },
}
function roleMeta(role: string) { return ROLE_META[role] || ROLE_META.agent }

function UserManagement() {
  const [users, setUsers] = useState<User[]>([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [editUser, setEditUser] = useState<User | null>(null)
  const [form, setForm] = useState({ name: '', email: '', password: '', role: 'agent' })
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [showPw, setShowPw] = useState(false)

  const load = useCallback(async () => {
    const res = await fetch('/api/users')
    setUsers(await res.json())
    setLoading(false)
  }, [])

  useEffect(() => { load() }, [load])

  function openCreate() {
    setEditUser(null)
    setForm({ name: '', email: '', password: '', role: 'agent' })
    setError('')
    setShowForm(true)
  }

  function openEdit(u: User) {
    setEditUser(u)
    setForm({ name: u.name, email: u.email, password: '', role: u.role })
    setError('')
    setShowForm(true)
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true)
    setError('')
    try {
      if (editUser) {
        const body: Record<string, string> = { name: form.name, email: form.email, role: form.role }
        if (form.password) body.password = form.password
        const res = await fetch(`/api/users/${editUser.id}`, {
          method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body),
        })
        const data = await res.json()
        if (!res.ok) throw new Error(data.error)
      } else {
        const res = await fetch('/api/users', {
          method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(form),
        })
        const data = await res.json()
        if (!res.ok) throw new Error(data.error)
      }
      setShowForm(false)
      load()
    } catch (err) { setError((err as Error).message) }
    setSaving(false)
  }

  async function toggleActive(u: User) {
    await fetch(`/api/users/${u.id}`, {
      method: 'PUT', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ active: !u.active }),
    })
    load()
  }

  async function deleteUser(u: User) {
    if (!confirm(`¿Eliminar al usuario ${u.name}?`)) return
    const res = await fetch(`/api/users/${u.id}`, { method: 'DELETE' })
    const data = await res.json()
    if (!res.ok) { alert(data.error); return }
    load()
  }

  const canAdd = users.length < 3

  return (
    <div className="bg-white rounded-xl border border-gray-200 p-6">
      <div className="flex items-center justify-between mb-1">
        <h2 className="font-bold text-base" style={{ color: '#10253f' }}>👥 Usuarios del Sistema</h2>
        {canAdd && (
          <button onClick={openCreate}
            className="text-xs px-3 py-1.5 rounded-lg font-semibold text-white"
            style={{ background: '#2a6496' }}>
            + Agregar usuario
          </button>
        )}
      </div>
      <p className="text-xs text-gray-500 mb-5">
        Máximo 3 usuarios. Cada uno tiene su propio email y contraseña para acceder al CRM.
        {users.length >= 3 && <span className="ml-2 font-semibold text-amber-600">Límite alcanzado (3/3)</span>}
      </p>

      {/* Modal */}
      {showForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="bg-white rounded-2xl p-6 w-full max-w-md shadow-2xl">
            <h3 className="font-bold text-lg mb-4" style={{ color: '#10253f' }}>
              {editUser ? `Editar: ${editUser.name}` : 'Nuevo Usuario'}
            </h3>
            <form onSubmit={handleSave} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1">Nombre completo</label>
                <input className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#507b88]"
                  value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} required placeholder="Ej: María García" />
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1">Email (usuario de acceso)</label>
                <input type="email" className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#507b88]"
                  value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))} required placeholder="email@ejemplo.com" />
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1">
                  Contraseña {editUser && <span className="font-normal text-gray-400">(deja vacío para no cambiar)</span>}
                </label>
                <div className="relative">
                  <input type={showPw ? 'text' : 'password'}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm pr-16 focus:outline-none focus:ring-2 focus:ring-[#507b88]"
                    value={form.password} onChange={e => setForm(f => ({ ...f, password: e.target.value }))}
                    required={!editUser} minLength={8} placeholder={editUser ? '(sin cambios)' : 'Mínimo 8 caracteres'} />
                  <button type="button" onClick={() => setShowPw(v => !v)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-xs font-medium" style={{ color: '#507b88' }}>
                    {showPw ? '🙈' : '👁'}
                  </button>
                </div>
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1">Rol</label>
                <select className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#507b88]"
                  value={form.role} onChange={e => setForm(f => ({ ...f, role: e.target.value }))}>
                  <option value="admin">Administrador (acceso completo)</option>
                  <option value="agent">Agente (acceso estándar)</option>
                  <option value="assistant">Asistente (acceso limitado)</option>
                </select>
              </div>
              {error && <div className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">⚠️ {error}</div>}
              <div className="flex gap-2 pt-2">
                <button type="submit" disabled={saving}
                  className="flex-1 py-2 rounded-lg text-white font-semibold text-sm disabled:opacity-50"
                  style={{ background: '#2a6496' }}>
                  {saving ? 'Guardando...' : editUser ? 'Guardar cambios' : 'Crear usuario'}
                </button>
                <button type="button" onClick={() => setShowForm(false)}
                  className="flex-1 py-2 rounded-lg text-sm border border-gray-300 text-gray-600">
                  Cancelar
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Users list */}
      {loading ? (
        <p className="text-sm text-gray-400">Cargando...</p>
      ) : (
        <div className="space-y-3">
          {users.map(u => (
            <div key={u.id} className="flex items-center justify-between p-4 rounded-xl border"
              style={{ borderColor: u.active ? '#e2e8f0' : '#fca5a5', background: u.active ? '#f8fafc' : '#fff5f5' }}>
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full flex items-center justify-center text-sm font-bold text-white shrink-0"
                  style={{ background: roleMeta(u.role).avatarBg }}>
                  {u.name.split(' ').map((n: string) => n[0]).slice(0,2).join('').toUpperCase()}
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-semibold" style={{ color: '#10253f' }}>{u.name}</span>
                    <span className="text-xs px-2 py-0.5 rounded-full font-medium"
                      style={{ background: roleMeta(u.role).bg, color: roleMeta(u.role).color }}>
                      {roleMeta(u.role).label}
                    </span>
                    {!u.active && <span className="text-xs px-2 py-0.5 rounded-full bg-red-100 text-red-600 font-medium">Inactivo</span>}
                  </div>
                  <div className="text-xs text-gray-400 mt-0.5">{u.email}</div>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <button onClick={() => openEdit(u)}
                  className="text-xs px-3 py-1.5 rounded-lg border font-medium transition-colors hover:bg-gray-100"
                  style={{ color: '#334155', borderColor: '#e2e8f0' }}>
                  ✏️ Editar
                </button>
                <button onClick={() => toggleActive(u)}
                  className="text-xs px-3 py-1.5 rounded-lg border font-medium transition-colors"
                  style={{ color: u.active ? '#d97706' : '#059669', borderColor: u.active ? '#fde68a' : '#a7f3d0', background: u.active ? '#fef9c3' : '#d1fae5' }}>
                  {u.active ? '⏸ Desactivar' : '▶ Activar'}
                </button>
                {users.length > 1 && (
                  <button onClick={() => deleteUser(u)}
                    className="text-xs px-2.5 py-1.5 rounded-lg border font-medium transition-colors hover:bg-red-50"
                    style={{ color: '#ef4444', borderColor: '#fca5a5' }}>
                    🗑️
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

function SaveBtn({ saving, saved }: { saving: boolean; saved: boolean }) {
  return (
    <button
      type="submit"
      disabled={saving}
      className="px-6 py-2 rounded-lg text-white font-semibold text-sm disabled:opacity-50 transition-all"
      style={{ background: saved ? '#10b981' : '#10253f' }}
    >
      {saving ? 'Guardando...' : saved ? '✓ Guardado' : 'Guardar cambios'}
    </button>
  )
}

// ── Logo Uploader Component ───────────────────────────────────────────────────

function LogoUploader({ currentUrl, onUploaded }: { currentUrl?: string; onUploaded: (url: string | null) => void }) {
  const [uploading, setUploading] = useState(false)
  const [error, setError] = useState('')
  const [preview, setPreview] = useState<string | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  const displayUrl = preview || (currentUrl && !currentUrl.startsWith('undefined') ? currentUrl : null)

  async function handleFile(file: File) {
    setError('')
    setUploading(true)
    const localPreview = URL.createObjectURL(file)
    setPreview(localPreview)

    const fd = new FormData()
    fd.append('logo', file)
    const res = await fetch('/api/settings/logo', { method: 'POST', body: fd })
    const data = await res.json()
    setUploading(false)

    if (!res.ok) {
      setError(data.error || 'Error al subir')
      setPreview(null)
      return
    }
    onUploaded(data.logoUrl)
  }

  async function removeLogo() {
    if (!confirm('¿Eliminar el logo? Se mostrará el texto por defecto.')) return
    await fetch('/api/settings/logo', { method: 'DELETE' })
    setPreview(null)
    onUploaded(null)
  }

  return (
    <div className="bg-white rounded-xl border border-gray-200 p-6">
      <h2 className="font-bold text-base mb-1" style={{ color: '#10253f' }}>🖼️ Logo de la Agencia</h2>
      <p className="text-xs text-gray-500 mb-4">
        Aparece en la barra lateral y en la pantalla de inicio de sesión.<br />
        <strong>Recomendado:</strong> PNG con fondo transparente, máximo 400×200 px, menos de 2 MB.
      </p>

      <div className="flex items-start gap-6 flex-wrap">
        {/* Preview */}
        <div className="flex-shrink-0">
          <div className="w-48 h-20 rounded-xl border-2 border-dashed border-gray-200 flex items-center justify-center overflow-hidden"
            style={{ background: '#f8fafc' }}>
            {displayUrl ? (
              <img src={displayUrl} alt="Logo" className="max-w-full max-h-full object-contain p-2" />
            ) : (
              <div className="text-center">
                <div className="text-2xl mb-1">🖼️</div>
                <p className="text-xs text-gray-400">Sin logo</p>
              </div>
            )}
          </div>
          {/* Dark bg preview */}
          {displayUrl && (
            <div className="w-48 h-12 rounded-xl mt-2 flex items-center justify-center overflow-hidden"
              style={{ background: '#0f172a' }}>
              <img src={displayUrl} alt="Logo oscuro" className="max-w-full max-h-full object-contain p-1.5"
                style={{ filter: 'brightness(0) invert(1)' }} />
            </div>
          )}
          {displayUrl && <p className="text-xs text-gray-400 mt-1 text-center">Vista en sidebar</p>}
        </div>

        {/* Upload controls */}
        <div className="flex-1 space-y-3">
          <input ref={inputRef} type="file" accept=".png,.jpg,.jpeg,.webp,.svg" className="hidden"
            onChange={e => { const f = e.target.files?.[0]; if (f) handleFile(f) }} />

          <div
            className="border-2 border-dashed rounded-xl p-5 text-center cursor-pointer transition-all hover:border-[#2a6496] hover:bg-blue-50"
            style={{ borderColor: '#e2e8f0' }}
            onClick={() => inputRef.current?.click()}
            onDragOver={e => { e.preventDefault(); e.currentTarget.style.borderColor = '#2a6496' }}
            onDragLeave={e => { e.currentTarget.style.borderColor = '#e2e8f0' }}
            onDrop={e => { e.preventDefault(); const f = e.dataTransfer.files[0]; if (f) handleFile(f) }}>
            {uploading ? (
              <p className="text-sm text-gray-500">⏳ Subiendo logo...</p>
            ) : (
              <>
                <p className="text-sm font-medium text-gray-700">
                  Arrastra tu logo aquí o <span style={{ color: '#2a6496' }}>haz clic para seleccionar</span>
                </p>
                <p className="text-xs text-gray-400 mt-1">PNG recomendado · máx. 2 MB</p>
              </>
            )}
          </div>

          {error && <p className="text-sm text-red-600">⚠️ {error}</p>}

          {displayUrl && !uploading && (
            <button onClick={removeLogo} type="button"
              className="text-xs text-red-500 hover:text-red-700 underline">
              🗑️ Eliminar logo
            </button>
          )}

          <div className="text-xs text-gray-400 space-y-1">
            <p>✅ <strong>PNG con fondo transparente</strong> — se ve bien en fondo oscuro y claro</p>
            <p>✅ Tamaño ideal: 400×120 px o similar (proporción horizontal)</p>
            <p>✅ Si tu logo es oscuro, el sistema lo invierte automáticamente para el sidebar</p>
          </div>
        </div>
      </div>
    </div>
  )
}

// ── Color / Theme Customizer ──────────────────────────────────────────────────

const THEME_COLOR_FIELDS: { key: keyof typeof THEME_DEFAULTS; label: string; desc: string }[] = [
  { key: 'themeBrand800', label: 'Color Primario', desc: 'Menú lateral y botones principales' },
  { key: 'themeBrand500', label: 'Color Secundario', desc: 'Degradados, enlaces y acentos' },
  { key: 'themeBrand300', label: 'Color Claro', desc: 'Detalles y textos sobre fondo oscuro' },
  { key: 'themeAccent', label: 'Color de Acento', desc: 'Botones destacados (ej. "+ Nuevo Cliente")' },
]

function ColorSettings({ settings, set, onSave }: {
  settings: Settings
  set: (key: string, value: string) => void
  onSave: (overrides?: Record<string, string>) => Promise<void>
}) {
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)

  // Returns a guaranteed-valid 6-digit hex for a given field — used for the
  // color swatch, live preview and applyTheme (which all require a real hex).
  const validColor = (key: keyof typeof THEME_DEFAULTS) =>
    (settings[key] && /^#[0-9a-fA-F]{6}$/.test(settings[key])) ? settings[key] : THEME_DEFAULTS[key]

  async function handleSave(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true)
    await onSave()
    // Apply immediately so the user sees the result without reloading
    const theme: Record<string, string> = {}
    THEME_COLOR_FIELDS.forEach(f => { theme[f.key] = validColor(f.key) })
    applyTheme(theme)
    setSaving(false)
    setSaved(true)
    setTimeout(() => setSaved(false), 3000)
  }

  async function reset() {
    setSaving(true)
    THEME_COLOR_FIELDS.forEach(f => set(f.key, THEME_DEFAULTS[f.key]))
    // Apply immediately and persist — pass the defaults explicitly since the
    // `settings` state above won't reflect the just-applied changes yet.
    applyTheme(THEME_DEFAULTS)
    await onSave(THEME_DEFAULTS)
    setSaving(false)
    setSaved(true)
    setTimeout(() => setSaved(false), 3000)
  }

  return (
    <div className={SECTION}>
      <h2 className={TITLE} style={{ color: '#10253f' }}>🎨 Colores del Sistema</h2>
      <p className="text-xs text-gray-500 mb-4">
        Personaliza la paleta de colores de tu CRM. Los cambios se aplican a toda la plataforma (menú lateral, botones, dashboard, login).
      </p>
      <form onSubmit={handleSave} className="space-y-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {THEME_COLOR_FIELDS.map(f => {
            // The color swatch needs a valid 6-digit hex at all times, but the
            // text field should reflect exactly what the user is typing —
            // gating it through the regex caused the value to snap back to
            // the default on every keystroke of an in-progress hex code.
            const swatchValue = validColor(f.key)
            const textValue = settings[f.key] ?? THEME_DEFAULTS[f.key]
            return (
              <div key={f.key}>
                <label className={LABEL}>{f.label}</label>
                <p className="text-xs text-gray-400 mb-1.5 leading-tight">{f.desc}</p>
                <div className="flex items-center gap-2">
                  <input
                    type="color"
                    value={swatchValue}
                    onChange={e => set(f.key, e.target.value)}
                    className="w-10 h-10 rounded-lg border border-gray-300 cursor-pointer p-1 bg-white shrink-0"
                  />
                  <input
                    type="text"
                    value={textValue}
                    onChange={e => set(f.key, e.target.value)}
                    maxLength={7}
                    className={INPUT + ' font-mono text-xs uppercase'}
                  />
                </div>
              </div>
            )
          })}
        </div>

        {/* Live preview */}
        <div className="rounded-xl p-4 flex items-center gap-3 flex-wrap"
          style={{ background: validColor('themeBrand800') }}>
          <div className="px-3 py-1.5 rounded-lg text-xs font-bold"
            style={{ background: `linear-gradient(135deg, ${validColor('themeBrand500')}, ${validColor('themeBrand300')})`, color: validColor('themeBrand800') }}>
            Botón principal
          </div>
          <div className="px-3 py-1.5 rounded-lg text-xs font-bold"
            style={{ background: validColor('themeAccent'), color: validColor('themeBrand800') }}>
            + Nuevo Cliente
          </div>
          <span className="text-xs font-medium" style={{ color: validColor('themeBrand300') }}>
            Vista previa en vivo
          </span>
        </div>

        <div className="flex items-center justify-between pt-1">
          <button type="button" onClick={reset} disabled={saving} className="text-xs font-medium text-gray-500 hover:text-gray-700 underline disabled:opacity-50">
            Restaurar colores por defecto
          </button>
          <SaveBtn saving={saving} saved={saved} />
        </div>
      </form>
    </div>
  )
}

export default function SettingsPage() {
  const [settings, setSettings] = useState<Settings>({})
  const [loading, setLoading] = useState(true)

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

  const load = useCallback(async () => {
    const res = await fetch('/api/settings')
    const data = await res.json()
    setSettings(data)
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

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold" style={{ color: '#10253f' }}>Configuración</h1>
        <p className="text-sm text-gray-500 mt-1">Personaliza tu CRM desde aquí sin tocar ningún archivo</p>
      </div>

      {/* ── Logo de la Agencia ───────────────────────────────── */}
      <LogoUploader currentUrl={settings.logoUrl} onUploaded={url => set('logoUrl', url || '')} />

      {/* ── Colores del Sistema ───────────────────────────────── */}
      <ColorSettings settings={settings} set={set} onSave={(overrides) => saveSection(['themeBrand800','themeBrand500','themeBrand300','themeAccent'], () => {}, () => {}, overrides)} />

      {/* ── Perfil del Agente ─────────────────────────────────── */}
      <div className={SECTION}>
        <h2 className={TITLE} style={{ color: '#10253f' }}>👤 Perfil del Agente</h2>
        <p className="text-xs text-gray-500 mb-4">Tu información aparece en reportes y documentos exportados.</p>
        <form onSubmit={e => { e.preventDefault(); saveSection(['agentName','agentPhone','agentWhatsApp','agentEmail','agentLicense','healthSherpaConsentUrl'], setSavingProfile, setSavedProfile) }}
          className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className={LABEL}>Nombre completo</label>
              <input className={INPUT} value={settings.agentName ?? ''} onChange={e => set('agentName', e.target.value)} placeholder="Omar Mendoza" />
            </div>
            <div>
              <label className={LABEL}>Teléfono / Llamadas</label>
              <input className={INPUT} value={settings.agentPhone ?? ''} onChange={e => set('agentPhone', e.target.value)} placeholder="(407)-436-4366" />
            </div>
            <div>
              <label className={LABEL}>
                WhatsApp Business
                <span className="ml-2 text-gray-400 font-normal text-xs">Solo dígitos con código de país</span>
              </label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm">💬</span>
                <input className={INPUT + ' pl-8'} value={settings.agentWhatsApp ?? ''} onChange={e => set('agentWhatsApp', e.target.value.replace(/\D/g,''))} placeholder="14074364366" />
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
        <form onSubmit={e => { e.preventDefault(); saveSection(['emailEnabled','emailTo','smtpHost','smtpPort','smtpUser','smtpPass'], setSavingEmail, setSavedEmail) }}
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

      {/* ── Valores por defecto de Pólizas ────────────────────── */}
      <div className={SECTION}>
        <h2 className={TITLE} style={{ color: '#10253f' }}>🧮 Calculadora APTC — Niveles de Pobreza (FPL)</h2>
        <p className="text-xs text-gray-500 mb-1">
          El gobierno publica nuevos valores FPL cada enero. Actualízalos aquí al inicio de cada año de cobertura.
        </p>
        <a href="https://aspe.hhs.gov/topics/poverty-economic-mobility/poverty-guidelines"
          target="_blank" rel="noopener noreferrer"
          className="text-xs mb-4 inline-block" style={{ color: '#2a6496' }}>
          🔗 Ver valores oficiales HHS →
        </a>
        <form onSubmit={e => { e.preventDefault(); saveSection(['cmsApiKey','fplYear','fpl1Person','fplPerPerson','aptcMaxPct','bestPlansRankMode','defaultPolicyYear','defaultRenewalDate','defaultExpirationDate','wnCommissionPct'], setSavingPolicy, setSavedPolicy) }}
          className="space-y-4">

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

      {/* ── Claude AI (Tarjeta de Plan) ──────────────────────── */}
      <div className={SECTION}>
        <h2 className={TITLE} style={{ color: '#10253f' }}>🤖 Claude AI — Generador de Tarjetas</h2>
        <p className="text-xs text-gray-500 mb-4">
          Necesario para extraer información del brochure PDF automáticamente.
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
            <label className={LABEL}>Nueva contraseña <span className="text-gray-400">(mínimo 8 caracteres)</span></label>
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

      {/* ── Usuarios ──────────────────────────────────────────── */}
      <UserManagement />

      {/* ── Info del sistema ──────────────────────────────────── */}
      <div className="bg-gray-50 rounded-xl border border-gray-200 p-5">
        <h2 className="font-semibold text-sm text-gray-600 mb-3">ℹ️ Información del Sistema</h2>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
          {[
            { label: 'Versión', value: '1.0.0' },
            { label: 'Base de datos', value: 'SQLite (local)' },
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
    </div>
  )
}
