// ─────────────────────────────────────────────────────────────────────────────
// "STATE" ANTI-CSRF DEL FLUJO OAUTH DE GOOGLE
//
// Antes el state se guardaba en la cookie de sesión y se comparaba al volver de
// Google. Eso falla con demasiada facilidad: cada clic en "Conectar" pisaba el
// anterior, así que abrir el consentimiento en otra pestaña, tardar un rato o
// pulsar conectar dos veces dejaba al agente con "La sesión de autorización
// expiró" sin haber hecho nada mal.
//
// Ahora el state se FIRMA con el SESSION_SECRET y lleva su propia marca de
// tiempo. Al volver se verifica la firma, sin depender de ninguna cookie.
// Sigue protegiendo igual: solo nuestro servidor puede producir una firma
// válida, que es justo lo que impide el CSRF.
//
// Sin importar nada del proyecto, para que las pruebas puedan cargarlo.
// ─────────────────────────────────────────────────────────────────────────────

import { createHmac, timingSafeEqual } from 'node:crypto'

/** Cuánto vale un state. De sobra para el consentimiento, corto para un ataque. */
export const STATE_TTL_MS = 15 * 60 * 1000

/** Tolerancia por desfase de reloj entre el servidor que firma y el que verifica. */
const SKEW_MS = 60 * 1000

function sign(payload: string, secret: string): string {
  return createHmac('sha256', secret).update(payload).digest('base64url')
}

export function createOAuthState(secret: string, now: number = Date.now()): string {
  const payload = String(now)
  return `${payload}.${sign(payload, secret)}`
}

export function verifyOAuthState(
  state: string | null | undefined,
  secret: string,
  now: number = Date.now(),
): boolean {
  if (!state || !secret) return false

  const dot = state.indexOf('.')
  if (dot <= 0 || dot === state.length - 1) return false

  const payload = state.slice(0, dot)
  const got = Buffer.from(state.slice(dot + 1), 'utf8')
  const want = Buffer.from(sign(payload, secret), 'utf8')
  // Longitudes distintas: timingSafeEqual lanzaría, así que se corta antes.
  if (got.length !== want.length) return false
  if (!timingSafeEqual(got, want)) return false

  const ts = Number(payload)
  if (!Number.isFinite(ts)) return false
  const age = now - ts
  return age >= -SKEW_MS && age <= STATE_TTL_MS
}
