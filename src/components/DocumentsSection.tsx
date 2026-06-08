'use client'

import { useState, useRef, useCallback } from 'react'
import { normalizeInsurer, wasNormalized } from '@/lib/normalizeInsurer'

const CATEGORIES = [
  { value: 'Identificación',         icon: '🪪', color: '#3b82f6', bg: '#dbeafe' },
  { value: 'Licencia de Conducir',   icon: '🚗', color: '#2563eb', bg: '#eff6ff' },
  { value: 'SSN Card',               icon: '🔐', color: '#7c3aed', bg: '#ede9fe' },
  { value: 'Carta de Elegibilidad',  icon: '✅', color: '#059669', bg: '#d1fae5' },
  { value: 'Carta de Consentimiento',icon: '✍️', color: '#0891b2', bg: '#cffafe' },
  { value: 'Póliza',                 icon: '📄', color: '#10b981', bg: '#d1fae5' },
  { value: 'Formulario',             icon: '📝', color: '#8b5cf6', bg: '#ede9fe' },
  { value: 'Carta',                  icon: '✉️', color: '#f59e0b', bg: '#fef3c7' },
  { value: 'Foto',                   icon: '🖼️', color: '#ec4899', bg: '#fce7f3' },
  { value: 'Banco',                  icon: '🏦', color: '#f97316', bg: '#ffedd5' },
  { value: 'Otro',                   icon: '📎', color: '#6b7280', bg: '#f3f4f6' },
]

function getCat(value: string) {
  return CATEGORIES.find(c => c.value === value) ?? CATEGORIES[CATEGORIES.length - 1]
}

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

interface Doc {
  id: string; fileName: string; fileSize: number; mimeType: string
  category: string; notes?: string | null; uploadedAt: string
}

interface ExtractedFields {
  insurer?: string; planName?: string; planCategory?: string
  planId?: string; acaPrice?: string; ded?: string; oop?: string
  hosp?: string; pcp?: string; spec?: string; uc?: string
  xray?: string; ct?: string; lab?: string; rx?: string; net?: string; ref?: string
}

// Map of extracted field → client field + label
const FIELD_MAP: { key: keyof ExtractedFields; clientKey: string; label: string; group: string }[] = [
  { key: 'insurer',       clientKey: 'insurer',       label: 'Aseguradora',               group: 'plan' },
  { key: 'planName',      clientKey: 'planName',      label: 'Nombre del Plan',           group: 'plan' },
  { key: 'planCategory',  clientKey: 'planCategory',  label: 'Categoría del Plan',        group: 'plan' },
  { key: 'net',           clientKey: 'planNetwork',   label: 'Tipo de Red',               group: 'plan' },
  { key: 'ref',           clientKey: 'planReferral',  label: 'Referido para Especialista',group: 'plan' },
  { key: 'ded',           clientKey: 'planDeductible',label: 'Deducible',                 group: 'costs' },
  { key: 'oop',           clientKey: 'planMaxOOP',    label: 'Máx. de Bolsillo',          group: 'costs' },
  { key: 'pcp',           clientKey: 'planPCP',       label: 'Médico Primario (PCP)',      group: 'visits' },
  { key: 'spec',          clientKey: 'planSpecialist',label: 'Especialista',               group: 'visits' },
  { key: 'uc',            clientKey: 'planUrgentCare',label: 'Urgent Care',                group: 'visits' },
  { key: 'hosp',          clientKey: 'planHospital',  label: 'Hospitalización',            group: 'visits' },
  { key: 'rx',            clientKey: 'planRxGeneric', label: 'Medicamentos Genéricos',     group: 'meds' },
  { key: 'xray',          clientKey: 'planXray',      label: 'Rayos X',                   group: 'diag' },
  { key: 'ct',            clientKey: 'planCTScan',    label: 'CT / PET Scans / MRI',      group: 'diag' },
  { key: 'lab',           clientKey: 'planLab',       label: 'Laboratorios',              group: 'diag' },
]

const GROUP_LABELS: Record<string,string> = {
  plan: '📋 Información del Plan',
  costs: '💰 Costos Financieros',
  visits: '🏥 Costos de Visita',
  meds: '💊 Medicamentos',
  diag: '🔬 Diagnósticos e Imágenes',
}

interface Props {
  clientId: string
  onClientUpdated?: () => void
}

// ── PDF text extraction via pdf.js (CDN) ──────────────────────────────────────

