import { type ClassValue, clsx } from 'clsx'
import { twMerge } from 'tailwind-merge'
import { format, differenceInDays } from 'date-fns'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

function toLocalDate(date: Date | string): Date {
  // Prevents UTC-midnight dates from shifting one day back in local timezone
  const d = typeof date === 'string' ? new Date(date) : date
  if (typeof date === 'string' && /^\d{4}-\d{2}-\d{2}T00:00:00/.test(date)) {
    return new Date(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate())
  }
  return d
}

export function formatDate(date: Date | string | null | undefined): string {
  if (!date) return '—'
  return format(toLocalDate(date), 'MM/dd/yyyy')
}

export function formatDateTime(date: Date | string | null | undefined): string {
  if (!date) return '—'
  return format(toLocalDate(date), 'MM/dd/yyyy h:mm a')
}

export function formatCurrency(amount: number | null | undefined): string {
  if (amount == null) return '$0.00'
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(amount)
}

export function getAge(birthDate: Date | string | null | undefined): number | null {
  if (!birthDate) return null
  const d = typeof birthDate === 'string' ? new Date(birthDate) : birthDate

  // Always use UTC values for birth date — dates are stored as UTC midnight
  // This avoids timezone shifts (e.g. 1992-01-07T00:00:00Z → Jan 6 in UTC-5)
  const bYear  = d.getUTCFullYear()
  const bMonth = d.getUTCMonth()   // 0-indexed
  const bDay   = d.getUTCDate()

  const today  = new Date()
  const tYear  = today.getFullYear()
  const tMonth = today.getMonth()  // 0-indexed
  const tDay   = today.getDate()

  let age = tYear - bYear
  // Subtract 1 if birthday hasn't occurred yet this year
  if (tMonth < bMonth || (tMonth === bMonth && tDay < bDay)) age--
  return age >= 0 ? age : null
}

export function getDaysUntilRenewal(renewalDate: Date | string | null | undefined): number | null {
  if (!renewalDate) return null
  const today = new Date()
  const renewal = new Date(renewalDate)
  return differenceInDays(renewal, today)
}
