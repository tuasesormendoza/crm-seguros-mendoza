// ─────────────────────────────────────────────────────────────────────────────
// Respaldo automático de los datos de cada agencia en su Google Drive.
//
// Por cada agencia con Google conectado se elige UNA cuenta (una copia por
// agencia basta), se exportan sus datos a JSON y se sube a la carpeta
// "CRM Seguros - Backups". Después se conservan solo los últimos KEEP respaldos
// (se borran los más viejos). El resultado se guarda en Settings (driveLastBackup)
// como bitácora visible desde Configuración, sin depender de los logs del servidor.
//
// Regla de oro: si Google/Drive falla, nunca rompe nada — todo va con try/catch
// y los errores se reportan, no se propagan.
// ─────────────────────────────────────────────────────────────────────────────

import { prisma } from '@/lib/prisma'
import { getValidAccessToken } from '@/lib/google'
import { exportAgencyBackup } from '@/lib/backup'
import { ensureBackupFolder, uploadJsonBackup, listBackups, deleteBackup, sanitizeFolderName } from '@/lib/googleDrive'

// Cuántos respaldos conservar en Drive por agencia (los más viejos se borran).
const KEEP = 30

export interface AgencyBackupResult {
  agencyId: string
  email: string
  ok: boolean
  fileName?: string
  folderName?: string
  deleted?: number
  error?: string
}

// Respalda UNA cuenta de Google (los datos de su agencia) y poda los viejos.
async function backupOne(acct: {
  id: string; agencyId: string | null; email: string
  accessToken: string; refreshToken: string; expiresAt: Date
}): Promise<AgencyBackupResult> {
  const base = { agencyId: acct.agencyId || '', email: acct.email }
  if (!acct.agencyId) return { ...base, ok: false, error: 'cuenta sin agencia' }

  const token = await getValidAccessToken(acct)

  // La agencia elige cómo se llama su carpeta (Configuración → Integraciones y
  // Respaldo). Se guarda también su id para poder renombrarla —y para seguir
  // encontrándola si el agente la mueve de sitio dentro de su Drive.
  const cfg = await prisma.settings.findMany({
    where: { agencyId: acct.agencyId, key: { in: ['driveBackupFolder', 'driveBackupFolderId'] } },
  })
  const byKey = Object.fromEntries(cfg.map(r => [r.key, r.value]))
  const folderName = sanitizeFolderName(byKey.driveBackupFolder)
  const folderId = await ensureBackupFolder(token, folderName, byKey.driveBackupFolderId)

  if (byKey.driveBackupFolderId !== folderId) {
    await prisma.settings.upsert({
      where: { agencyId_key: { agencyId: acct.agencyId, key: 'driveBackupFolderId' } },
      create: { agencyId: acct.agencyId, key: 'driveBackupFolderId', value: folderId },
      update: { value: folderId },
    }).catch(() => {})
  }

  const data = await exportAgencyBackup(acct.agencyId)
  const json = JSON.stringify(data)
  const stamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19) // 2026-07-06T08-00-00
  const fileName = `crm-backup-${stamp}.json`
  await uploadJsonBackup(token, folderId, fileName, json)

  // Podar: conservar solo los últimos KEEP (la lista viene del más nuevo al viejo).
  let deleted = 0
  const files = await listBackups(token, folderId)
  for (const old of files.slice(KEEP)) {
    await deleteBackup(token, old.id)
    deleted++
  }

  return { ...base, ok: true, fileName, deleted, folderName }
}

// Respalda las agencias con Google conectado. Sin agencyId respalda TODAS (lo usa
// la función programada); con agencyId solo esa (botón "Respaldar ahora").
// Elige una sola cuenta por agencia (la más antigua = normalmente la del dueño).
export async function backupAgencies(agencyId?: string): Promise<{ agencies: number; succeeded: number; results: AgencyBackupResult[] }> {
  const accounts = await prisma.googleAccount.findMany({
    where: agencyId ? { agencyId } : { agencyId: { not: null } },
    orderBy: { createdAt: 'asc' },
    select: { id: true, agencyId: true, email: true, accessToken: true, refreshToken: true, expiresAt: true },
  })

  // Una cuenta por agencia (la primera por antigüedad).
  const byAgency = new Map<string, typeof accounts[number]>()
  for (const acct of accounts) {
    if (acct.agencyId && !byAgency.has(acct.agencyId)) byAgency.set(acct.agencyId, acct)
  }

  // Marca de INTENTO, antes de tocar Google. Sirve de freno para el respaldo
  // automático que dispara la propia app: si esto falla, sin la marca cada
  // carga del panel lanzaría otro intento contra Google.
  for (const acct of byAgency.values()) {
    if (!acct.agencyId) continue
    await prisma.settings.upsert({
      where: { agencyId_key: { agencyId: acct.agencyId, key: 'driveLastAttempt' } },
      create: { agencyId: acct.agencyId, key: 'driveLastAttempt', value: new Date().toISOString() },
      update: { value: new Date().toISOString() },
    }).catch(() => {})
  }

  const results: AgencyBackupResult[] = []
  for (const acct of byAgency.values()) {
    try {
      results.push(await backupOne(acct))
    } catch (err) {
      results.push({
        agencyId: acct.agencyId || '', email: acct.email, ok: false,
        error: err instanceof Error ? err.message : 'error desconocido',
      })
    }
  }

  // Bitácora por agencia (visible en Configuración sin acceso a los logs).
  for (const r of results) {
    if (!r.agencyId) continue
    const log = JSON.stringify({
      at: new Date().toISOString(), ok: r.ok, fileName: r.fileName ?? null,
      deleted: r.deleted ?? 0, error: r.error ?? null, keep: KEEP,
    })
    await prisma.settings.upsert({
      where: { agencyId_key: { agencyId: r.agencyId, key: 'driveLastBackup' } },
      create: { agencyId: r.agencyId, key: 'driveLastBackup', value: log },
      update: { value: log },
    }).catch(() => {})
  }

  return { agencies: byAgency.size, succeeded: results.filter(r => r.ok).length, results }
}
