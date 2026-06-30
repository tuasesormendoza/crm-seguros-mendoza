import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { encrypt, decryptClientFields } from '@/lib/encrypt'
import { validateClient, validationError } from '@/lib/validate'
import { getAuth } from '@/lib/auth'
import { logAudit } from '@/lib/audit'

function parseClientData(d: Record<string, unknown>) {
  return {
    fullName: d.fullName as string,
    ssn: encrypt(d.ssn as string || null),
    birthDate: d.birthDate ? new Date(d.birthDate as string) : null,
    filesTaxes: d.filesTaxes != null ? Boolean(d.filesTaxes) : null,
    filingStatus: d.filingStatus as string || null,
    maritalStatus: d.maritalStatus as string || null,
    employmentType: d.employmentType as string || null,
    email: d.email as string || null,
    phone: d.phone as string || null,
    address: d.address as string || null,
    aptSuite: d.aptSuite as string || null,
    city: d.city as string || null,
    zipCode: d.zipCode as string || null,
    county: d.county as string || null,
    state: d.state as string || null,
    contractDate: d.contractDate ? new Date(d.contractDate as string) : null,
    policyYear: d.policyYear ? parseInt(d.policyYear as string) : null,
    coverageType: d.coverageType as string || null,
    insurer: d.insurer as string || null,
    affiliatesCount: d.affiliatesCount ? parseInt(d.affiliatesCount as string) : 1,
    planName: d.planName as string || null,
    planCategory: d.planCategory as string || null,
    planId: d.planId as string || null,
    planNetwork: d.planNetwork as string || null,
    planDeductible: d.planDeductible as string || null,
    planMaxOOP: d.planMaxOOP as string || null,
    planPCP: d.planPCP as string || null,
    planSpecialist: d.planSpecialist as string || null,
    planUrgentCare: d.planUrgentCare as string || null,
    planHospital: d.planHospital as string || null,
    planRxGeneric: d.planRxGeneric as string || null,
    planXray: d.planXray as string || null,
    planCTScan: d.planCTScan as string || null,
    planLab: d.planLab as string || null,
    planReferral: d.planReferral as string || null,
    acaPrice: d.acaPrice ? parseFloat(d.acaPrice as string) : 0,
    aptcAmount: d.aptcAmount ? parseFloat(d.aptcAmount as string) : null,
    wnPolicies: Array.isArray(d.wnPolicies) ? JSON.stringify(d.wnPolicies) : (d.wnPolicies as string || null),
    wnContractDate: d.wnContractDate ? new Date(d.wnContractDate as string) : null,
    cancellationDate: d.cancellationDate ? new Date(d.cancellationDate as string) : null,
    totalMonthly: d.totalMonthly ? parseFloat(d.totalMonthly as string) : 0,
    annualIncome: d.annualIncome ? parseFloat(d.annualIncome as string) : null,
    status: d.status as string || 'Activo',
    activationDate: d.activationDate ? new Date(d.activationDate as string) : null,
    renewalDate: d.renewalDate ? new Date(d.renewalDate as string) : null,
    policyExpirationDate: d.policyExpirationDate ? new Date(d.policyExpirationDate as string) : null,
    preferredDoctors: Array.isArray(d.preferredDoctors) ? JSON.stringify(d.preferredDoctors) : (d.preferredDoctors as string || null),
    specificMedications: Array.isArray(d.specificMedications) ? JSON.stringify(d.specificMedications) : (d.specificMedications as string || null),
    bankHolder: d.bankHolder as string || null,
    bankName: d.bankName as string || null,
    bankRouting: encrypt(d.bankRouting as string || null),
    bankAccount: encrypt(d.bankAccount as string || null),
    bankAccountType: d.bankAccountType as string || null,
    portalUser: d.portalUser as string || null,
    portalPassword: encrypt(d.portalPassword as string || null),
    sherpaUrl: d.sherpaUrl as string || null,
    googleReview: d.googleReview as string || null,
    notes: d.notes as string || null,
    preferredLanguage: d.preferredLanguage as string || null,
    dentalInsurer: d.dentalInsurer as string || null,
    dentalDeductible: d.dentalDeductible as string || null,
    dentalMaxBenefit: d.dentalMaxBenefit as string || null,
    dentalMonthly: d.dentalMonthly ? parseFloat(d.dentalMonthly as string) : 0,
    firstPaymentPaid: d.firstPaymentPaid != null ? (d.firstPaymentPaid === true || d.firstPaymentPaid === 'Sí') : null,
    firstPaymentDate: d.firstPaymentDate ? new Date(d.firstPaymentDate as string) : null,
    tags: Array.isArray(d.tags) ? JSON.stringify(d.tags) : (d.tags as string || null),
    applicantInPolicy: d.applicantInPolicy != null ? Boolean(d.applicantInPolicy) : null,
    applicantExclusionReason: d.applicantExclusionReason as string || null,
  }
}

function parseDependents(deps: { type: string; name?: string; birthDate?: string; ssn?: string; inPolicy?: boolean; coverageNote?: string }[]) {
  return deps.filter(d => d.name).map(d => ({
    type: d.type,
    name: d.name!,
    birthDate: d.birthDate ? new Date(d.birthDate) : null,
    ssn: encrypt(d.ssn || null),
    inPolicy: d.inPolicy === null || d.inPolicy === undefined ? null : d.inPolicy,
    coverageNote: d.coverageNote || null,
  }))
}

