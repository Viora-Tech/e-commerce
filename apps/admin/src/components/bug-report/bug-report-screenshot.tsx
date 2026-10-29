'use client'

import { Dialog, DialogContent, DialogTitle } from '@commerce/ui/shadcn/dialog'
import { useState } from 'react'
import { myBugReportsContent } from '@/data/bug-report'
import { useCopy } from '@/hooks/use-copy'

type BugReportScreenshotProps = {
  url: string
  /** The report's title, for the image's description. */
  title: string
}

/** A small thumbnail of the screenshot sent with a report; a click opens it full size in a centred dialog. */
export default function BugReportScreenshot({ url, title }: BugReportScreenshotProps) {
  // Hooks
  const copy = useCopy(myBugReportsContent)
  const [open, setOpen] = useState(false)

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label={copy.screenshot}
        className="motion-press h-14 w-20 shrink-0 overflow-hidden rounded-lg border border-border bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      >
        {/* biome-ignore lint/performance/noImgElement: a remote screenshot on the store's CDN, shown as is */}
        <img
          src={url}
          alt={copy.screenshotAlt(title)}
          loading="lazy"
          className="size-full object-cover object-top"
        />
      </button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-4xl">
          <DialogTitle className="pr-8">{copy.screenshot}</DialogTitle>
          {/* biome-ignore lint/performance/noImgElement: a remote screenshot on the store's CDN, shown as is */}
          <img
            src={url}
            alt={copy.screenshotAlt(title)}
            className="max-h-[75dvh] w-full rounded-lg border border-border object-contain"
          />
        </DialogContent>
      </Dialog>
    </>
  )
}
