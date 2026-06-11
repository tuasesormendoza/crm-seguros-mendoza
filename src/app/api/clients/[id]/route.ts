import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { encrypt, decryptClientFields } from '@/lib/encrypt'
import { validateClient, validationError } from '@/lib/validate'

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
    type: d.type, name: d.name!, birthDate: d.birthDate ? new Date(d.birthDate) : null,
    ssn: encrypt(d.ssn || null), inPolicy: d.inPolicy === null || d.inPolicy === undefined ? null : d.inPolicy, coverageNote: d.coverageNote || null,
  }))
}

// Encrypt only the sensitive fields present in a PATCH payload
function encryptPatchFields(data: Record<string, unknown>): Record<string, unknown> {
  const result = { ...data }
  if ('ssn' in result) result.ssn = encrypt(result.ssn as string | null)
  if ('bankRouting' in result) result.bankRouting = encrypt(result.bankRouting as string | null)
  if ('bankAccount' in result) result.bankAccount = encrypt(result.bankAccount as string | null)
  if ('portalPassword' in result) result.portalPassword = encrypt(result.portalPassword as string | null)
  return result
}

// PATCH — partial update (e.g. sherpaUrl only)
export async function PATCH(request: NextRequest, ctx: RouteContext<'/api/clients/[id]'>) {
  const { id } = await ctx.params
  const data = await request.json()
  const client = await prisma.client.update({
    where: { id },
    data: encryptPatchFields(data),
    include: { dependents: true, appointments: { orderBy: { date: 'asc' } } },
  })
  return NextResponse.json(decryptClientFields(client))
}

export async function GET(_req: NextRequest, ctx: RouteContext<'/api/clients/[id]'>) {
  const { id } = await ctx.params
  const client = await prisma.client.findUnique({ where: { id }, include: { dependents: true, appointments: { orderBy: { date: 'asc' } } } })
  if (!client) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  return NextResponse.json(decryptClientFields(client))
}

// "Beneficios del Plan" fields are edited inline on the profile (via PATCH) and
// are NOT part of the main "Editar cliente" form — if we let parseClientData
// default them to null whenever the main form is saved, we'd silently wipe them.
// Preserve any plan-benefit field that wasn't included in the submitted payload.
const PLAN_BENEFIT_KEYS = [
  'planNetwork', 'planReferral', 'planDeductible', 'planMaxOOP', 'planPCP',
  'planSpecialist', 'planUrgentCare', 'planHospital', 'planRxGeneric',
  'planXray', 'planCTScan', 'planLab',
] as const

export async function PUT(request: NextRequest, ctx: RouteContext<'/api/clients/[id]'>) {
  const { id } = await ctx.params
  const data = await request.json()
  const { dependents, appointments: _appts, ...rest } = data
  const errors = validateClient(rest)
  if (Object.keys(errors).length > 0) return validationError(errors)
  const parsed: Record<string, unknown> = parseClientData(rest)
  for (const key of PLAN_BENEFIT_KEYS) {
    if (rest[key] === undefined) delete parsed[key]
  }
  await prisma.dependent.deleteMany({ where: { clientId: id } })
  const client = await prisma.client.update({
    where: { id },
    data: { ...parsed, dependents: dependents ? { create: parseDependents(dependents) } : undefined },
    include: { dependents: true, appointments: { orderBy: { date: 'asc' } } },
  })
  return NextResponse.json(decryptClientFields(client))
}

export async function DELETE(_req: NextRequest, ctx: RouteContext<'/api/clients/[id]'>) {
  const { id } = await ctx.params
  await prisma.client.delete({ where: { id } })
  return NextResponse.json({ success: true })
}
