'use client'

import { QrCodeIcon } from '@commerce/ui/icons'
import { Button } from '@commerce/ui/shadcn/button'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@commerce/ui/shadcn/dialog'
import { toDataURL } from 'qrcode'
import { useEffect, useState } from 'react'
import { affiliatePortalContent } from '@/data/affiliate-portal'

type QrDialogProps = { link: string; code: string }

const copy = affiliatePortalContent.dashboard.link

/** Their link as a QR code, to show or download as a PNG. */
export default function QrDialog({ link, code }: QrDialogProps) {
  // Hooks
  const [src, setSrc] = useState<string | null>(null)

  useEffect(() => {
    let live = true
    toDataURL(link, { margin: 1, width: 512 })
      .then((s) => {
        if (live) setSrc(s)
      })
      .catch(() => setSrc(null))
    return () => {
      live = false
    }
  }, [link])

  // Render logic
  return (
    <Dialog>
      <DialogTrigger render={<Button variant="outline" size="sm" />}>
        <QrCodeIcon />
        {copy.qr}
      </DialogTrigger>
      <DialogContent className="sm:max-w-[22rem]">
        <DialogHeader>
          <DialogTitle>{copy.qr}</DialogTitle>
        </DialogHeader>
        {src ? (
          <div className="flex flex-col items-center gap-4">
            {/* biome-ignore lint/performance/noImgElement: a generated data URL, not a remote image */}
            <img src={src} alt={copy.qrAlt} className="size-56 rounded-md bg-white p-2" />
            <Button
              nativeButton={false}
              render={<a href={src} download={`${code}-qr.png`} />}
              className="w-full"
            >
              {copy.qrDownload}
            </Button>
          </div>
        ) : null}
      </DialogContent>
    </Dialog>
  )
}
