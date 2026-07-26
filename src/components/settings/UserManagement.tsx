'use client'

// Gestión de usuarios del sistema (máx. 3 por agencia) — sección de Configuración.

import { useEffect, useState, useCallback } from 'react'

interface User {
  id: string; email: string; name: string; role: string; active: boolean; createdAt: string
}

const ROLE_META: Record<string, { label: string; bg: string; color: string; avatarBg: string }> = {
  admin:     { label: 'Admin',     bg: '#dbeafe', color: '#1e40af', avatarBg: 'linear-gradient(135deg, #2a6496, #0891b2)' },
  agent:     { label: 'Agente',    bg: '#f1f5f9', color: '#64748b', avatarBg: '#64748b' },
  assistant: { label: 'Asistente', bg: '#fef3c7', color: '#92400e', avatarBg: '#a16207' },
}
function roleMeta(role: string) { return ROLE_META[role] || ROLE_META.agent }

export default function UserManagement() {
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

  // Reinicia el 2FA de un usuario (p. ej. perdió el teléfono): en su próximo
  // inicio de sesión tendrá que registrar el autenticador de nuevo.
  async function reset2fa(u: User) {
    if (!confirm(`¿Reiniciar la verificación en dos pasos de ${u.name}?\n\nTendrá que volver a escanear el código QR la próxima vez que entre.`)) return
    const res = await fetch(`/api/users/${u.id}/reset-2fa`, { method: 'POST' })
    const data = await res.json().catch(() => ({}))
    alert(res.ok ? `✅ Listo. ${u.name} deberá configurar su autenticador al entrar.` : (data.error || 'No se pudo reiniciar.'))
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
    <div className="bg-white rounded-xl border border-gray-200 p-4 md:p-6">
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
                    required={!editUser} minLength={8} placeholder={editUser ? '(sin cambios)' : 'Mín. 8 caracteres, letras y números'} />
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
            <div key={u.id} className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 p-4 rounded-xl border"
              style={{ borderColor: u.active ? '#e2e8f0' : '#fca5a5', background: u.active ? '#f8fafc' : '#fff5f5' }}>
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full flex items-center justify-center text-sm font-bold text-white shrink-0"
                  style={{ background: roleMeta(u.role).avatarBg }}>
                  {u.name.split(' ').map((n: string) => n[0]).slice(0,2).join('').toUpperCase()}
                </div>
                <div>
                  <div className="flex items-center flex-wrap gap-2">
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
              <div className="flex flex-wrap gap-2">
                <button onClick={() => openEdit(u)}
                  className="flex-1 sm:flex-none text-xs px-3 py-2 rounded-lg border font-medium transition-colors hover:bg-gray-100"
                  style={{ color: '#334155', borderColor: '#e2e8f0' }}>
                  ✏️ Editar
                </button>
                <button onClick={() => toggleActive(u)}
                  className="flex-1 sm:flex-none text-xs px-3 py-2 rounded-lg border font-medium transition-colors"
                  style={{ color: u.active ? '#d97706' : '#059669', borderColor: u.active ? '#fde68a' : '#a7f3d0', background: u.active ? '#fef9c3' : '#d1fae5' }}>
                  {u.active ? '⏸ Desactivar' : '▶ Activar'}
                </button>
                <button onClick={() => reset2fa(u)} title="Reiniciar verificación en dos pasos (perdió el teléfono)"
                  className="flex-1 sm:flex-none text-xs px-3 py-2 rounded-lg border font-medium transition-colors hover:bg-purple-50"
                  style={{ color: '#7c3aed', borderColor: '#ddd6fe' }}>
                  🔐 Reiniciar 2FA
                </button>
                {users.length > 1 && (
                  <button onClick={() => deleteUser(u)}
                    className="text-xs px-3 py-2 rounded-lg border font-medium transition-colors hover:bg-red-50"
                    style={{ color: '#ef4444', borderColor: '#fca5a5' }}>
                    🗑️ Eliminar
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
