'use client'

// Personalización de la paleta de colores del CRM — sección de Configuración.

import { useState } from 'react'
import { THEME_DEFAULTS, applyTheme } from '@/lib/utils'
import { INPUT, LABEL, SECTION, TITLE, SaveBtn, type Settings } from './shared'

const THEME_COLOR_FIELDS: { key: keyof typeof THEME_DEFAULTS; label: string; desc: string }[] = [
  { key: 'themeBrand800', label: 'Color Primario', desc: 'Menú lateral y botones principales' },
  { key: 'themeBrand500', label: 'Color Secundario', desc: 'Degradados, enlaces y acentos' },
  { key: 'themeBrand300', label: 'Color Claro', desc: 'Detalles y textos sobre fondo oscuro' },
  { key: 'themeAccent', label: 'Color de Acento', desc: 'Botones destacados (ej. "+ Nuevo Cliente")' },
]

export default function ColorSettings({ settings, set, onSave }: {
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
