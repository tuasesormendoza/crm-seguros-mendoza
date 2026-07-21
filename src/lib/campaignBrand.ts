import { prisma } from '@/lib/prisma'
import type { CampaignBrand } from '@/lib/campaignRender'

// Construye la marca de la agencia (logo, colores, contacto) para el correo de
// campaña, a partir de su Configuración. El logo se sirve por URL ABSOLUTA
// (/api/logo/[agencyId]) porque Gmail y otros bloquean los data: URLs.
export async function getCampaignBrand(agencyId: string, origin: string): Promise<CampaignBrand> {
  const rows = await prisma.settings.findMany({
    where: { agencyId, key: { in: ['agentName', 'agentPhone', 'agentWhatsApp', 'agentEmail', 'themeBrand800', 'themeAccent', 'logoUrl', 'googleReviewLink'] } },
    select: { key: true, value: true },
  })
  const s: Record<string, string> = {}
  rows.forEach(r => { s[r.key] = r.value })

  return {
    agencyName: s.agentName || 'Tu agente de seguros',
    logoUrl: s.logoUrl ? `${origin}/api/logo/${agencyId}` : '',
    headerColor: s.themeBrand800 || '#0D2A4A',
    accentColor: s.themeAccent || '#2a6496',
    phone: s.agentPhone || '',
    whatsapp: s.agentWhatsApp || '',
    email: s.agentEmail || '',
    reviewLink: s.googleReviewLink || '',
  }
}