// Campos sensibles que NUNCA deben viajar al navegador en una LISTA (solo se
// descifran y muestran en el perfil individual del cliente).
const SENSITIVE_FIELDS = ['ssn', 'bankAccount', 'bankRouting', 'portalPassword'] as const

function stripSensitive<T extends Record<string, unknown>>(client: T): T {
  const out = { ...client } as Record<string, unknown>
  for (const k of SENSITIVE_FIELDS) delete out[k]
  if (Array.isArray(out.dependents)) {
    out.dependents = (out.dependents as Record<string, unknown>[]).map(d => {
      const dd = { ...d }; delete dd.ssn; return dd
    })
  }
  return out as T
}

// Campos que necesita la LISTA paginada de clientes (sin PII sensible).
const LIST_SELECT = {
  id: true, fullName: true, email: true, phone: true, state: true,
  insurer: true, planCategory: true, coverageType: true, totalMonthly: true,
  status: true, renewalDate: true, affiliatesCount: true, tags: true, wnPolicies: true,
  cancellationDate: true,
} as const

const SORT_FIELDS = ['fullName', 'state', 'insurer', 'totalMonthly', 'renewalDate', 'status']

export async function GET(request: NextRequest) {
  const auth = await getAuth()
  if (auth instanceof NextResponse) return auth

  const { searchParams } = new URL(request.url)
  const search = searchParams.get('search') || ''
  const status = searchParams.get('status') || ''
  const insurer = searchParams.get('insurer') || ''
  const state = searchParams.get('state') || ''
  const tag = searchParams.get('tag') || ''
  const wn = searchParams.get('wn') || '' // 'con' | 'sin'

  // Filtro unificado (se aplica tanto a la lista paginada como al arreglo).
  const where = {
    agencyId: auth.agencyId,
    AND: [
      search ? { OR: [
        { fullName: { contains: search, mode: 'insensitive' as const } },
        { email: { contains: search, mode: 'insensitive' as const } },
        { phone: { contains: search } },
      ] } : {},
      status ? { status } : {},
      insurer ? { insurer } : {},
      state ? { state } : {},
      // tags se guarda como arreglo JSON en texto, ej. ["VIP"] → busca "VIP" entre comillas
      tag ? { tags: { contains: `"${tag}"` } } : {},
      // wnPolicies con al menos una póliza con "type" = tiene Washington National
      wn === 'con' ? { wnPolicies: { contains: '"type"' } } : {},
      wn === 'sin' ? { OR: [{ wnPolicies: null }, { NOT: { wnPolicies: { contains: '"type"' } } }] } : {},
    ],
  }

  // ── Modo paginado (lo usa la página de Clientes) ────────────────────────────
  if (searchParams.get('paginated') === '1') {
    const page = Math.max(1, parseInt(searchParams.get('page') || '1') || 1)
    const pageSize = Math.min(200, Math.max(1, parseInt(searchParams.get('pageSize') || '50') || 50))
    const sortParam = searchParams.get('sort') || 'fullName'
    const sort = SORT_FIELDS.includes(sortParam) ? sortParam : 'fullName'
    const dir = searchParams.get('dir') === 'desc' ? 'desc' : 'asc'

    const [total, clients, stateGroups] = await Promise.all([
      prisma.client.count({ where }),
      prisma.client.findMany({
        where, select: LIST_SELECT, orderBy: { [sort]: dir },
        skip: (page - 1) * pageSize, take: pageSize,
      }),
      prisma.client.groupBy({ by: ['state'], where: { agencyId: auth.agencyId, state: { not: null } } }),
    ])

    return NextResponse.json({
      clients,
      total,
      page,
      pageSize,
      totalPages: Math.max(1, Math.ceil(total / pageSize)),
      states: stateGroups.map(g => g.state).filter(Boolean).sort(),
    })
  }

  // ── Modo arreglo (compatibilidad: pipeline, documentos, reportes, búsqueda) ──
  // Devuelve los clientes SIN los campos sensibles (no se descifran ni viajan
  // al navegador en vistas de lista).
  const clients = await prisma.client.findMany({
    where,
    include: { dependents: true },
    orderBy: { fullName: 'asc' },
  })
  return NextResponse.json(clients.map(stripSensitive))
}

export async function POST(request: NextRequest) {
  const auth = await getAuth()
  if (auth instanceof NextResponse) return auth

  const data = await request.json()
  const { dependents, ...rest } = data
  const errors = validateClient(rest)
  if (Object.keys(errors).length > 0) return validationError(errors)
  const client = await prisma.client.create({
    data: {
      ...parseClientData(rest),
      agencyId: auth.agencyId,
      dependents: dependents ? { create: parseDependents(dependents).map(d => ({ ...d, agencyId: auth.agencyId })) } : undefined,
    },
    include: { dependents: true },
  })
  await logAudit(auth, { action: 'create', entity: 'client', entityId: client.id, entityLabel: client.fullName })
  return NextResponse.json(decryptClientFields(client), { status: 201 })
}
