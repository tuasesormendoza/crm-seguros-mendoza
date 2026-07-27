// Tipos, constantes y parsers compartidos del perfil de cliente.

export const PREDEFINED_TAGS = [
  { label: 'VIP', color: '#fbbf24' },
  { label: 'Necesita seguimiento', color: '#f97316' },
  { label: 'Problema de pago', color: '#ef4444' },
  { label: 'Renovación próxima', color: '#8b5cf6' },
  { label: 'Cliente referido', color: '#10b981' },
  { label: 'Washington National', color: '#3b82f6' },
  { label: 'Documentos pendientes', color: '#6366f1' },
]

export function getTagColor(label: string): string {
  return PREDEFINED_TAGS.find(t => t.label === label)?.color || '#507b88'
}

export interface WnPolicy { type: string; monthly: string | number; policyNumber?: string }

export interface Appointment {
  id: string
  date: string
  doctorName?: string | null
  location?: string | null
  notes?: string | null
  status: string
}

export interface PolicyHistoryEntry {
  id: string
  year: number
  insurer?: string | null
  planName?: string | null
  planCategory?: string | null
  acaPrice?: number | null
  totalMonthly?: number | null
  wnPolicies?: string | null
  notes?: string | null
  recordedAt: string
}

export interface InsurerHistoryEntry {
  id: string
  insurer: string
  startDate: string
  endDate: string | null
  notes?: string | null
}

export const INSURER_HISTORY_OPTIONS = [
  'Blue Cross Blue Shield', 'UnitedHealthcare', 'Oscar', 'Ambetter', 'Cigna',
  'Aetna', 'CareSource', 'AmeriHealth', 'Molina', 'Anthem', 'Kaiser',
  'Alliant', 'AvMed', 'Health Spring', 'Health First', 'Florida Blue',
]

export interface SurveyResponse {
  id: string
  ratingAtention: number | null
  ratingClarity: number | null
  ratingSpeed: number | null
  ratingDedication: number | null
  recommends: string | null
  comments: string | null
  submittedAt: string
}

export interface Client {
  id: string
  fullName: string; ssn?: string | null; birthDate?: string | null
  email?: string | null; phone?: string | null
  filesTaxes?: boolean | null; filingStatus?: string | null
  maritalStatus?: string | null; migrationStatus?: string | null; employmentType?: string | null
  address?: string | null; aptSuite?: string | null; city?: string | null; zipCode?: string | null
  county?: string | null; state?: string | null
  contractDate?: string | null; policyYear?: number | null
  coverageType?: string | null; insurer?: string | null; affiliatesCount?: number | null
  planName?: string | null; planCategory?: string | null; planId?: string | null
  planNetwork?: string | null; planDeductible?: string | null; planMaxOOP?: string | null
  planPCP?: string | null; planSpecialist?: string | null; planUrgentCare?: string | null
  planHospital?: string | null; planRxGeneric?: string | null
  planXray?: string | null; planCTScan?: string | null; planLab?: string | null
  planReferral?: string | null
  acaPrice?: number | null; aptcAmount?: number | null; wnPolicies?: string | null
  wnContractDate?: string | null; wnPaymentDay?: string | null; cancellationDate?: string | null; wnSecondPaymentReceived?: boolean | null
  totalMonthly?: number | null; annualIncome?: number | null
  status?: string | null; activationDate?: string | null; renewalDate?: string | null; policyExpirationDate?: string | null
  preferredDoctors?: string | null; specificMedications?: string | null
  bankHolder?: string | null; bankName?: string | null; bankRouting?: string | null
  bankAccount?: string | null; bankAccountType?: string | null
  portalUser?: string | null; portalPassword?: string | null
  sherpaUrl?: string | null
  googleReview?: string | null; notes?: string | null
  preferredLanguage?: string | null
  dentalInsurer?: string | null; dentalDeductible?: string | null; dentalMaxBenefit?: string | null; dentalMonthly?: number | null
  firstPaymentPaid?: boolean | null; firstPaymentDate?: string | null
  tags?: string | null
  applicantInPolicy?: boolean | null; applicantExclusionReason?: string | null
  dependents: { id: string; type: string; name?: string | null; birthDate?: string | null; ssn?: string | null; inPolicy?: boolean | null; coverageNote?: string | null }[]
  appointments: Appointment[]
}

export const STATUS_COLORS: Record<string, { bg: string; text: string }> = {
  'Activo':            { bg: '#dcfce7', text: '#166534' },
  'Cancelado':         { bg: '#fee2e2', text: '#991b1b' },
  'Con otro agente':   { bg: '#fee2e2', text: '#991b1b' },
  'Pendiente de Pago': { bg: '#fef9c3', text: '#854d0e' },
  'Renovado':          { bg: '#dbeafe', text: '#1e40af' },
  'En Proceso':        { bg: '#f3e8ff', text: '#6b21a8' },
}

export const APPT_STATUS_COLORS: Record<string, { bg: string; text: string }> = {
  'Programada':  { bg: '#dbeafe', text: '#1e40af' },
  'Completada':  { bg: '#dcfce7', text: '#166534' },
  'Cancelada':   { bg: '#fee2e2', text: '#991b1b' },
  'Reagendada':  { bg: '#fef9c3', text: '#854d0e' },
}

export function parseList(val?: string | null): string[] {
  if (!val) return []
  try { const p = JSON.parse(val); return Array.isArray(p) ? p.filter(Boolean) : [val] } catch { return [val] }
}

export function parseWn(val?: string | null): WnPolicy[] {
  if (!val) return []
  try { const p = JSON.parse(val); return Array.isArray(p) ? p : [] } catch { return [] }
}
