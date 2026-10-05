'use client'

import { BugIcon } from '@commerce/ui/icons'
import { Spinner } from '@commerce/ui/shadcn/spinner'
import { Tooltip, TooltipContent, TooltipTrigger } from '@commerce/ui/shadcn/tooltip'
import { type RefObject, useEffect, useRef, useState } from 'react'
import { bugReportContent } from '@/data/bug-report'
import { useCopy } from '@/hooks/use-copy'
import { OPEN_BUG_REPORT_EVENT } from '@/lib/bug-report-events'
import { capturePage } from '@/lib/capture-page'
import BugReportDialog from './bug-report-dialog'

type Flow = {
  busy: RefObject<boolean>
  setCapturing: (on: boolean) => void
  setScreenshot: (shot: string | null) => void
  setOpen: (open: boolean) => void
}

/** Picture first (so the dialog is never in it), then the dialog. One at a time. */
async function captureThenOpen(flow: Flow): Promise<void> {
  if (flow.busy.current) return
  flow.busy.current = true
  flow.setCapturing(true)
  try {
    flow.setScreenshot(await capturePage())
    flow.setOpen(true)
  } finally {
    flow.busy.current = false
    flow.setCapturing(false)
  }
}

/**
 * "Report a bug" (test server only, mounted when `BUG_REPORTS_ENABLED`): a small round button
 * at the bottom left of the page panel (above Next's dev badge on phones), and the dialog. The
 * account menu opens the same flow through `openBugReport()`. The button is left out of the
 * screenshot.
 */
export default function BugReportHost() {
  // Hooks
  const copy = useCopy(bugReportContent)
  const [open, setOpen] = useState(false)
  const [capturing, setCapturing] = useState(false)
  const [screenshot, setScreenshot] = useState<string | null>(null)
  const busy = useRef(false)
  useEffect(() => {
    const onOpen = () => void captureThenOpen({ busy, setCapturing, setScreenshot, setOpen })
    window.addEventListener(OPEN_BUG_REPORT_EVENT, onOpen)
    return () => window.removeEventListener(OPEN_BUG_REPORT_EVENT, onOpen)
  }, [])

  // Event handlers
  const handleStart = () => void captureThenOpen({ busy, setCapturing, setScreenshot, setOpen })

  const handleOpenChange = (next: boolean) => {
    setOpen(next)
    if (!next) setScreenshot(null)
  }

  return (
    <>
      <Tooltip>
        <TooltipTrigger
          data-screenshot-skip=""
          onClick={handleStart}
          aria-label={copy.open}
          aria-busy={capturing}
          disabled={capturing}
          className="absolute bottom-[calc(max(1rem,env(safe-area-inset-bottom))+3.25rem)] left-4 z-30 flex size-10 touch-manipulation items-center justify-center rounded-full border border-border bg-card text-muted-foreground shadow-popover transition-[color,border-color,scale] duration-150 ease-out hover:border-border-strong hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring active:scale-[0.96] disabled:cursor-progress md:bottom-5 md:left-5 [body:has([data-save-bar])_&]:hidden"
        >
          {capturing ? <Spinner className="size-4" /> : <BugIcon className="size-4.5" />}
        </TooltipTrigger>
        <TooltipContent side="right">{copy.open}</TooltipContent>
      </Tooltip>
      <BugReportDialog open={open} onOpenChange={handleOpenChange} screenshot={screenshot} />
    </>
  )
}
