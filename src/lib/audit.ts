import { prisma } from '@/lib/prisma'

// ─────────────────────────────────────────────────────────────────────────────
// Registro de auditoría. Cada acción sensible llama a logAudit(...) para dejar
// una huella de QUIÉN hizo QUÉ y CUÁNDO, aislada por agencia.
//
// Es "fire-and-forget": si el log falla, NUNCA debe romper la operación
// principal (por eso atrapa cualquier error y no lo propaga).
// ─────────────────────────────────────────────────────────────────────────────

export type AuditActor = {
  agencyId: string
  userId?: string
  name?: string
  email?: string
}

export type AuditEntry = {
  action: 'create' | 'update' | 'delete' | 'export' | 'backup' | 'login' | 'send'
  entity: 'client' | 'document' | 'user' | 'prospect' | 'commissionPayment' | 'session' | 'data' | 'campaign'
  entityId?: string
  entityLabel?: string
  metadata?: Record<string, unknown>
  ip?: string
}

export async function logAudit(actor: AuditActor, entry: AuditEntry): Promise<void> {
  try {
    await prisma.auditLog.create({
      data: {
        agencyId: actor.agencyId,
        userId: actor.userId ?? null,
        userName: actor.name ?? null,
        userEmail: actor.email ?? null,
        action: entry.action,
        entity: entry.entity,
        entityId: entry.entityId ?? null,
        entityLabel: entry.entityLabel ?? null,
        metadata: entry.metadata ? JSON.stringify(entry.metadata) : null,
        ip: entry.ip ?? null,
      },
    })
  } catch {
    // Nunca interrumpir la operación principal por un fallo del log de auditoría.
  }
}
