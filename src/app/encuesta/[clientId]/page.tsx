'use client'

import { useEffect, useState } from 'react'
import { useParams } from 'next/navigation'

const CATEGORIES = [
  { key: 'ratingAtention',   label: 'Atención y trato personal',  sub: 'Cómo se sintió atendido/a en cada interacción' },
  { key: 'ratingClarity',    label: 'Claridad en la explicación', sub: 'Qué tan bien le expliqué los planes y coberturas' },
  { key: 'ratingSpeed',      label: 'Rapidez de respuesta',       sub: 'Qué tan rápido respondí sus preguntas' },
  { key: 'ratingDedication', label: 'Dedicación y compromiso',    sub: 'El esfuerzo que puse para servirle bien' },
] as const

type RatingKey = typeof CATEGORIES[number]['key']

export default function SurveyPage() {
  const params = useParams()
  const clientId = params.clientId as string

  const [firstName, setFirstName] = useState('')
  const [ratings, setRatings] = useState<Record<RatingKey, number>>({
    ratingAtention: 0, ratingClarity: 0, ratingSpeed: 0, ratingDedication: 0,
  })
  const [hover, setHover] = useState<Record<RatingKey, number>>({
    ratingAtention: 0, ratingClarity: 0, ratingSpeed: 0, ratingDedication: 0,
  })
  const [recommends, setRecommends] = useState('')
  const [comments, setComments] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [submitted, setSubmitted] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    fetch(`/api/survey?clientId=${clientId}`)
      .then(r => r.json())
      .then(d => { if (d.firstName) setFirstName(d.firstName) })
      .catch(() => {}) // saludo cosmético: si falla, la encuesta funciona sin el nombre
  }, [clientId])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setSubmitting(true)
    setError('')
    try {
      const res = await fetch('/api/survey', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ clientId, ...ratings, recommends, comments }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Error desconocido')
      setSubmitted(true)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al enviar. Por favor intente de nuevo.')
    } finally {
      setSubmitting(false)
    }
  }

  if (submitted) {
    return (
      <div style={{ minHeight: '100vh', background: '#f0f7fb', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '24px', fontFamily: 'Arial, Helvetica, sans-serif' }}>
        <div style={{ background: '#fff', borderRadius: 20, padding: '48px 40px', maxWidth: 480, width: '100%', textAlign: 'center', boxShadow: '0 4px 32px rgba(16,37,63,.10)' }}>
          <div style={{ fontSize: 56, marginBottom: 16 }}>🙏</div>
          <h1 style={{ color: '#10253f', fontSize: 24, fontWeight: 800, marginBottom: 12 }}>¡Muchas gracias!</h1>
          <p style={{ color: '#475569', fontSize: 15, lineHeight: 1.7, marginBottom: 0 }}>
            Su opinión es muy valiosa para mí{firstName ? `, ${firstName}` : ''}. La usaré para seguir mejorando
            y brindar un servicio cada vez mejor a quienes me confíen su cobertura de salud.
          </p>
          <p style={{ color: '#94a3b8', fontSize: 13, marginTop: 24 }}>
            Recuerde que mis puertas siempre estarán abiertas para usted. ¡Mucho éxito!
          </p>
        </div>
      </div>
    )
  }

  return (
    <div style={{ minHeight: '100vh', background: '#f0f7fb', fontFamily: 'Arial, Helvetica, sans-serif' }}>

      {/* Header */}
      <div style={{ background: 'linear-gradient(135deg, #10253f 0%, #1e4a6e 60%, #0891b2 100%)', padding: '28px 24px' }}>
        <div style={{ maxWidth: 560, margin: '0 auto', textAlign: 'center' }}>
          <p style={{ color: 'rgba(255,255,255,.6)', fontSize: 12, margin: '0 0 4px' }}>Encuesta de satisfacción</p>
          <h1 style={{ color: '#fff', fontSize: 20, fontWeight: 700, margin: 0 }}>¿Cómo fue su experiencia?</h1>
        </div>
      </div>

      <div style={{ maxWidth: 560, margin: '0 auto', padding: '24px 16px' }}>

        {/* Greeting */}
        <div style={{ background: '#fff', borderRadius: 16, padding: '24px', marginBottom: 16, border: '1px solid #e2e8f0' }}>
          <p style={{ color: '#10253f', fontSize: 15, margin: 0, lineHeight: 1.7 }}>
            {firstName ? `Estimado/a ${firstName},` : 'Estimado/a cliente,'}<br />
            <span style={{ color: '#475569', fontSize: 13 }}>
              Su opinión honesta me ayuda a crecer y servir mejor a quienes vengan.
              Solo toma un minuto. ¡Gracias de corazón por su tiempo!
            </span>
          </p>
        </div>

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>

          {/* Star ratings */}
          <div style={{ background: '#fff', borderRadius: 16, padding: '24px', border: '1px solid #e2e8f0' }}>
            <h2 style={{ color: '#10253f', fontSize: 14, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.05em', margin: '0 0 6px' }}>
              Calificación del servicio
            </h2>
            <p style={{ color: '#94a3b8', fontSize: 12, margin: '0 0 20px' }}>Toque las estrellas para calificar del 1 al 5</p>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
              {CATEGORIES.map((cat, i) => (
                <div key={cat.key} style={{
                  display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                  padding: '14px 0',
                  borderTop: i > 0 ? '1px solid #f1f5f9' : 'none',
                  flexWrap: 'wrap', gap: 8,
                }}>
                  <div style={{ flex: 1, minWidth: 160 }}>
                    <div style={{ fontSize: 14, fontWeight: 600, color: '#10253f' }}>{cat.label}</div>
                    <div style={{ fontSize: 11, color: '#94a3b8', marginTop: 2 }}>{cat.sub}</div>
                  </div>
                  <div style={{ display: 'flex', gap: 4 }}>
                    {[1,2,3,4,5].map(n => (
                      <button
                        key={n}
                        type="button"
                        onClick={() => setRatings(r => ({ ...r, [cat.key]: n }))}
                        onMouseEnter={() => setHover(h => ({ ...h, [cat.key]: n }))}
                        onMouseLeave={() => setHover(h => ({ ...h, [cat.key]: 0 }))}
                        style={{
                          background: 'none', border: 'none', padding: '2px', cursor: 'pointer',
                          fontSize: 28, lineHeight: 1,
                          color: n <= (hover[cat.key] || ratings[cat.key]) ? '#f59e0b' : '#cbd5e1',
                          transition: 'color .1s',
                        }}
                      >★</button>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Recommends */}
          <div style={{ background: '#fff', borderRadius: 16, padding: '24px', border: '1px solid #e2e8f0' }}>
            <h2 style={{ color: '#10253f', fontSize: 14, fontWeight: 700, margin: '0 0 14px' }}>
              ¿Recomendaría mis servicios a un familiar o amigo?
            </h2>
            <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
              {[
                { val: 'si',     label: 'Sí, con gusto',          color: '#059669', bg: '#d1fae5', border: '#a7f3d0' },
                { val: 'no',     label: 'No por ahora',            color: '#dc2626', bg: '#fee2e2', border: '#fca5a5' },
                { val: 'quizas', label: 'Quizás en el futuro',     color: '#d97706', bg: '#fef3c7', border: '#fde68a' },
              ].map(opt => (
                <button
                  key={opt.val}
                  type="button"
                  onClick={() => setRecommends(opt.val)}
                  style={{
                    flex: 1, minWidth: 120, padding: '10px 8px', borderRadius: 10,
                    border: `1.5px solid ${recommends === opt.val ? opt.border : '#e2e8f0'}`,
                    background: recommends === opt.val ? opt.bg : '#f8fafc',
                    color: recommends === opt.val ? opt.color : '#64748b',
                    fontWeight: recommends === opt.val ? 700 : 400,
                    fontSize: 13, cursor: 'pointer', transition: 'all .15s',
                  }}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>

          {/* Comments */}
          <div style={{ background: '#fff', borderRadius: 16, padding: '24px', border: '1px solid #e2e8f0' }}>
            <h2 style={{ color: '#10253f', fontSize: 14, fontWeight: 700, margin: '0 0 8px' }}>
              ¿Hay algo en lo que pude haber mejorado?
            </h2>
            <p style={{ color: '#94a3b8', fontSize: 12, margin: '0 0 12px' }}>Opcional — su comentario es completamente confidencial</p>
            <textarea
              value={comments}
              onChange={e => setComments(e.target.value)}
              rows={3}
              placeholder="Cuénteme con confianza..."
              style={{
                width: '100%', boxSizing: 'border-box', resize: 'vertical',
                border: '1px solid #e2e8f0', borderRadius: 10, padding: '12px',
                fontSize: 14, fontFamily: 'Arial, sans-serif', color: '#1e293b',
                background: '#f8fafc', outline: 'none',
              }}
            />
          </div>

          {error && (
            <div style={{ background: '#fee2e2', color: '#dc2626', borderRadius: 12, padding: '12px 16px', fontSize: 13 }}>
              ⚠️ {error}
            </div>
          )}

          <button
            type="submit"
            disabled={submitting}
            style={{
              padding: '14px', borderRadius: 12, border: 'none', cursor: submitting ? 'not-allowed' : 'pointer',
              background: submitting ? '#94a3b8' : 'linear-gradient(135deg, #10253f, #0891b2)',
              color: '#fff', fontSize: 15, fontWeight: 700, transition: 'opacity .15s',
            }}
          >
            {submitting ? '⏳ Enviando...' : '📩 Enviar mi opinión'}
          </button>

          <p style={{ textAlign: 'center', color: '#94a3b8', fontSize: 12, margin: 0 }}>
            Sus respuestas son confidenciales y solo serán vistas por su agente.
          </p>
        </form>
      </div>
    </div>
  )
}
