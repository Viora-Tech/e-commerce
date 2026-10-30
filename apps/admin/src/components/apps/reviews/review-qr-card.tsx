'use client'

import { Copy, Download } from '@commerce/ui/icons'
import { Button } from '@commerce/ui/shadcn/button'
import { Spinner } from '@commerce/ui/shadcn/spinner'
import { toDataURL, toString as toSvg } from 'qrcode'
import { useEffect, useState } from 'react'
import { toast } from 'sonner'
import DataCard from '@/components/layout/data-card'
import { reviewToolsContent } from '@/data/review-tools'
import { useCopy } from '@/hooks/use-copy'

type ReviewQrCardProps = {
  title: string
  url: string
  storeName: string
}

/** Print size: sharp on a parcel insert; the quiet zone is the 4 modules the spec asks for. */
const OPTIONS = { width: 900, margin: 4, errorCorrectionLevel: 'M' } as const

/** The printable card: 4:5 portrait with the 900px code in the middle (canvas pixels). */
const CARD = { width: 1200, height: 1500 }

/** Card ink: printed on white paper whatever the admin's theme, so fixed print colours. */
const INK = { paper: '#ffffff', text: '#111111', muted: '#555555' }

/** Saves a URL (data or blob) under a file name. */
function save(href: string, filename: string) {
  const a = document.createElement('a')
  a.href = href
  a.download = filename
  a.click()
}

/** `Maboroshi mousepad` → `maboroshi-mousepad`, for file names. */
function slug(text: string): string {
  const s = text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 60)
  return s || 'review'
}

/** The text cut to fit `maxWidth` on the canvas. */
function fitText(ctx: CanvasRenderingContext2D, text: string, maxWidth: number): string {
  if (ctx.measureText(text).width <= maxWidth) return text
  let cut = text
  while (cut.length > 1 && ctx.measureText(`${cut}...`).width > maxWidth) cut = cut.slice(0, -1)
  return `${cut.trimEnd()}...`
}

/** Draws the card (heading, product, code, hint, store name) and returns it as a PNG data URL. */
async function drawCard(
  png: string,
  text: { heading: string; title: string; scan: string; store: string },
): Promise<string> {
  const img = new Image()
  img.src = png
  await img.decode()
  const canvas = document.createElement('canvas')
  canvas.width = CARD.width
  canvas.height = CARD.height
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('canvas')
  const line = (value: string, font: string, color: string, y: number) => {
    ctx.font = font
    ctx.fillStyle = color
    ctx.fillText(fitText(ctx, value, CARD.width - 120), CARD.width / 2, y)
  }
  ctx.fillStyle = INK.paper
  ctx.fillRect(0, 0, CARD.width, CARD.height)
  ctx.textAlign = 'center'
  line(text.heading, '600 64px system-ui, sans-serif', INK.text, 140)
  line(text.title, '400 44px system-ui, sans-serif', INK.text, 220)
  ctx.drawImage(img, (CARD.width - OPTIONS.width) / 2, 280, OPTIONS.width, OPTIONS.width)
  line(text.scan, '400 36px system-ui, sans-serif', INK.muted, 1260)
  line(text.store, '600 40px system-ui, sans-serif', INK.text, 1380)
  return canvas.toDataURL('image/png')
}

/**
 * One product's review QR, made in the browser with `qrcode` (MIT, already used for Growth's
 * links): a preview, a printable PNG card with the store's name, the bare code as SVG, and the
 * link itself.
 */
export default function ReviewQrCard({ title, url, storeName }: ReviewQrCardProps) {
  // Hooks
  const { qr: copy } = useCopy(reviewToolsContent)
  const [png, setPng] = useState<string | null>(null)
  const [failed, setFailed] = useState(false)
  useEffect(() => {
    let live = true
    toDataURL(url, OPTIONS)
      .then((data) => live && setPng(data))
      .catch(() => live && setFailed(true))
    return () => {
      live = false
    }
  }, [url])

  // Event handlers
  const handleCard = async () => {
    if (!png) return
    try {
      const card = await drawCard(png, {
        heading: copy.heading,
        title,
        scan: copy.scan,
        store: storeName,
      })
      save(card, `${slug(title)}-review-card.png`)
    } catch {
      toast.error(copy.failed)
    }
  }
  const handleSvg = async () => {
    const svg = await toSvg(url, { ...OPTIONS, type: 'svg' })
    const href = URL.createObjectURL(new Blob([svg], { type: 'image/svg+xml' }))
    save(href, `${slug(title)}-review-qr.svg`)
    URL.revokeObjectURL(href)
  }
  const handleCopy = async () => {
    await navigator.clipboard.writeText(url)
    toast.success(copy.copied)
  }

  return (
    <DataCard title={title}>
      <div className="flex flex-col items-center gap-3">
        <div className="flex aspect-square w-full max-w-[16rem] items-center justify-center rounded-lg border border-border bg-card p-2">
          {failed ? (
            <p className="text-body text-muted-foreground">{copy.failed}</p>
          ) : png ? (
            // biome-ignore lint/performance/noImgElement: a data URL made in the browser, nothing to optimise.
            <img src={png} alt={copy.alt(title)} className="size-full" />
          ) : (
            <Spinner />
          )}
        </div>
        <p className="w-full break-all text-center text-caption text-muted-foreground">{url}</p>
        <div className="flex flex-wrap justify-end gap-2 self-stretch">
          <Button variant="outline" onClick={() => void handleCopy()}>
            <Copy aria-hidden="true" />
            {copy.copyLink}
          </Button>
          <Button variant="outline" onClick={() => void handleSvg()} disabled={!png}>
            <Download aria-hidden="true" />
            {copy.svg}
          </Button>
          <Button onClick={() => void handleCard()} disabled={!png}>
            <Download aria-hidden="true" />
            {copy.png}
          </Button>
        </div>
      </div>
    </DataCard>
  )
}
