// ─────────────────────────────────────────────────────────────────────────────
// Cliente mínimo de la API de Google Drive para los respaldos automáticos.
//
// Usa el scope `drive.file`: la app solo ve y maneja los archivos que ELLA MISMA
// crea. Por eso las búsquedas (carpeta / lista de respaldos) devuelven únicamente
// lo que este CRM subió, nunca el resto del Drive del usuario.
// ─────────────────────────────────────────────────────────────────────────────

const DRIVE_API = 'https://www.googleapis.com/drive/v3/files'
const DRIVE_UPLOAD = 'https://www.googleapis.com/upload/drive/v3/files'

export const BACKUP_FOLDER_NAME = 'CRM Seguros - Backups'
const FOLDER_MIME = 'application/vnd.google-apps.folder'

/**
 * Limpia el nombre de carpeta que escribe el agente en Configuración.
 * Un nombre vacío o raro no debe dejar el respaldo sin sitio donde ir, así que
 * cualquier caso dudoso cae en el nombre por defecto.
 */
export function sanitizeFolderName(raw: string | null | undefined): string {
  const name = String(raw ?? '')
    .replace(/[\u0000-\u001f]/g, '')            // caracteres de control
    .trim()
    .slice(0, 100)                            // Drive admite más, pero 100 basta
  return name || BACKUP_FOLDER_NAME
}

function authHeaders(token: string): Record<string, string> {
  return { Authorization: `Bearer ${token}` }
}

async function driveError(res: Response, action: string): Promise<never> {
  const body = await res.text().catch(() => '')
  // 403 con "insufficientScopes" o "insufficientPermissions" = falta el permiso
  // de Drive porque la cuenta se conectó ANTES de habilitar los respaldos.
  if (res.status === 403 && /insufficient/i.test(body)) {
    throw new Error('La cuenta de Google no tiene permiso de Drive. Desconecta y vuelve a conectar Google para habilitar los respaldos.')
  }
  throw new Error(`Google Drive: ${action} falló (${res.status}) ${body.slice(0, 200)}`)
}

/**
 * Deja lista la carpeta de respaldos y devuelve su id.
 *
 * `knownId` es la carpeta que ya se usó otras veces. Se prefiere sobre buscar
 * por nombre por dos motivos:
 *   • Si el agente la MOVIÓ dentro de su Drive, se sigue encontrando igual.
 *   • Si CAMBIÓ el nombre en Configuración, se renombra la carpeta que ya
 *     existe en vez de crear una nueva — así los respaldos viejos no quedan
 *     abandonados en una carpeta huérfana.
 * Si el agente borró la carpeta a mano, se crea otra sin fallar.
 */
export async function ensureBackupFolder(
  token: string, desiredName: string, knownId?: string | null,
): Promise<string> {
  const name = desiredName.trim() || BACKUP_FOLDER_NAME

  if (knownId) {
    const res = await fetch(`${DRIVE_API}/${knownId}?fields=id,name,trashed`, { headers: authHeaders(token) })
    if (res.ok) {
      const f = await res.json() as { id: string; name: string; trashed?: boolean }
      if (!f.trashed) {
        if (f.name !== name) {
          const ren = await fetch(`${DRIVE_API}/${f.id}?fields=id`, {
            method: 'PATCH',
            headers: { ...authHeaders(token), 'Content-Type': 'application/json' },
            body: JSON.stringify({ name }),
          })
          if (!ren.ok) await driveError(ren, 'renombrar carpeta')
        }
        return f.id
      }
    }
    // 404 / en la papelera → se ignora y se sigue al camino normal.
  }

  const q = `name='${name.replace(/'/g, "\\'")}' and mimeType='${FOLDER_MIME}' and trashed=false`
  const url = `${DRIVE_API}?q=${encodeURIComponent(q)}&fields=files(id,name)&spaces=drive`
  const res = await fetch(url, { headers: authHeaders(token) })
  if (!res.ok) await driveError(res, 'buscar carpeta')
  const data = await res.json() as { files?: { id: string }[] }
  if (data.files && data.files.length > 0) return data.files[0].id

  const create = await fetch(`${DRIVE_API}?fields=id`, {
    method: 'POST',
    headers: { ...authHeaders(token), 'Content-Type': 'application/json' },
    body: JSON.stringify({ name, mimeType: FOLDER_MIME }),
  })
  if (!create.ok) await driveError(create, 'crear carpeta')
  const folder = await create.json() as { id: string }
  return folder.id
}

// Sube un JSON a la carpeta indicada (multipart: metadata + contenido). Devuelve id.
export async function uploadJsonBackup(token: string, folderId: string, filename: string, json: string): Promise<string> {
  const boundary = `crmbackup${Date.now()}${Math.random().toString(36).slice(2)}`
  const metadata = { name: filename, parents: [folderId], mimeType: 'application/json' }
  const body =
    `--${boundary}\r\n` +
    'Content-Type: application/json; charset=UTF-8\r\n\r\n' +
    `${JSON.stringify(metadata)}\r\n` +
    `--${boundary}\r\n` +
    'Content-Type: application/json\r\n\r\n' +
    `${json}\r\n` +
    `--${boundary}--`

  const res = await fetch(`${DRIVE_UPLOAD}?uploadType=multipart&fields=id`, {
    method: 'POST',
    headers: { ...authHeaders(token), 'Content-Type': `multipart/related; boundary=${boundary}` },
    body,
  })
  if (!res.ok) await driveError(res, 'subir respaldo')
  const file = await res.json() as { id: string }
  return file.id
}

export interface DriveBackupFile { id: string; name: string; createdTime: string }

// Lista los respaldos de la carpeta, del más nuevo al más viejo.
export async function listBackups(token: string, folderId: string): Promise<DriveBackupFile[]> {
  const q = `'${folderId}' in parents and trashed=false`
  const url = `${DRIVE_API}?q=${encodeURIComponent(q)}&fields=files(id,name,createdTime)&orderBy=createdTime desc&pageSize=100&spaces=drive`
  const res = await fetch(url, { headers: authHeaders(token) })
  if (!res.ok) await driveError(res, 'listar respaldos')
  const data = await res.json() as { files?: DriveBackupFile[] }
  return data.files ?? []
}

export async function deleteBackup(token: string, fileId: string): Promise<void> {
  const res = await fetch(`${DRIVE_API}/${fileId}`, { method: 'DELETE', headers: authHeaders(token) })
  // 404 = ya no existe; lo tratamos como éxito.
  if (!res.ok && res.status !== 404) await driveError(res, 'borrar respaldo')
}
