import type { CampaignImage } from './campaignRender'

// Validación de las imágenes de una campaña (llegan como data URLs base64).
// Límites: 3 imágenes, ~1.5 MB por imagen y ~4 MB en total — suficiente para
// flyers y dentro de lo que Gmail y la función serverless toleran bien.
const MAX_IMAGES = 3
const MAX_PER_IMAGE = 2_000_000   // ~1.5 MB de archivo ≈ 2 MB en base64
const MAX_TOTAL = 5_500_000       // ~4 MB de archivos ≈ 5.5 MB en base64
const DATA_URL_RE = /^data:image\/(png|jpe?g|gif|webp);base64,[A-Za-z0-9+/=]+$/

export function validateCampaignImages(input: unknown): { images: CampaignImage[]; error?: string } {
  if (input == null) return { images: [] }
  if (!Array.isArray(input)) return { images: [], error: 'Formato de imágenes inválido.' }
  if (input.length > MAX_IMAGES) return { images: [], error: `Máximo ${MAX_IMAGES} imágenes por campaña.` }

  const images: CampaignImage[] = []
  let total = 0
  for (const item of input) {
    const name = typeof item?.name === 'string' ? item.name.slice(0, 120) : 'imagen'
    const dataUrl = item?.dataUrl
    if (typeof dataUrl !== 'string' || !DATA_URL_RE.test(dataUrl)) {
      return { images: [], error: 'Solo se permiten imágenes PNG, JPG, GIF o WebP.' }
    }
    if (dataUrl.length > MAX_PER_IMAGE) {
      return { images: [], error: `La imagen "${name}" es muy pesada (máx. ~1.5 MB por imagen).` }
    }
    total += dataUrl.length
    images.push({ name, dataUrl })
  }
  if (total > MAX_TOTAL) return { images: [], error: 'Las imágenes juntas pesan demasiado (máx. ~4 MB en total).' }
  return { images }
}