async function extractPdfText(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    // Load pdf.js if not already loaded
    const existing = document.getElementById('pdfjs-cdn')
    const doExtract = async () => {
      try {
        // @ts-expect-error — pdf.js from CDN
        const lib = window['pdfjs-dist/build/pdf'] || window.pdfjsLib
        if (!lib) { setTimeout(doExtract, 500); return }
        lib.GlobalWorkerOptions.workerSrc =
          'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js'
        const buf = await file.arrayBuffer()
        const pdf = await lib.getDocument({ data: buf }).promise
        let text = ''
        for (let p = 1; p <= pdf.numPages; p++) {
          const page = await pdf.getPage(p)
          const tc = await page.getTextContent()
          text += '\n' + (tc.items as { str: string }[]).map(i => i.str).join(' ')
        }
        resolve(text)
      } catch (e) { reject(e) }
    }
    if (!existing) {
      const s = document.createElement('script')
      s.id = 'pdfjs-cdn'
      s.src = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js'
      s.onload = doExtract
      s.onerror = () => reject(new Error('No se pudo cargar PDF.js'))
      document.head.appendChild(s)
    } else {
      doExtract()
    }
  })
}

// ── Extraction result modal ───────────────────────────────────────────────────

function ExtractionModal({
  fields, clientId, onClose, onApplied,
}: {
  fields: ExtractedFields
  clientId: string
  onClose: () => void
  onApplied: () => void
}) {
  const [selected, setSelected] = useState<Record<string, boolean>>(() => {
    const init: Record<string, boolean> = {}
    FIELD_MAP.forEach(f => { if (fields[f.key]) init[f.key] = true })
    return init
  })
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)

  async function apply() {
    setSaving(true)
    const patch: Record<string, string> = {}
    FIELD_MAP.forEach(f => {
      if (selected[f.key] && fields[f.key]) {
        // Normalize insurer name to standard short form
        const value = f.clientKey === 'insurer'
          ? normalizeInsurer(fields[f.key])
          : fields[f.key]!
        patch[f.clientKey] = value
      }
    })
    await fetch(`/api/clients/${clientId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(patch),
    })
    setSaving(false)
    setSaved(true)
    setTimeout(() => { onApplied(); onClose() }, 1200)
  }

  const hasFields = FIELD_MAP.some(f => fields[f.key])

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden">
        {/* Header */}
        <div className="px-6 py-4" style={{ background: 'linear-gradient(135deg, #10253f, #2a6496)' }}>
          <h3 className="text-white font-bold text-base">🤖 Información extraída del PDF</h3>
          <p className="text-blue-200 text-xs mt-0.5">Selecciona los campos que quieres guardar en la ficha del cliente</p>
        </div>

        <div className="p-5">
          {!hasFields ? (
            <div className="text-center py-6">
              <div className="text-3xl mb-2">🔍</div>
              <p className="text-sm text-gray-600 font-medium">No se encontró información del plan en este PDF</p>
              <p className="text-xs text-gray-400 mt-1">El archivo puede ser una foto o un documento sin texto seleccionable</p>
            </div>
          ) : (
            <>
              {/* Select all toggle */}
              <div className="flex items-center justify-between mb-3">
                <p className="text-xs text-gray-500">{Object.values(selected).filter(Boolean).length} campos seleccionados</p>
                <button type="button" onClick={() => {
                  const allSelected = FIELD_MAP.every(f => !fields[f.key] || selected[f.key])
                  const next: Record<string, boolean> = {}
                  FIELD_MAP.forEach(f => { if (fields[f.key]) next[f.key] = !allSelected })
                  setSelected(next)
                }} className="text-xs font-semibold" style={{ color: '#2a6496' }}>
                  {FIELD_MAP.every(f => !fields[f.key] || selected[f.key]) ? 'Deseleccionar todo' : 'Seleccionar todo'}
                </button>
              </div>

              {/* Field list grouped */}
              <div className="space-y-3 mb-4 max-h-96 overflow-y-auto pr-1">
                {Object.entries(GROUP_LABELS).map(([group, groupLabel]) => {
                  const groupFields = FIELD_MAP.filter(f => f.group === group && fields[f.key])
                  if (groupFields.length === 0) return null
                  return (
                    <div key={group}>
                      <p className="text-xs font-bold text-gray-400 uppercase tracking-wide mb-1.5">{groupLabel}</p>
                      <div className="space-y-1.5">
                        {groupFields.map(f => (
                          <label key={f.key}
                            className="flex items-center gap-3 p-2.5 rounded-xl cursor-pointer transition-colors"
                            style={{ background: selected[f.key] ? '#f0f7fb' : '#f8fafc', border: `1.5px solid ${selected[f.key] ? '#4a90b8' : '#e2e8f0'}` }}>
                            <input type="checkbox" checked={!!selected[f.key]}
                              onChange={e => setSelected(s => ({ ...s, [f.key]: e.target.checked }))}
                              className="w-4 h-4 rounded flex-shrink-0 accent-[#2a6496]" />
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center justify-between gap-2">
                                <span className="text-xs font-medium text-gray-500 shrink-0">{f.label}</span>
                                {f.clientKey === 'insurer' && wasNormalized(fields[f.key]) ? (
                                  <div className="text-right min-w-0">
                                    <div className="text-xs font-bold" style={{ color: '#10253f' }}>
                                      {normalizeInsurer(fields[f.key])}
                                    </div>
                                    <div className="text-xs text-gray-400 truncate max-w-32">
                                      PDF: <em>{fields[f.key]}</em>
                                    </div>
                                  </div>
                                ) : (
                                  <span className="text-xs font-bold truncate" style={{ color: '#10253f' }}>{fields[f.key]}</span>
                                )}
                              </div>
                              {f.clientKey === 'insurer' && wasNormalized(fields[f.key]) && (
                                <div className="mt-1 text-xs px-2 py-0.5 rounded-full inline-block"
                                  style={{ background: '#d1fae5', color: '#065f46' }}>
                                  ✓ Normalizado automáticamente
                                </div>
                              )}
                            </div>
                          </label>
                        ))}
                      </div>
                    </div>
                  )
                })}
              </div>
            </>
          )}

          <div className="flex gap-2">
            {hasFields && !saved && (
              <button onClick={apply} disabled={saving || !Object.values(selected).some(Boolean)}
                className="flex-1 py-2.5 rounded-xl text-sm font-semibold text-white disabled:opacity-50 transition-all"
                style={{ background: saving ? '#64748b' : 'linear-gradient(135deg, #2a6496, #0891b2)' }}>
                {saving ? 'Guardando...' : `✓ Aplicar a ficha del cliente`}
              </button>
            )}
            {saved && (
              <div className="flex-1 py-2.5 rounded-xl text-sm font-semibold text-center" style={{ background: '#d1fae5', color: '#065f46' }}>
                ✅ ¡Ficha actualizada!
              </div>
            )}
            <button onClick={onClose}
              className="px-4 py-2.5 rounded-xl text-sm border font-medium"
              style={{ borderColor: '#e2e8f0', color: '#64748b' }}>
              {saved ? 'Cerrar' : 'Cancelar'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

// ── Main component ────────────────────────────────────────────────────────────

export default function DocumentsSection({ clientId, onClientUpdated }: Props) {
  const [docs, setDocs] = useState<Doc[]>([])
  const [loaded, setLoaded] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [extracting, setExtracting] = useState(false)
  const [extractStatus, setExtractStatus] = useState('')
  const [dragOver, setDragOver] = useState(false)
  const [uploadError, setUploadError] = useState('')
  const [category, setCategory] = useState('Identificación')
  const [notes, setNotes] = useState('')
  const [expanded, setExpanded] = useState(false)
  const [extractedFields, setExtractedFields] = useState<ExtractedFields | null>(null)
  const fileRef = useRef<HTMLInputElement>(null)

  const load = useCallback(async () => {
    const res = await fetch(`/api/clients/${clientId}/documents`)
    const data = await res.json()
    setDocs(Array.isArray(data) ? data : [])
    setLoaded(true)
  }, [clientId])

  const toggle = () => {
    if (!expanded && !loaded) load()
    setExpanded(v => !v)
  }

  async function upload(file: File) {
    setUploadError('')
    setUploading(true)
    const fd = new FormData()
    fd.append('file', file)
    fd.append('category', category)
    fd.append('notes', notes)

    const res = await fetch(`/api/clients/${clientId}/documents`, { method: 'POST', body: fd })
    const data = await res.json()
    setUploading(false)

    if (!res.ok) { setUploadError(data.error || 'Error al subir archivo'); return }
    setDocs(prev => [data, ...prev])
    setNotes('')
    if (fileRef.current) fileRef.current.value = ''

    // If it's a PDF and category is Póliza, offer extraction
    if (file.type === 'application/pdf' && (category === 'Póliza' || category === 'Otro')) {
      extractFromPdf(file)
    }
  }

  async function extractFromPdf(file: File) {
    setExtracting(true)
    setExtractStatus('Leyendo PDF...')
    try {
      const text = await extractPdfText(file)
      setExtractStatus('Analizando con Claude AI...')
      const res = await fetch('/api/tarjeta', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pdfText: text }),
      })
      setExtracting(false)
      setExtractStatus('')
      if (res.ok) {
        const fields = await res.json()
        // Only show modal if we got useful fields
        if (fields.co || fields.pname || fields.cat) {
          setExtractedFields({
            insurer:      fields.co   || undefined,
            planName:     fields.pname|| undefined,
            planCategory: fields.cat  || undefined,
            net:          fields.net  || undefined,
            ref:          fields.ref  || undefined,
            ded:          fields.ded  || undefined,
            oop:          fields.oop  || undefined,
            pcp:          fields.pcp  || undefined,
            spec:         fields.spec || undefined,
            uc:           fields.uc   || undefined,
            hosp:         fields.hosp || undefined,
            rx:           fields.rx   || undefined,
            xray:         fields.xray || undefined,
            ct:           fields.ct   || undefined,
            lab:          fields.lab  || undefined,
          })
        }
      }
    } catch {
      setExtracting(false)
      setExtractStatus('')
    }
  }

  async function extractExisting(doc: Doc) {
    if (doc.mimeType !== 'application/pdf') return
    setExtracting(true)
    setExtractStatus(`Extrayendo de ${doc.fileName}...`)
    try {
      // Download the file
      const res = await fetch(`/api/documents/${doc.id}/download`)
      const blob = await res.blob()
      const file = new File([blob], doc.fileName, { type: 'application/pdf' })
      await extractFromPdf(file)
    } catch {
      setExtracting(false)
      setExtractStatus('')
      setUploadError('Error al leer el PDF')
    }
  }

  function handleFiles(files: FileList | null) {
    if (!files?.length) return
    upload(files[0])
  }

  async function deleteDoc(id: string) {
    if (!confirm('¿Eliminar este documento? No se puede deshacer.')) return
    await fetch(`/api/documents/${id}`, { method: 'DELETE' })
    setDocs(prev => prev.filter(d => d.id !== id))
  }

  function isImage(mime: string) { return mime.startsWith('image/') }
  function isPDF(mime: string)   { return mime === 'application/pdf' }

  return (
    <>
      {/* Extraction modal */}
      {extractedFields && (
        <ExtractionModal
          fields={extractedFields}
          clientId={clientId}
          onClose={() => setExtractedFields(null)}
          onApplied={() => { setExtractedFields(null); onClientUpdated?.() }}
        />
      )}

      {/* Extracting spinner */}
      {extracting && (
        <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/30">
          <div className="bg-white rounded-2xl px-8 py-6 shadow-2xl text-center">
            <div className="w-10 h-10 border-4 border-blue-100 rounded-full animate-spin mx-auto mb-3"
              style={{ borderTopColor: '#2a6496' }} />
            <p className="text-sm font-semibold" style={{ color: '#10253f' }}>{extractStatus}</p>
            <p className="text-xs text-gray-400 mt-1">Procesando con Claude AI...</p>
          </div>
        </div>
      )}

      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        {/* Header */}
        <button onClick={toggle}
          className="w-full flex items-center justify-between p-5 hover:bg-gray-50 transition-colors text-left">
          <div className="flex items-center gap-2">
            <h2 className="font-semibold text-base" style={{ color: '#10253f' }}>📎 Documentos</h2>
            {loaded && docs.length > 0 && (
              <span className="text-xs font-semibold px-2 py-0.5 rounded-full" style={{ background: '#dbeafe', color: '#1e40af' }}>
                {docs.length}
              </span>
            )}
          </div>
          <span className="text-gray-400 text-sm">{expanded ? '▲' : '▼'}</span>
        </button>

        {expanded && (
          <div className="border-t border-gray-100">
            {/* Upload area */}
            <div className="p-5 space-y-3">
              <div className="flex gap-3 flex-wrap">
                <div className="flex-1 min-w-48">
                  <label className="block text-xs font-medium text-gray-600 mb-1">Categoría</label>
                  <select value={category} onChange={e => setCategory(e.target.value)}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#507b88] bg-white">
                    {CATEGORIES.map(c => <option key={c.value} value={c.value}>{c.icon} {c.value}</option>)}
                  </select>
                </div>
                <div className="flex-1 min-w-48">
                  <label className="block text-xs font-medium text-gray-600 mb-1">Nota (opcional)</label>
                  <input type="text" value={notes} onChange={e => setNotes(e.target.value)}
                    placeholder="Ej: Brochure 2026"
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#507b88] bg-white" />
                </div>
              </div>

              {/* Drop zone */}
              <div
                className={`border-2 border-dashed rounded-xl p-6 text-center cursor-pointer transition-all ${dragOver ? 'border-[#507b88] bg-[#f0f5f7]' : 'border-gray-300 hover:border-[#507b88] hover:bg-gray-50'}`}
                onClick={() => fileRef.current?.click()}
                onDragOver={e => { e.preventDefault(); setDragOver(true) }}
                onDragLeave={() => setDragOver(false)}
                onDrop={e => { e.preventDefault(); setDragOver(false); handleFiles(e.dataTransfer.files) }}>
                {uploading ? (
                  <div className="text-sm text-gray-500">⏳ Subiendo archivo...</div>
                ) : (
                  <>
                    <div className="text-3xl mb-2">📁</div>
                    <div className="text-sm font-medium text-gray-700">
                      Arrastra un archivo aquí o <span style={{ color: '#305a72' }}>haz clic para seleccionar</span>
                    </div>
                    <div className="text-xs text-gray-400 mt-1">PDF, imágenes, Word, Excel · Máx. 10 MB</div>
                    <div className="text-xs mt-2 font-medium" style={{ color: '#2a6496' }}>
                      💡 Si subes el brochure PDF del plan, se extraerá la info automáticamente
                    </div>
                  </>
                )}
              </div>
              <input ref={fileRef} type="file" className="hidden"
                accept=".pdf,.jpg,.jpeg,.png,.webp,.gif,.doc,.docx,.xls,.xlsx"
                onChange={e => handleFiles(e.target.files)} />

              {uploadError && (
                <div className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">⚠️ {uploadError}</div>
              )}
            </div>

            {/* Document list */}
            {!loaded ? (
              <div className="px-5 pb-5 text-sm text-gray-400">Cargando...</div>
            ) : docs.length === 0 ? (
              <div className="px-5 pb-5 text-sm text-gray-400 text-center py-4">
                Sin documentos adjuntos. Sube el primero arriba.
              </div>
            ) : (
              <div className="divide-y divide-gray-100">
                {docs.map(doc => {
                  const cat = getCat(doc.category)
                  return (
                    <div key={doc.id} className="flex items-center gap-3 px-5 py-3 hover:bg-gray-50 transition-colors">
                      <div className="w-10 h-10 rounded-lg flex items-center justify-center text-xl shrink-0"
                        style={{ background: cat.bg }}>
                        {isImage(doc.mimeType) ? '🖼️' : isPDF(doc.mimeType) ? '📄' : cat.icon}
                      </div>

                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-sm font-medium text-gray-900 truncate">{doc.fileName}</span>
                          <span className="text-xs px-2 py-0.5 rounded-full shrink-0"
                            style={{ background: cat.bg, color: cat.color }}>
                            {cat.icon} {doc.category}
                          </span>
                        </div>
                        <div className="flex items-center gap-2 mt-0.5 text-xs text-gray-400">
                          <span>{formatSize(doc.fileSize)}</span>
                          <span>·</span>
                          <span>{formatDate(doc.uploadedAt)}</span>
                          {doc.notes && <><span>·</span><span className="truncate">{doc.notes}</span></>}
                        </div>
                      </div>

                      <div className="flex items-center gap-1 shrink-0">
                        {/* Extract from PDF button */}
                        {isPDF(doc.mimeType) && (
                          <button onClick={() => extractExisting(doc)}
                            title="Extraer información del plan"
                            className="p-1.5 rounded-lg text-sm transition-colors hover:bg-blue-50"
                            style={{ color: '#2a6496' }}>
                            🤖
                          </button>
                        )}
                        <a href={`/api/documents/${doc.id}/download`} target="_blank" rel="noopener noreferrer"
                          className="p-1.5 rounded-lg hover:bg-gray-100 text-sm transition-colors"
                          title="Descargar" style={{ color: '#305a72' }}>⬇️</a>
                        <button onClick={() => deleteDoc(doc.id)}
                          className="p-1.5 rounded-lg hover:bg-red-50 text-sm transition-colors"
                          title="Eliminar" style={{ color: '#ef4444' }}>🗑️</button>
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        )}
      </div>
    </>
  )
}
