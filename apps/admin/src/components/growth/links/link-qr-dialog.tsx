'use client'

import { Download } from '@commerce/ui/icons'
import { Button } from '@commerce/ui/shadcn/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@commerce/ui/shadcn/dialog'
import { Spinner } from '@commerce/ui/shadcn/spinner'
import { toDataURL, toString as toSvg } from 'qrcode'
import { useEffect, useState } from 'react'
import { linkQrContent } from '@/data/growth-report'
import { useCopy } from '@/hooks/use-copy'

type LinkQrDialogProps = {
  name: string
  slug: string
  /** The full short link the code opens. */
  url: string
  onClose: () => void
}

/** Print size: 1024px is sharp on a flyer; the quiet zone is the 4 modules the spec asks for. */
const OPTIONS = { width: 1024, margin: 4, errorCorrectionLevel: 'M' } as const

/** Saves a URL (data or blob) under a file name. */
function save(href: string, filename: string) {
  const a = document.createElement('a')
  a.href = href
  a.download = filename
  a.click()
}

/**
 * A short link's QR code, made in the browser with `qrcode` (MIT), with PNG and SVG
 * downloads. It encodes the short link itself, so every scan is counted as a click.
 */
export default function LinkQrDialog({ name, slug, url, onClose }: LinkQrDialogProps) {
  // Hooks
  const copy = useCopy(linkQrContent)
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
  const handlePng = () => {
    if (png) save(png, `${slug}-qr.png`)
  }

  const handleSvg = async () => {
    const svg = await toSvg(url, { ...OPTIONS, type: 'svg' })
    const href = URL.createObjectURL(new Blob([svg], { type: 'image/svg+xml' }))
    save(href, `${slug}-qr.svg`)
    URL.revokeObjectURL(href)
  }

  // Render logic
  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>{copy.title(name)}</DialogTitle>
          <DialogDescription>{copy.body}</DialogDescription>
        </DialogHeader>
        <div className="flex flex-col items-center gap-2">
          <div className="flex aspect-square w-full max-w-[16rem] items-center justify-center rounded-lg border border-border bg-card p-2">
            {failed ? (
              <p className="text-body text-muted-foreground">{copy.failed}</p>
            ) : png ? (
              // biome-ignore lint/performance/noImgElement: a data URL made in the browser, nothing to optimise.
              <img src={png} alt={copy.alt(url)} className="size-full" />
            ) : (
              <Spinner />
            )}
          </div>
          <p className="break-all text-center text-caption text-muted-foreground">{url}</p>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            {copy.close}
          </Button>
          <Button variant="outline" onClick={() => void handleSvg()} disabled={!png}>
            <Download aria-hidden />
            {copy.svg}
          </Button>
          <Button onClick={handlePng} disabled={!png}>
            <Download aria-hidden />
            {copy.png}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
