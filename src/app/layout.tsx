import type { Metadata } from 'next'
import { Inter } from 'next/font/google'
import './globals.css'

const inter = Inter({ subsets: ['latin'], variable: '--font-inter' })

export const metadata: Metadata = {
  title: 'CRM Seguros',
  description: 'CRM para agentes de seguros de salud',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning className={inter.variable}>
      <body style={{ background: 'var(--surface-base)' }}>
        {children}
      </body>
    </html>
  )
}
