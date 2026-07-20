'use client'

import { useState, useRef, useCallback, useEffect, Suspense } from 'react'
import { useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { normalizeInsurer } from '@/lib/normalizeInsurer'

// ── Types ─────────────────────────────────────────────────────────────────────

interface CardData {
  co: string; pname: string; cat: string; net: string; ref: string
  date: string; endDate: string; cost: string
  ded: string; oop: string; hosp: string
  pcp: string; spec: string; uc: string
  xray: string; ct: string; lab: string; rx: string
}

// Marca de la agencia para la tarjeta (white-label): logo/nombre, web y colores.
// Se llenan desde la Configuración de cada agencia.
interface Brand {
  name: string
  logoSrc: string   // data URL del logo (vacío si la agencia no tiene logo)
  website: string
  headerColor: string
  accentColor: string
}

const DEFAULT_BRAND: Brand = {
  name: 'Tu Asesor de Seguros', logoSrc: '', website: '',
  headerColor: '#0D2A4A', accentColor: '#F0C040',
}

// ── Language strings ─────────────────────────────────────────────────────────

const T = {
  es: {
    advisor:'Tu Asesor de Seguros', coverage:'Vigencia', from:'Desde', to:'Hasta', perMonth:'/ mes',
    secVisit:'Costos de Visita', secMeds:'Medicamentos', secDiag:'Diagnósticos e Imágenes',
    secDed:'Deducible y Límites', secNet:'Red de Proveedores', secHosp:'Hospitalización',
    pcp:'Médico Primario (PCP)', spec:'Especialista', uc:'Urgent Care', rx:'Genéricos (Tier 1)',
    xray:'Rayos X', ct:'CT / PET Scans / MRI', lab:'Laboratorios',
    ded:'Deducible', oop:'Máx. de Bolsillo', netType:'Tipo de Red',
    referral:'Referido para Especialista', coins:'Coaseguro', plan:'Plan',
    disclaimer:'Este documento no es tu tarjeta de seguro médico. Es un resumen de los beneficios del plan de salud que adquiriste.',
    footerText:'Para agendar una cita con tu médico visita',
  },
  en: {
    advisor:'Your Insurance Advisor', coverage:'Coverage', from:'From', to:'To', perMonth:'/ month',
    secVisit:'Visit Costs', secMeds:'Medications', secDiag:'Diagnostics & Imaging',
    secDed:'Deductible & Limits', secNet:'Provider Network', secHosp:'Hospitalization',
    pcp:'Primary Care (PCP)', spec:'Specialist', uc:'Urgent Care', rx:'Generics (Tier 1)',
    xray:'X-Rays', ct:'CT / PET Scans / MRI', lab:'Labs',
    ded:'Deductible', oop:'Max. Out-of-Pocket', netType:'Network Type',
    referral:'Referral Required', coins:'Coinsurance', plan:'Plan',
    disclaimer:'This document is not your insurance card. It is a summary of the benefits of the health plan you enrolled in.',
    footerText:'To schedule an appointment with your doctor visit',
  },
}

// ── Card HTML builder (inline styles for html2canvas compatibility) ────────────

function esc(s?: string | null) {
  if (!s) return ''
  return s.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;')
}

// Formato de fecha MM/DD/YY (a partir de un ISO YYYY-MM-DD).
function fmtMDY(iso: string) {
  if (!iso || iso.length < 10) return ''
  const [y, m, day] = iso.split('-')
  return `${m}/${day}/${y.slice(2)}`
}

function buildCardHTML(d: CardData, lang: 'es'|'en', brand: Brand, scale=1): string {
  const S = (n: number) => `${n * scale}px`
  const L = T[lang]
  const catBg: Record<string,string> = { Bronze:'#CD7F32', Silver:'#64748B', Gold:'#D97706', Platinum:'#4F46E5', Catastrophic:'#DC2626' }
  const badge = catBg[d.cat] || '#10253f'
  const W = 900 * scale
  const header = brand.headerColor || '#0D2A4A'
  const accent = brand.accentColor || '#F0C040'
  // Vigencia: "Desde MM/DD/YY Hasta MM/DD/YY" (el fin ya no está fijo a 2026).
  const vig = d.date
    ? `${L.from} ${fmtMDY(d.date)}${d.endDate ? ` ${L.to} ${fmtMDY(d.endDate)}` : ''}`
    : ''

  const row = (lbl: string, val: string) => `
    <div style="display:flex;justify-content:space-between;align-items:center;padding:${S(5)} 0;border-bottom:1px solid #EEF2F7;font-family:Poppins,sans-serif;">
      <span style="font-size:${S(12)};color:#4A6080;font-weight:500;">${lbl}</span>
      <span style="font-size:${S(13)};color:#0D2A4A;font-weight:700;text-align:right;max-width:58%;">${val}</span>
    </div>`

  const sec = (title: string) => `
    <div style="font-size:${S(9.5)};font-weight:800;color:#B08A00;text-transform:uppercase;letter-spacing:${S(1.8)};
                margin-bottom:${S(8)};display:flex;align-items:center;gap:${S(6)};font-family:Poppins,sans-serif;">
      <span>${title}</span>
      <span style="flex:1;height:1px;background:#E2E8F0;display:inline-block;"></span>
    </div>`

  // Encabezado: logo de la agencia si existe; si no, su nombre.
  const brandTop = brand.logoSrc
    ? `<img src="${brand.logoSrc}" alt="logo" style="max-height:${S(48)};max-width:${S(240)};object-fit:contain;display:block;" />`
    : `<div style="font-family:Poppins,sans-serif;font-size:${S(22)};font-weight:800;letter-spacing:${S(-0.5)};color:#ffffff;">${esc(brand.name)}</div>
       <div style="color:${accent};font-size:${S(10)};font-weight:600;letter-spacing:${S(1.5)};text-transform:uppercase;font-family:Poppins,sans-serif;margin-top:${S(2)};">${L.advisor}</div>`

  return `
<div style="width:${W}px;font-family:Poppins,sans-serif;background:#ffffff;border-radius:${S(14)};overflow:hidden;box-shadow:0 8px 40px rgba(13,42,74,.22);">
  <div style="background:${header};padding:${S(20)} ${S(30)} ${S(22)};font-family:Poppins,sans-serif;">
    <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:${S(14)};padding-bottom:${S(12)};border-bottom:1px solid rgba(168,192,214,.2);">
      <div style="line-height:1.2;">${brandTop}</div>
      <div style="display:flex;flex-direction:column;align-items:flex-end;gap:${S(5)};">
        ${d.cat ? `<span style="background:${badge};color:#fff;font-size:${S(10)};font-weight:800;padding:${S(3)} ${S(11)};border-radius:999px;letter-spacing:${S(1)};text-transform:uppercase;font-family:Poppins,sans-serif;">${esc(d.cat)} ${L.plan}</span>` : ''}
        ${d.net  ? `<span style="background:rgba(255,255,255,.1);color:#A8C0D6;font-size:${S(10)};font-weight:600;padding:${S(2)} ${S(9)};border-radius:999px;font-family:Poppins,sans-serif;">${esc(d.net)}</span>` : ''}
        ${vig ? `<div style="color:#A8C0D6;font-size:${S(10)};font-family:Poppins,sans-serif;">${L.coverage}: <strong style="color:#fff;">${vig}</strong></div>` : ''}
      </div>
    </div>
    <div>
      <div style="color:#ffffff;font-size:${S(28)};font-weight:800;line-height:1.05;letter-spacing:${S(-0.8)};font-family:Poppins,sans-serif;">${esc(d.co)}</div>
      <div style="color:${accent};font-size:${S(13)};font-weight:500;margin-top:${S(3)};font-family:Poppins,sans-serif;">${esc(d.pname)}</div>
      ${d.cost && d.cost !== 'N/D' ? `<div style="color:${accent};font-size:${S(19)};font-weight:800;margin-top:${S(5)};font-family:Poppins,sans-serif;">${esc(d.cost)} <span style="font-size:${S(11)};font-weight:400;opacity:.7;">${L.perMonth}</span></div>` : ''}
    </div>
  </div>

  <div style="display:grid;grid-template-columns:1fr ${S(1)} 1fr;background:#ffffff;font-family:Poppins,sans-serif;">
    <div style="padding:${S(20)} ${S(26)};">
      <div style="margin-bottom:${S(18)};">${sec(L.secVisit)}${row(L.pcp, d.pcp)}${row(L.spec, d.spec)}${row(L.uc, d.uc)}</div>
      <div style="margin-bottom:${S(18)};">${sec(L.secMeds)}${row(L.rx, d.rx)}</div>
      <div>${sec(L.secDiag)}${row(L.xray, d.xray)}${row(L.ct, d.ct)}${row(L.lab, d.lab)}</div>
    </div>
    <div style="background:#E2E8F0;width:${S(1)};"></div>
    <div style="padding:${S(20)} ${S(26)};">
      <div style="margin-bottom:${S(18)};">${sec(L.secDed)}${row(L.ded, d.ded)}${row(L.oop, d.oop)}</div>
      <div style="margin-bottom:${S(18)};">${sec(L.secNet)}${d.net ? row(L.netType, d.net) : ''}${d.ref ? row(L.referral, d.ref) : ''}</div>
      <div>${sec(L.secHosp)}${row(L.coins, d.hosp)}</div>
    </div>
  </div>

  <div style="background:#F0F4F8;padding:${S(7)} ${S(30)};text-align:center;font-family:Poppins,sans-serif;border-top:1px solid #E2E8F0;">
    <span style="color:#4A6080;font-size:${S(9)};font-style:italic;">${L.disclaimer}</span>
  </div>
  ${brand.website ? `<div style="background:${header};padding:${S(10)} ${S(30)};display:flex;justify-content:center;align-items:center;gap:${S(6)};font-family:Poppins,sans-serif;">
    <span style="color:#A8C0D6;font-size:${S(11)};">${L.footerText}</span>
    <span style="color:${accent};font-size:${S(12)};font-weight:700;">${esc(brand.website)}</span>
  </div>` : ''}
</div>`
}

// ── Step indicator ────────────────────────────────────────────────────────────

function Steps({ step }: { step: number }) {
  const steps = ['Subir PDF', 'Verificar Info', 'Descargar Tarjeta']
  return (
    <div className="flex items-center gap-2 mb-6">
      {steps.map((s, i) => {
        const n = i + 1
        const done = n < step, active = n === step
        return (
          <div key={s} className="flex items-center gap-2 flex-1">
            <div className="flex items-center gap-1.5 whitespace-nowrap">
              <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold shrink-0 ${done ? 'bg-green-500 text-white' : active ? 'text-white' : 'bg-gray-200 text-gray-500'}`}
                style={active ? { background: '#10253f' } : {}}>
                {done ? '✓' : n}
              </div>
              <span className={`text-xs font-medium ${active ? 'text-gray-900' : done ? 'text-green-600' : 'text-gray-400'}`}>{s}</span>
            </div>
            {i < steps.length - 1 && <div className="flex-1 h-0.5 bg-gray-200 mx-1" />}
          </div>
        )
      })}
    </div>
  )
}

// ── Date input — selector nativo con calendario (valor YYYY-MM-DD) ─────────────

function DateFieldMasked({ label, value, onChange, required=false }: {
  label: string; value: string; onChange: (v: string) => void; required?: boolean
}) {
  return (
    <div>
      <label className="block text-xs font-bold uppercase tracking-wide mb-1" style={{ color: '#10253f' }}>
        {label}{required && <span className="ml-1 text-amber-600">★</span>}
      </label>
      <input
        type="date"
        value={value || ''}
        onChange={e => onChange(e.target.value)}
        className="w-full border-2 border-gray-200 rounded-lg px-3 py-2 text-sm outline-none focus:border-[#305a72] transition-colors"
      />
    </div>
  )
}

// ── Field component ───────────────────────────────────────────────────────────

function Field({ label, id, value, onChange, type='text', placeholder='', required=false, filled=false }: {
  label: string; id: string; value: string; onChange: (v: string) => void
  type?: string; placeholder?: string; required?: boolean; filled?: boolean
}) {
  return (
    <div>
      <label className="block text-xs font-bold uppercase tracking-wide mb-1" style={{ color: '#10253f' }}>
        {label}{required && <span className="ml-1 text-amber-600">★</span>}
      </label>
      <input
        type={type} value={value} onChange={e => onChange(e.target.value)}
        placeholder={placeholder}
        className={`w-full border-2 rounded-lg px-3 py-2 text-sm outline-none transition-colors ${filled ? 'border-blue-200 bg-blue-50' : 'border-gray-200'} focus:border-[#305a72]`}
      />
    </div>
  )
}

function SelectF({ label, id, value, onChange, options }: {
  label: string; id: string; value: string; onChange: (v: string) => void; options: string[]
}) {
  return (
    <div>
      <label className="block text-xs font-bold uppercase tracking-wide mb-1" style={{ color: '#10253f' }}>{label}</label>
      <select value={value} onChange={e => onChange(e.target.value)}
        className="w-full border-2 border-gray-200 rounded-lg px-3 py-2 text-sm outline-none focus:border-[#305a72] bg-white">
        <option value="">-- Seleccionar --</option>
        {options.map(o => <option key={o}>{o}</option>)}
      </select>
    </div>
  )
}

// ── Main component (inner — needs useSearchParams) ────────────────────────────

function TarjetaInner() {
  const searchParams = useSearchParams()
  const clientId = searchParams.get('clientId')
  const clientName = searchParams.get('clientName') || ''

  const [step, setStep] = useState(1)
  const [processing, setProcessing] = useState(false)
  const [procMsg, setProcMsg] = useState('')
  const [lang, setLang] = useState<'es'|'en'>('es')
  const [filledFields, setFilledFields] = useState<Set<string>>(new Set())
  const [saving, setSaving] = useState(false)
  const [savedMsg, setSavedMsg] = useState('')
  const [error, setError] = useState('')

  const fileRef = useRef<HTMLInputElement>(null)
  const previewRef = useRef<HTMLDivElement>(null)
  // PNG pre-generado (para que "Enviar por WhatsApp" comparta dentro del gesto).
  const cardBlobRef = useRef<Blob | null>(null)

  const [form, setForm] = useState<CardData>({
    co: '', pname: '', cat: '', net: '', ref: '', date: '', endDate: '', cost: '',
    ded: 'N/D', oop: 'N/D', hosp: 'N/D',
    pcp: 'N/D', spec: 'N/D', uc: 'N/D',
    xray: 'N/D', ct: 'N/D', lab: 'N/D', rx: 'N/D',
  })

  const setF = useCallback((key: keyof CardData) => (v: string) =>
    setForm(f => ({ ...f, [key]: v })), [])

  // Marca de la agencia para la tarjeta (logo, nombre, web, colores) — white-label.
  const [brand, setBrand] = useState<Brand>(DEFAULT_BRAND)
  // Teléfono del cliente (si venimos desde su ficha) para enviar por WhatsApp.
  const [clientPhone, setClientPhone] = useState('')

  useEffect(() => {
    fetch('/api/settings').then(r => r.json()).then(async (s) => {
      // Si la agencia tiene logo, lo traemos como data URL (fiable para html2canvas).
      let logoSrc = ''
      if (s.agencyId) {
        try {
          const lr = await fetch(`/api/logo/${s.agencyId}`)
          if (lr.ok) {
            const blob = await lr.blob()
            logoSrc = await new Promise<string>(res => {
              const fr = new FileReader(); fr.onload = () => res(fr.result as string); fr.readAsDataURL(blob)
            })
          }
        } catch { /* sin logo → se usa el nombre */ }
      }
      setBrand({
        name: s.agentName || 'Tu Asesor de Seguros',
        logoSrc,
        website: s.cardWebsite || '',
        headerColor: s.cardHeaderColor || '#0D2A4A',
        accentColor: s.cardAccentColor || '#F0C040',
      })
    }).catch(() => {})
  }, [])

  // Trae el teléfono del cliente para el botón de WhatsApp (si aplica).
  useEffect(() => {
    if (!clientId) return
    fetch(`/api/clients/${clientId}`).then(r => r.json()).then(c => {
      if (c?.phone) setClientPhone(String(c.phone))
    }).catch(() => {})
  }, [clientId])

  // Vigencia: al fijar la fecha de inicio, sugiere el fin al 31/dic de ese año
  // (solo si el usuario no ha puesto una fecha de fin propia).
  const setStartDate = useCallback((v: string) =>
    setForm(f => ({ ...f, date: v, endDate: f.endDate || (v ? `${v.slice(0, 4)}-12-31` : '') })), [])

  // ── Read PDF text client-side ──────────────────────────────────────────────
  async function readPDF(file: File): Promise<string> {
    return new Promise((resolve, reject) => {
      const script = document.getElementById('pdfjs-script')
      if (!script) {
        const s = document.createElement('script')
        s.id = 'pdfjs-script'
        s.src = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js'
        s.onload = () => extractText(file, resolve, reject)
        s.onerror = () => reject(new Error('No se pudo cargar PDF.js'))
        document.head.appendChild(s)
      } else {
        extractText(file, resolve, reject)
      }
    })
  }

  async function extractText(file: File, resolve: (v: string) => void, reject: (e: Error) => void) {
    try {
      // @ts-expect-error — pdf.js loaded from CDN
      const pdfjsLib = window['pdfjs-dist/build/pdf'] || window.pdfjsLib
      if (!pdfjsLib) {
        // Try again after a moment
        setTimeout(() => extractText(file, resolve, reject), 500)
        return
      }
      pdfjsLib.GlobalWorkerOptions.workerSrc =
        'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js'
      const buf = await file.arrayBuffer()
      const pdf = await pdfjsLib.getDocument({ data: buf }).promise
      let out = ''
      for (let p = 1; p <= pdf.numPages; p++) {
        const page = await pdf.getPage(p)
        const tc = await page.getTextContent()
        out += '\n[PAG ' + p + '] ' + (tc.items as { str: string }[]).map(i => i.str).join(' ')
      }
      resolve(out)
    } catch (e) {
      reject(e as Error)
    }
  }

  // ── Process file ──────────────────────────────────────────────────────────
  async function processFile(file: File) {
    if (file.type !== 'application/pdf') { setError('Por favor sube un archivo PDF.'); return }
    setError('')
    setProcessing(true)
    setStep(2)

    try {
      setProcMsg('Leyendo PDF...')
      const text = await readPDF(file)

      setProcMsg('Analizando con Claude AI...')
      const res = await fetch('/api/tarjeta', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pdfText: text }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Error extrayendo datos')

      // Fill form with extracted data
      const filled = new Set<string>()
      const keys = ['co','pname','cat','net','ref','ded','oop','hosp','pcp','spec','uc','xray','ct','lab','rx'] as const
      const newForm = { ...form }
      keys.forEach(k => {
        if (data[k]) { newForm[k] = data[k]; filled.add(k) }
      })
      setForm(newForm)
      setFilledFields(filled)
      setProcessing(false)

    } catch (err) {
      setError((err as Error).message)
      setProcessing(false)
      setStep(1)
    }
  }

  // ── Render card into DOM (called from useEffect, after DOM update) ───────────
  const renderCard = useCallback(() => {
    if (!previewRef.current) return
    previewRef.current.innerHTML = buildCardHTML(form, lang, brand, 1)
    requestAnimationFrame(() => {
      if (!previewRef.current) return
      const wrap = previewRef.current.parentElement
      if (!wrap) return
      const avail = wrap.clientWidth - 4
      const sc = Math.min(1, avail / 900)
      previewRef.current.style.transform = `scale(${sc})`
      previewRef.current.style.transformOrigin = 'top left'
      previewRef.current.style.width = '900px'
      const h = previewRef.current.offsetHeight * sc
      wrap.style.height = h + 'px'
    })
  }, [form, lang, brand])

  // Fire renderCard AFTER React updates the DOM (step 3 div is now mounted)
  useEffect(() => {
    if (step === 3) renderCard()
  }, [step, renderCard])

  // Pre-generar el PNG al llegar al paso 3 (y al cambiar idioma/marca). Así el
  // botón de WhatsApp puede compartir la imagen de inmediato, sin un `await`
  // largo que haga que iOS pierda el "gesto de usuario" y bloquee el compartir.
  useEffect(() => {
    if (step !== 3) { cardBlobRef.current = null; return }
    let cancelled = false
    downloadPNG().then(blob => { if (!cancelled) cardBlobRef.current = blob }).catch(() => {})
    return () => { cancelled = true }
    // downloadPNG lee form/lang/brand por closure; re-generamos cuando cambian.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [step, lang, brand, form])

  // ── generateCard: just flip the step; useEffect handles the rest ────────────
  function generateCard() {
    setStep(3)
  }

  // ── Download PNG ──────────────────────────────────────────────────────────
  async function downloadPNG(): Promise<Blob | null> {
    // Load html2canvas if needed
    if (!(window as unknown as Record<string,unknown>)['html2canvas']) {
      await new Promise<void>((res, rej) => {
        const s = document.createElement('script')
        s.src = 'https://cdnjs.cloudflare.com/ajax/libs/html2canvas/1.4.1/html2canvas.min.js'
        s.onload = () => res(); s.onerror = () => rej(new Error('No se pudo cargar html2canvas'))
        document.head.appendChild(s)
      })
    }

    // Load Poppins
    await Promise.all([
      document.fonts.load('300 12px Poppins'), document.fonts.load('400 12px Poppins'),
      document.fonts.load('700 14px Poppins'), document.fonts.load('800 28px Poppins'),
    ])
    await document.fonts.ready

    const tmp = document.createElement('div')
    tmp.style.cssText = 'position:absolute;top:-99999px;left:0;z-index:-1;background:#fff;'
    tmp.innerHTML = buildCardHTML(form, lang, brand, 2)
    document.body.appendChild(tmp)

    await new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r as FrameRequestCallback)))
    await new Promise(r => setTimeout(r, 300))

    // @ts-expect-error — html2canvas from CDN
    const canvas = await window.html2canvas(tmp.firstElementChild, {
      scale: 1, useCORS: true, allowTaint: true,
      backgroundColor: '#ffffff', logging: false,
    })
    document.body.removeChild(tmp)

    return new Promise(resolve => canvas.toBlob(resolve, 'image/png'))
  }

  async function handleDownload() {
    setSaving(true)
    try {
      const blob = await downloadPNG()
      if (!blob) throw new Error('No se pudo generar la imagen')
      const name = `${form.co || 'plan'}-${form.pname || 'tarjeta'}`.replace(/\s+/g,'-').replace(/[^a-zA-Z0-9-]/g,'').toLowerCase()
      const a = document.createElement('a')
      a.download = name + '.png'
      a.href = URL.createObjectURL(blob)
      a.click()
      URL.revokeObjectURL(a.href)
    } catch (e) { setError((e as Error).message) }
    setSaving(false)
  }

  // Enviar la tarjeta al cliente por WhatsApp. En móvil (iPhone) usa la hoja de
  // compartir del sistema para adjuntar la imagen directo al chat; en escritorio
  // descarga el PNG y abre WhatsApp con el mensaje (la imagen se adjunta a mano).
  async function sendWhatsApp() {
    setError('')
    const fileName = `tarjeta-${form.co || 'plan'}.png`.replace(/\s+/g, '-').replace(/[^a-zA-Z0-9-.]/g, '').toLowerCase()
    const saludo = clientName ? `Hola ${clientName}, ` : 'Hola, '
    const msg = `${saludo}aquí está el resumen de tu plan ${form.pname || ''}${form.co ? ` con ${form.co}` : ''}. — ${brand.name}`
    const digits = clientPhone.replace(/\D/g, '')
    const phone = digits.length === 10 ? '1' + digits : digits
    const waUrl = phone.length >= 10
      ? `https://wa.me/${phone}?text=${encodeURIComponent(msg)}`
      : `https://wa.me/?text=${encodeURIComponent(msg)}`

    // Móvil (iPhone): compartir la imagen directo al chat con la hoja del sistema.
    // Usamos el PNG YA generado para no romper el "gesto de usuario" con un await.
    const blob = cardBlobRef.current
    const navShare = navigator as Navigator & { canShare?: (d?: unknown) => boolean }
    if (blob) {
      const file = new File([blob], fileName, { type: 'image/png' })
      if (navShare.canShare && navShare.canShare({ files: [file] })) {
        try {
          await navigator.share({ files: [file], text: msg })
        } catch (e) {
          if ((e as Error).name !== 'AbortError') setError((e as Error).message)
        }
        return
      }
    }

    // Escritorio (o sin soporte de compartir): descargar el PNG y abrir WhatsApp
    // con el mensaje; la imagen se adjunta a mano en el chat.
    const wa = window.open(waUrl, '_blank')   // abrir YA (dentro del gesto) para que no lo bloqueen
    try {
      const b = blob || await downloadPNG()
      if (b) {
        const a = document.createElement('a')
        a.download = fileName; a.href = URL.createObjectURL(b); a.click(); URL.revokeObjectURL(a.href)
      }
      if (!wa) window.location.href = waUrl
      setSavedMsg('📱 Descargamos la tarjeta y abrimos WhatsApp — adjunta la imagen en el chat para enviarla.')
      setTimeout(() => setSavedMsg(''), 10000)
    } catch (e) {
      setError((e as Error).message)
    }
  }

  async function handleSaveToClient() {
    if (!clientId) return
    setSaving(true)
    setSavedMsg('')
    try {
      // 1. Save PNG to documents
      const blob = await downloadPNG()
      if (!blob) throw new Error('No se pudo generar la imagen')
      const fileName = `tarjeta-${form.co || 'plan'}-${form.pname || ''}.png`.replace(/\s+/g,'-').replace(/[^a-zA-Z0-9-.]/g,'').toLowerCase()
      const fd = new FormData()
      fd.append('file', blob, fileName)
      fd.append('category', 'Póliza')
      fd.append('notes', `Tarjeta del plan ${form.pname || ''} — ${form.co || ''}`)
      const docRes = await fetch(`/api/clients/${clientId}/documents`, { method: 'POST', body: fd })
      if (!docRes.ok) { const d = await docRes.json(); throw new Error(d.error || 'Error al guardar imagen') }

      // 2. Update ACA policy fields in client profile
      const patch: Record<string, string | number | null> = {}
      if (form.co)    patch.insurer     = normalizeInsurer(form.co)
      if (form.pname) patch.planName    = form.pname
      if (form.cat)   patch.planCategory = form.cat
      if (form.net)   patch.coverageType = form.net  // store network type in notes or leave it
      if (form.date)  patch.contractDate = form.date
      // Parse cost: "$45/mes" → 45
      if (form.cost && form.cost !== 'N/D') {
        const n = parseFloat(form.cost.replace(/[^0-9.]/g, ''))
        if (!isNaN(n)) patch.acaPrice = n
      }

      if (Object.keys(patch).length > 0) {
        await fetch(`/api/clients/${clientId}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(patch),
        })
      }

      // Build saved message
      const savedFields = [
        form.co && `Aseguradora: ${form.co}`,
        form.pname && `Plan: ${form.pname}`,
        form.cat && `Categoría: ${form.cat}`,
        form.cost && form.cost !== 'N/D' && `Precio: ${form.cost}`,
      ].filter(Boolean).join(' · ')

      setSavedMsg(`✓ Tarjeta e información guardadas en el perfil${savedFields ? ` (${savedFields})` : ''}`)
      setTimeout(() => setSavedMsg(''), 8000)
    } catch (e) { setError((e as Error).message) }
    setSaving(false)
  }

  function printCard() {
    const cardHTML = buildCardHTML(form, lang, brand, 1)
    const win = window.open('', '_blank')
    if (!win) return
    win.document.write(`<!DOCTYPE html><html><head>
      <meta charset="UTF-8"><title>Tarjeta - ${esc(form.pname)}</title>
      <link href="https://fonts.googleapis.com/css2?family=Poppins:wght@300;400;500;600;700;800&display=swap" rel="stylesheet">
      <style>*{box-sizing:border-box;margin:0;padding:0;}body{background:#fff;display:flex;align-items:center;justify-content:center;min-height:100vh;padding:20px;}@media print{@page{size:landscape;margin:0.4in;}body{padding:0;}}</style>
    </head><body>${cardHTML}
    <script>document.fonts.ready.then(()=>{setTimeout(()=>window.print(),400);});<\/script>
    </body></html>`)
    win.document.close()
  }

  const SECTION = 'bg-white rounded-xl border border-gray-200 p-6 mb-4'

  return (
    <div className="max-w-4xl mx-auto">
      <link href="https://fonts.googleapis.com/css2?family=Poppins:wght@300;400;500;600;700;800&display=swap" rel="stylesheet" />

      {/* Header */}
      <div className="flex items-center justify-between mb-6 flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold" style={{ color: '#10253f' }}>🪪 Generador de Tarjeta de Plan</h1>
          <p className="text-sm text-gray-500 mt-0.5">
            Sube el brochure PDF y Claude AI extraerá la información automáticamente
            {clientName && <span className="ml-2 font-medium" style={{ color: '#305a72' }}>· Cliente: {clientName}</span>}
          </p>
        </div>
        {clientId && (
          <Link href={`/clients/${clientId}`}
            className="text-sm px-4 py-2 rounded-lg border border-gray-300 text-gray-600 hover:bg-gray-50">
            ← Volver al cliente
          </Link>
        )}
      </div>

      <Steps step={step} />

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 rounded-xl px-4 py-3 mb-4 text-sm">
          ⚠️ {error}
          {error.includes('API Key') && (
            <Link href="/settings" className="ml-2 underline font-semibold">Ir a Configuración →</Link>
          )}
        </div>
      )}

      {/* STEP 1 — Upload */}
      {step === 1 && !processing && (
        <div className={SECTION}>
          <h2 className="text-lg font-bold mb-1" style={{ color: '#10253f' }}>Subir Brochure PDF</h2>
          <p className="text-sm text-gray-500 mb-4">Sube el brochure del plan de salud. Claude AI extraerá beneficios, copays y costos.</p>

          <div
            className="border-2 border-dashed border-gray-300 rounded-xl p-10 text-center cursor-pointer hover:border-[#507b88] hover:bg-gray-50 transition-all"
            onClick={() => fileRef.current?.click()}
            onDragOver={e => { e.preventDefault(); e.currentTarget.classList.add('border-[#507b88]','bg-gray-50') }}
            onDragLeave={e => e.currentTarget.classList.remove('border-[#507b88]','bg-gray-50')}
            onDrop={e => { e.preventDefault(); const f = e.dataTransfer.files[0]; if (f) processFile(f) }}
          >
            <div className="text-5xl mb-3">📄</div>
            <h3 className="text-base font-semibold mb-1 text-gray-800">Arrastra el brochure PDF aquí</h3>
            <p className="text-sm text-gray-500">o haz clic para seleccionar el archivo — solo .pdf</p>
            <input ref={fileRef} type="file" accept=".pdf" className="hidden"
              onChange={e => { const f = e.target.files?.[0]; if (f) processFile(f) }} />
          </div>

          <p className="text-xs text-gray-400 mt-3 text-center">
            Asegúrate de tener la API Key de Claude configurada en{' '}
            <Link href="/settings" style={{ color: '#305a72' }}>⚙️ Configuración</Link>
          </p>
        </div>
      )}

      {/* Processing spinner */}
      {processing && (
        <div className={SECTION + ' text-center py-10'}>
          <div className="w-12 h-12 border-4 border-gray-200 rounded-full mx-auto mb-4 animate-spin"
            style={{ borderTopColor: '#305a72' }} />
          <h3 className="text-base font-semibold text-gray-800 mb-1">{procMsg}</h3>
          <p className="text-sm text-gray-500">Procesando el brochure con Claude AI...</p>
        </div>
      )}

      {/* STEP 2 — Form */}
      {step === 2 && !processing && (
        <div className={SECTION}>
          <h2 className="text-lg font-bold mb-1" style={{ color: '#10253f' }}>Verificar Información del Plan</h2>
          <p className="text-sm text-gray-500 mb-3">
            Claude extrajo la información del PDF. Los campos en <span className="text-blue-600 font-medium">azul</span> fueron auto-llenados.
            Los campos con <span className="text-amber-600 font-medium">★</span> requieren tu atención.
          </p>
          <div className="bg-blue-50 border-l-4 border-blue-400 rounded-r-lg px-4 py-2.5 text-xs text-blue-800 mb-5">
            Los campos con fondo azul fueron extraídos del PDF. Verifica que sean correctos antes de generar la tarjeta.
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Plan info */}
            <div className="md:col-span-2 text-xs font-bold uppercase tracking-widest text-gray-400 pt-2 border-t border-gray-100">Información del Plan</div>
            <Field label="Aseguradora" id="co" value={form.co} onChange={setF('co')} placeholder="Ej: Oscar, Ambetter..." filled={filledFields.has('co')} />
            <Field label="Nombre del Plan" id="pname" value={form.pname} onChange={setF('pname')} placeholder="Ej: Gold Simple HMO" filled={filledFields.has('pname')} />
            <SelectF label="Categoría" id="cat" value={form.cat} onChange={setF('cat')} options={['Bronze','Silver','Gold','Platinum','Catastrophic']} />
            <SelectF label="Red de Proveedores" id="net" value={form.net} onChange={setF('net')} options={['HMO','PPO','EPO','POS','HDHP']} />
            <SelectF label="Necesita Referido" id="ref" value={form.ref} onChange={setF('ref')} options={['Si','No']} />
            <DateFieldMasked label="Vigencia — Desde ★" value={form.date} onChange={setStartDate} required />
            <DateFieldMasked label="Vigencia — Hasta" value={form.endDate} onChange={setF('endDate')} />

            {/* Costs */}
            <div className="md:col-span-2 text-xs font-bold uppercase tracking-widest text-gray-400 pt-2 border-t border-gray-100">Costos Financieros</div>
            <Field label="Deducible" id="ded" value={form.ded} onChange={setF('ded')} placeholder="$3,200" filled={filledFields.has('ded')} />
            <Field label="Máximo de Bolsillo" id="oop" value={form.oop} onChange={setF('oop')} placeholder="$8,700" filled={filledFields.has('oop')} />
            <Field label="Costo mensual ★" id="cost" value={form.cost} onChange={setF('cost')} placeholder="$45/mes" required />
            <Field label="Coaseguro Hospitalización" id="hosp" value={form.hosp} onChange={setF('hosp')} placeholder="20% tras deducible" filled={filledFields.has('hosp')} />

            {/* Visit */}
            <div className="md:col-span-2 text-xs font-bold uppercase tracking-widest text-gray-400 pt-2 border-t border-gray-100">Costos de Visita</div>
            <Field label="Médico Primario (PCP)" id="pcp" value={form.pcp} onChange={setF('pcp')} placeholder="$0 copay" filled={filledFields.has('pcp')} />
            <Field label="Especialista" id="spec" value={form.spec} onChange={setF('spec')} placeholder="$40 copay" filled={filledFields.has('spec')} />
            <div className="md:col-span-2">
              <Field label="Urgent Care" id="uc" value={form.uc} onChange={setF('uc')} placeholder="$75 copay" filled={filledFields.has('uc')} />
            </div>

            {/* Diagnostics */}
            <div className="md:col-span-2 text-xs font-bold uppercase tracking-widest text-gray-400 pt-2 border-t border-gray-100">Diagnósticos e Imágenes</div>
            <Field label="Rayos X" id="xray" value={form.xray} onChange={setF('xray')} placeholder="$45 copay" filled={filledFields.has('xray')} />
            <Field label="CT / PET / MRI" id="ct" value={form.ct} onChange={setF('ct')} placeholder="20% coaseguro" filled={filledFields.has('ct')} />
            <div className="md:col-span-2">
              <Field label="Laboratorios" id="lab" value={form.lab} onChange={setF('lab')} placeholder="$30 copay" filled={filledFields.has('lab')} />
            </div>

            {/* Meds */}
            <div className="md:col-span-2 text-xs font-bold uppercase tracking-widest text-gray-400 pt-2 border-t border-gray-100">Medicamentos</div>
            <Field label="Genéricos Tier 1" id="rx" value={form.rx} onChange={setF('rx')} placeholder="$3 copay" filled={filledFields.has('rx')} />
          </div>

          <div className="flex gap-3 justify-end mt-6">
            <button onClick={() => { setStep(1); setForm({ co:'',pname:'',cat:'',net:'',ref:'',date:'',endDate:'',cost:'',ded:'N/D',oop:'N/D',hosp:'N/D',pcp:'N/D',spec:'N/D',uc:'N/D',xray:'N/D',ct:'N/D',lab:'N/D',rx:'N/D' }); setFilledFields(new Set()) }}
              className="px-4 py-2 rounded-lg border border-gray-300 text-gray-600 text-sm hover:bg-gray-50">
              ← Subir otro PDF
            </button>
            <button onClick={generateCard}
              className="px-6 py-2 rounded-lg text-white text-sm font-semibold"
              style={{ background: '#10253f' }}>
              Generar Tarjeta →
            </button>
          </div>
        </div>
      )}

      {/* STEP 3 — Preview */}
      {step === 3 && (
        <div className={SECTION}>
          <h2 className="text-lg font-bold mb-1" style={{ color: '#10253f' }}>Tarjeta del Plan Lista ✓</h2>
          <p className="text-sm text-gray-500 mb-4">Envíala al cliente por WhatsApp, descárgala en PNG o imprímela.</p>

          {/* Actions bar */}
          <div className="flex items-center gap-2 mb-5 flex-wrap">
            <button onClick={() => setStep(2)} className="px-4 py-2 rounded-lg border border-gray-300 text-gray-600 text-sm hover:bg-gray-50">
              ← Editar datos
            </button>
            <button onClick={printCard} className="px-4 py-2 rounded-lg text-white text-sm font-semibold"
              style={{ background: '#305a72' }}>
              🖨️ Imprimir
            </button>
            <button onClick={handleDownload} disabled={saving}
              className="px-4 py-2 rounded-lg text-sm font-semibold disabled:opacity-50"
              style={{ background: '#f0c040', color: '#0D2A4A' }}>
              {saving ? 'Generando...' : '⬇️ Descargar PNG'}
            </button>
            <button onClick={sendWhatsApp} disabled={saving}
              className="px-4 py-2 rounded-lg text-white text-sm font-semibold disabled:opacity-50"
              style={{ background: '#25d366' }}>
              {saving ? 'Preparando...' : '📱 Enviar por WhatsApp'}
            </button>

            {/* Save to client */}
            {clientId && (
              <button onClick={handleSaveToClient} disabled={saving}
                className="px-4 py-2 rounded-lg text-white text-sm font-semibold disabled:opacity-50"
                style={{ background: '#10b981' }}>
                {saving ? 'Guardando...' : '💾 Guardar tarjeta + datos en el perfil'}
              </button>
            )}

            {/* Language toggle */}
            <div className="ml-auto flex items-center gap-1 bg-gray-100 rounded-full p-1">
              {(['es','en'] as const).map(l => (
                <button key={l} onClick={() => setLang(l)}
                  className="px-3 py-1 rounded-full text-xs font-bold transition-all"
                  style={lang === l ? { background: '#10253f', color: '#fff' } : { color: '#6b7280' }}>
                  {l.toUpperCase()}
                </button>
              ))}
            </div>
          </div>

          {savedMsg && (
            <div className="bg-green-50 border border-green-200 text-green-700 rounded-xl px-4 py-3 text-sm mb-4">
              <div className="font-semibold">{savedMsg}</div>
              {clientId && (
                <a href={`/clients/${clientId}`}
                  className="inline-flex items-center gap-1 mt-1.5 text-xs underline font-medium"
                  style={{ color: '#059669' }}>
                  Ver ficha del cliente →
                </a>
              )}
            </div>
          )}

          {/* Card preview */}
          <div className="overflow-x-auto relative">
            <div ref={previewRef} className="inline-block" />
          </div>
        </div>
      )}
    </div>
  )
}

// ── Page export (wraps in Suspense for useSearchParams) ───────────────────────

export default function TarjetaPage() {
  return (
    <Suspense fallback={<div className="flex items-center justify-center h-64 text-gray-400">Cargando...</div>}>
      <TarjetaInner />
    </Suspense>
  )
}
