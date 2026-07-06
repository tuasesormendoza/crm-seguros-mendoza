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

// Busca la carpeta de respaldos; si no existe, la crea. Devuelve su id.
export async function findOrCreateBackupFolder(token: string): Promise<string> {
  const q = `name='${BACKUP_FOLDER_NAME.replace(/'/g, "\\'")}' and mimeType='${FOLDER_MIME}' and trashed=false`
  const url = `${DRIVE_API}?q=${encodeURIComponent(q)}&fields=files(id,name)&spaces=drive`
  const res = await fetch(url, { headers: authHeaders(token) })
  if (!res.ok) await driveError(res, 'buscar carpeta')
  const data = await res.json() as { files?: { id: string }[] }
  if (data.files && data.files.length > 0) return data.files[0].id

  const create = await fetch(`${DRIVE_API}?fields=id`, {
    method: 'POST',
    headers: { ...authHeaders(token), 'Content-Type': 'application/json' },
    body: JSON.stringify({ name: BACKUP_FOLDER_NAME, mimeType: FOLDER_MIME }),
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
