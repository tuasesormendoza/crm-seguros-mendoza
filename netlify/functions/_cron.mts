// ─────────────────────────────────────────────────────────────────────────────
// LLAMADA COMPARTIDA DE LAS TAREAS PROGRAMADAS
//
// Las cuatro tareas hacen lo mismo: pegarle a un endpoint del CRM con una clave
// derivada del SESSION_SECRET. Antes cada una devolvía un Response y nada más;
// cuando dejaron de funcionar, el registro de Netlify salía VACÍO y no había
// forma de saber por qué. Se invocaban "con éxito" y no pasaba nada.
//
// Por eso ahora todo pasa por aquí y se escribe en el registro cada paso: qué
// variables de entorno faltan, a qué URL se llamó y qué contestó. Nunca se
// imprime el secreto ni la clave, solo si existen.
// ─────────────────────────────────────────────────────────────────────────────

import { createHash } from 'node:crypto'

/**
 * Base del sitio. Netlify expone varias según el contexto del deploy; se
 * prueban todas porque tener solo `URL` fue insuficiente.
 */
function siteBase(): { base: string; from: string } {
  const candidatos: [string, string | undefined][] = [
    ['URL', process.env.URL],
    ['DEPLOY_PRIME_URL', process.env.DEPLOY_PRIME_URL],
    ['DEPLOY_URL', process.env.DEPLOY_URL],
    ['SITE_URL', process.env.SITE_URL],
  ]
  for (const [from, v] of candidatos) {
    if (v && /^https?:\/\//.test(v)) return { base: v.replace(/\/+$/, ''), from }
  }
  return { base: '', from: 'ninguna' }
}

export async function callCron(name: string, path: string): Promise<Response> {
  const { base, from } = siteBase()
  const secret = process.env.SESSION_SECRET || ''

  console.log(`[${name}] inicio · base=${base || '(vacía)'} (de ${from}) · SESSION_SECRET=${secret ? 'presente' : 'AUSENTE'}`)

  if (!base || !secret) {
    // Lista de variables disponibles: solo los NOMBRES, nunca los valores.
    // Es lo que permite ver de un vistazo si el entorno llega recortado.
    const disponibles = Object.keys(process.env).filter(k => !/SECRET|PASSWORD|TOKEN|KEY/i.test(k)).sort()
    console.error(`[${name}] ABORTA: falta ${!base ? 'la URL del sitio' : 'SESSION_SECRET'}`)
    console.error(`[${name}] variables visibles (sin secretos): ${disponibles.join(', ')}`)
    return new Response(`${name}: falta ${!base ? 'URL' : 'SESSION_SECRET'}`, { status: 500 })
  }

  const key = createHash('sha256').update(`${secret}:google-sync`).digest('hex')
  const url = `${base}${path}`

  try {
    console.log(`[${name}] POST ${url}`)
    const res = await fetch(url, { method: 'POST', headers: { 'x-cron-key': key } })
    const body = (await res.text()).slice(0, 500)
    console.log(`[${name}] respuesta ${res.status}: ${body}`)
    if (!res.ok) console.error(`[${name}] el CRM respondió ${res.status} — revisa que SESSION_SECRET sea el mismo en el sitio y en la función`)
    return new Response(`${name} → ${res.status}: ${body}`, { status: res.ok ? 200 : 502 })
  } catch (err) {
    console.error(`[${name}] la llamada falló: ${err instanceof Error ? err.message : String(err)}`)
    return new Response(`${name}: no se pudo llamar al CRM`, { status: 502 })
  }
}
