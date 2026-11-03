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

type BugReportHostProps = {
  /**
   * `frame` (default): absolute, bottom-left of the admin shell's panel. `screen`: fixed to the
   * window's bottom-right, for full-screen tools without the shell (theme editor, onboarding).
   */
  placement?: 'frame' | 'screen'
  /** Reports go to a public issue tracker (`issuesArePublic`). */
  publicIssues?: boolean | undefined
}

/** Floating button classes per placement; the shared look comes from BUTTON_LOOK. */
const BUTTON_PLACEMENT = {
  frame:
    'absolute bottom-[calc(max(1rem,env(safe-area-inset-bottom))+3.25rem)] left-4 md:bottom-5 md:left-5',
  screen:
    'fixed right-4 bottom-[calc(max(1rem,env(safe-area-inset-bottom))+0.25rem)] md:right-5 md:bottom-5',
} as const

/* Smaller and half-faded until hovered or focused: it sat over page content (audit #24); the
   account menu opens the same flow. */
const BUTTON_LOOK =
  'z-30 flex size-8 touch-manipulation items-center justify-center rounded-full border border-border bg-card text-muted-foreground opacity-50 shadow-popover transition-[color,border-color,scale,opacity] duration-150 ease-out hover:border-border-strong hover:text-foreground hover:opacity-100 focus-visible:opacity-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring active:scale-[0.96] disabled:cursor-progress [body:has([data-save-bar])_&]:hidden'

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
export default function BugReportHost({
  placement = 'frame',
  publicIssues = false,
}: BugReportHostProps) {
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
          className={`${BUTTON_PLACEMENT[placement]} ${BUTTON_LOOK}`}
        >
          {capturing ? <Spinner className="size-4" /> : <BugIcon className="size-4.5" />}
        </TooltipTrigger>
        <TooltipContent side={placement === 'screen' ? 'left' : 'right'}>
          {copy.open}
        </TooltipContent>
      </Tooltip>
      <BugReportDialog
        open={open}
        onOpenChange={handleOpenChange}
        screenshot={screenshot}
        publicIssues={publicIssues}
      />
    </>
  )
}
