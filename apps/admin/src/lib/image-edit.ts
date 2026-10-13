/**
 * The image editor's pixel work, in the browser: draws the crop of a rotated or flipped photo
 * with the merchant's adjustments onto a canvas and returns it as a file to upload. The upload
 * pipeline then makes its AVIF/WebP sizes as for any upload, so this only has to be faithful.
 */

export type ImageAdjust = {
  /** -100…100; 0 leaves the photo as it is. */
  brightness: number
  contrast: number
  saturation: number
  /** Positive is warmer (yellower), negative cooler (bluer). */
  warmth: number
  /** 0…100. */
  sharpen: number
}

export type CropArea = { x: number; y: number; width: number; height: number }

export type ImageEdit = {
  /** In pixels of the rotated (and flipped) photo, as react-easy-crop reports it. */
  crop: CropArea
  rotation: 0 | 90 | 180 | 270
  flipX: boolean
  flipY: boolean
  adjust: ImageAdjust
}

export const NO_ADJUST: ImageAdjust = {
  brightness: 0,
  contrast: 0,
  saturation: 0,
  warmth: 0,
  sharpen: 0,
}

/** Photos the editor can open: raster images, not videos, SVGs or (animated) GIFs. */
export function isEditableImage(contentType: string | null | undefined): boolean {
  const type = contentType ?? ''
  return type.startsWith('image/') && type !== 'image/svg+xml' && type !== 'image/gif'
}

/** The longest side an edited photo keeps; the pipeline's largest size is 1920. */
const MAX_SIDE = 4096

/**
 * The adjustments as a CSS filter: the same string drives the live preview and the canvas, so
 * what the merchant sees is what gets saved (sharpening is applied on the canvas only).
 */
export function adjustFilter(a: ImageAdjust): string {
  const parts = [
    `brightness(${1 + a.brightness / 100})`,
    `contrast(${1 + a.contrast / 100})`,
    `saturate(${1 + a.saturation / 100})`,
  ]
  if (a.warmth > 0) parts.push(`sepia(${(a.warmth / 100) * 0.35})`)
  if (a.warmth < 0) parts.push(`hue-rotate(${(a.warmth / 100) * 18}deg)`)
  return parts.join(' ')
}

/** Loads a stored photo for editing; the query string skips a cached copy fetched without CORS. */
export function loadEditableImage(url: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.crossOrigin = 'anonymous'
    img.onload = () => resolve(img)
    img.onerror = () => reject(new Error('image_load_failed'))
    const sep = url.includes('?') ? '&' : '?'
    img.src = url.startsWith('blob:') ? url : `${url}${sep}edit=${Date.now()}`
  })
}

/** The photo turned and flipped, at full size, with the adjustments baked in. */
function orientedCanvas(img: HTMLImageElement, edit: ImageEdit): HTMLCanvasElement {
  const turned = edit.rotation === 90 || edit.rotation === 270
  const canvas = document.createElement('canvas')
  canvas.width = turned ? img.naturalHeight : img.naturalWidth
  canvas.height = turned ? img.naturalWidth : img.naturalHeight
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('canvas_unavailable')
  ctx.filter = adjustFilter(edit.adjust)
  ctx.translate(canvas.width / 2, canvas.height / 2)
  ctx.rotate((edit.rotation * Math.PI) / 180)
  ctx.scale(edit.flipX ? -1 : 1, edit.flipY ? -1 : 1)
  ctx.drawImage(img, -img.naturalWidth / 2, -img.naturalHeight / 2)
  return canvas
}

/** A light unsharp mask: each pixel pushed away from the average of its four neighbours. */
function sharpen(ctx: CanvasRenderingContext2D, width: number, height: number, amount: number) {
  if (amount <= 0) return
  const k = (amount / 100) * 0.8
  const src = ctx.getImageData(0, 0, width, height)
  const out = ctx.createImageData(width, height)
  const s = src.data
  const d = out.data
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const i = (y * width + x) * 4
      const up = y > 0 ? i - width * 4 : i
      const down = y < height - 1 ? i + width * 4 : i
      const left = x > 0 ? i - 4 : i
      const right = x < width - 1 ? i + 4 : i
      for (let c = 0; c < 3; c++) {
        const around =
          ((s[up + c] ?? 0) + (s[down + c] ?? 0) + (s[left + c] ?? 0) + (s[right + c] ?? 0)) / 4
        const v = (s[i + c] ?? 0) + k * ((s[i + c] ?? 0) - around)
        d[i + c] = v < 0 ? 0 : v > 255 ? 255 : v
      }
      d[i + 3] = s[i + 3] ?? 255
    }
  }
  ctx.putImageData(out, 0, 0)
}

/** The edited photo as a file, named after the original, in a type uploads accept. */
export async function renderEditedImage(
  img: HTMLImageElement,
  edit: ImageEdit,
  name: string,
  keepTransparency: boolean,
): Promise<File> {
  const oriented = orientedCanvas(img, edit)
  const scale = Math.min(1, MAX_SIDE / Math.max(edit.crop.width, edit.crop.height))
  const out = document.createElement('canvas')
  out.width = Math.max(1, Math.round(edit.crop.width * scale))
  out.height = Math.max(1, Math.round(edit.crop.height * scale))
  const ctx = out.getContext('2d')
  if (!ctx) throw new Error('canvas_unavailable')
  ctx.imageSmoothingQuality = 'high'
  ctx.drawImage(
    oriented,
    edit.crop.x,
    edit.crop.y,
    edit.crop.width,
    edit.crop.height,
    0,
    0,
    out.width,
    out.height,
  )
  sharpen(ctx, out.width, out.height, edit.adjust.sharpen)
  const type = keepTransparency ? 'image/png' : 'image/jpeg'
  const blob = await new Promise<Blob | null>((resolve) => out.toBlob(resolve, type, 0.92))
  if (!blob) throw new Error('encode_failed')
  const base = name.replace(/\.[a-z0-9]+$/i, '') || 'image'
  return new File([blob], `${base}-edited.${keepTransparency ? 'png' : 'jpg'}`, { type })
}

/**
 * "Auto": reads a small copy of the photo and suggests brightness and contrast that spread its
 * tones over the full range (a dim, flat phone photo gets lifted; a good one is left alone).
 */
export function autoAdjust(img: HTMLImageElement): ImageAdjust {
  const canvas = document.createElement('canvas')
  const scale = Math.min(1, 256 / Math.max(img.naturalWidth, img.naturalHeight))
  canvas.width = Math.max(1, Math.round(img.naturalWidth * scale))
  canvas.height = Math.max(1, Math.round(img.naturalHeight * scale))
  const ctx = canvas.getContext('2d', { willReadFrequently: true })
  if (!ctx) return NO_ADJUST
  ctx.drawImage(img, 0, 0, canvas.width, canvas.height)
  const { data } = ctx.getImageData(0, 0, canvas.width, canvas.height)
  let sum = 0
  let sumSq = 0
  const n = data.length / 4
  for (let i = 0; i < data.length; i += 4) {
    const l = 0.299 * (data[i] ?? 0) + 0.587 * (data[i + 1] ?? 0) + 0.114 * (data[i + 2] ?? 0)
    sum += l
    sumSq += l * l
  }
  const mean = sum / n
  const sd = Math.sqrt(Math.max(0, sumSq / n - mean * mean))
  const clamp = (v: number) => Math.round(Math.max(-40, Math.min(40, v)))
  return {
    brightness: clamp(((128 - mean) / 128) * 60),
    contrast: clamp(((60 - sd) / 60) * 50),
    saturation: 8,
    warmth: 0,
    sharpen: 20,
  }
}
