/**
 * Maps extracted insurer names (from PDFs/Claude) to the standard
 * short names used throughout the CRM for filtering and reports.
 *
 * Uses keyword matching so any variation is caught:
 *   "Ambetter Health" → "Ambetter"
 *   "Ambetter from Peach State" → "Ambetter"
 *   "UHC" → "UnitedHealthcare"
 *   etc.
 *
 * To add new mappings, add a { keywords: [...], standard: '...' } entry.
 */

const INSURER_MAP: { keywords: string[]; standard: string }[] = [
  { keywords: ['ambetter'],               standard: 'Ambetter' },
  { keywords: ['oscar'],                  standard: 'Oscar' },
  { keywords: ['cigna', 'evernorth'],     standard: 'Cigna' },
  { keywords: ['anthem'],                 standard: 'Anthem' },
  { keywords: ['unitedhealth', 'uhc', 'unitedhealthcare', 'united health'],  standard: 'UnitedHealthcare' },
  { keywords: ['molina'],                 standard: 'Molina' },
  { keywords: ['caresource'],             standard: 'CareSource' },
  { keywords: ['kaiser', 'kp'],           standard: 'Kaiser' },
  { keywords: ['blue cross', 'bcbs', 'bluecross', 'blueshield', 'blue shield'], standard: 'Blue Cross Blue Shield' },
  { keywords: ['florida blue', 'floridablue'], standard: 'Florida Blue' },
  { keywords: ['alliant'],                standard: 'Alliant' },
  { keywords: ['amerihealth'],            standard: 'AmeriHealth' },
  { keywords: ['health spring', 'healthspring'], standard: 'Health Spring' },
  { keywords: ['health first', 'healthfirst'], standard: 'Health First' },
  { keywords: ['avmed', 'av-med', 'av med'], standard: 'AvMed' },
  { keywords: ['aetna'],                  standard: 'Aetna' },
  { keywords: ['humana'],                 standard: 'Humana' },
  { keywords: ['centene'],               standard: 'Ambetter' },  // Centene is Ambetter's parent
]

export function normalizeInsurer(raw: string | null | undefined): string {
  if (!raw) return raw || ''
  const lower = raw.toLowerCase().trim()

  for (const { keywords, standard } of INSURER_MAP) {
    for (const kw of keywords) {
      if (lower.includes(kw.toLowerCase())) return standard
    }
  }

  // No match — return cleaned up original (trim extra spaces)
  return raw.trim()
}

export function wasNormalized(raw: string | null | undefined): boolean {
  if (!raw) return false
  const normalized = normalizeInsurer(raw)
  return normalized !== raw.trim()
}
