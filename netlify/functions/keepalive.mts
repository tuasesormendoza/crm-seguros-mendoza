// Netlify Scheduled Function — keep-alive.
//
// Cada 4 minutos hace ping a /api/ping, que ejecuta un `SELECT 1`. Mantiene
// despiertos el servidor de Next.js y la conexión a Neon Postgres, cuyo plan
// gratuito suspende la base a los ~5 minutos de inactividad.
//
// No usa clave: /api/ping es público y no devuelve datos. Aun así escribe en el
// registro, porque cuando las tareas dejaron de funcionar el registro salía
// vacío y no había forma de saber si llegaban a ejecutarse.

export default async () => {
  const base = process.env.URL || process.env.DEPLOY_PRIME_URL || process.env.DEPLOY_URL || ''
  console.log(`[keepalive] inicio · base=${base || '(vacía)'}`)
  if (!base) {
    console.error('[keepalive] ABORTA: ninguna variable de entorno trae la URL del sitio')
    return new Response('no site URL available', { status: 500 })
  }
  try {
    const res = await fetch(`${base}/api/ping`)
    console.log(`[keepalive] /api/ping → ${res.status}`)
    return new Response(`pinged /api/ping → ${res.status}`)
  } catch (err) {
    console.error(`[keepalive] ping falló: ${err instanceof Error ? err.message : String(err)}`)
    return new Response('ping failed', { status: 502 })
  }
}

// Cada 4 minutos: Netlify permite como mucho una vez por minuto, y 4 queda
// holgadamente por debajo de la ventana de suspensión de Neon (~5 min).
export const config = {
  schedule: '*/4 * * * *',
}
