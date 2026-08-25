// Módulo aparte, y sin importar nada, para que las pruebas puedan cargarlo:
// google.ts arrastra Prisma y el cifrado, que el runner no resuelve.

/**
 * ¿Este error significa que Google ya no acepta nuestro permiso de largo plazo?
 *
 * Google responde "invalid_grant" cuando el refresh token está muerto: caducó
 * (pasa cada 7 días si la app sigue en modo "Prueba"), el usuario revocó el
 * acceso, o se regeneró el client_secret. En los tres casos la única salida es
 * volver a conectar; no se arregla reintentando.
 *
 * Se es ESTRICTO a propósito: un corte de red o un 500 pasajero no deben pintar
 * la conexión como rota y mandar al agente a un trámite que no hacía falta.
 */
export function isAuthBroken(error: unknown): boolean {
  const msg = error instanceof Error ? error.message : String(error ?? '')
  return /invalid_grant/i.test(msg)
}
