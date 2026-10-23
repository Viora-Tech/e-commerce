'use client'

import { Send } from '@commerce/ui/icons'
import { Button } from '@commerce/ui/shadcn/button'
import { Checkbox } from '@commerce/ui/shadcn/checkbox'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@commerce/ui/shadcn/dialog'
import { Field, FieldDescription, FieldLabel } from '@commerce/ui/shadcn/field'
import { Input } from '@commerce/ui/shadcn/input'
import { Spinner } from '@commerce/ui/shadcn/spinner'
import { Textarea } from '@commerce/ui/shadcn/textarea'
import { type FormEvent, useState } from 'react'
import { toast } from 'sonner'
import { bugReportContent } from '@/data/bug-report'
import { useCopy } from '@/hooks/use-copy'
import { api } from '@/lib/api-client'
import { recentClientErrors } from '@/lib/client-errors'

type BugReportDialogProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  /** The page as it looked before the dialog opened; null when it could not be taken. */
  screenshot: string | null
}

const SUMMARY_MAX = 200
const DETAILS_MAX = 4000

/** Where the member is, without the origin (the issue says which server). */
function currentPath(): string {
  return `${window.location.pathname}${window.location.search}`
}

/**
 * "Report a bug" (test server only): what went wrong, what they did just before, and an
 * optional screenshot taken before this opened. Sends one GitHub issue (`bugReports.create`).
 */
export default function BugReportDialog({ open, onOpenChange, screenshot }: BugReportDialogProps) {
  // Hooks
  const copy = useCopy(bugReportContent)
  const [summary, setSummary] = useState('')
  const [details, setDetails] = useState('')
  const [includeShot, setIncludeShot] = useState(true)
  const [sending, setSending] = useState(false)

  // Helpers
  const reset = () => {
    setSummary('')
    setDetails('')
    setIncludeShot(true)
  }

  // Event handlers
  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()
    if (!summary.trim() || sending) return
    setSending(true)
    try {
      const result = await api.bugReports.create({
        summary: summary.trim(),
        details: details.trim() || undefined,
        path: currentPath(),
        viewport: `${window.innerWidth}x${window.innerHeight}`,
        userAgent: navigator.userAgent,
        recentErrors: recentClientErrors(),
        screenshot: includeShot && screenshot ? screenshot : undefined,
      })
      if (result.number !== null && result.url) {
        const url = result.url
        toast.success(copy.sent(result.number), {
          action: { label: copy.view, onClick: () => window.open(url, '_blank', 'noopener') },
        })
      } else {
        toast.success(copy.logged)
      }
      reset()
      onOpenChange(false)
    } catch (err) {
      toast.error(err instanceof Error && err.message ? err.message : copy.failed)
    } finally {
      setSending(false)
    }
  }

  // Render logic
  const canSend = summary.trim().length > 0 && !sending

  return (
    <Dialog open={open} onOpenChange={(o) => (sending ? undefined : onOpenChange(o))}>
      <DialogContent className="max-h-[calc(100dvh-2rem)] overflow-y-auto overscroll-contain sm:max-w-md">
        <form onSubmit={handleSubmit} className="flex flex-col gap-5">
          <DialogHeader>
            <DialogTitle>{copy.title}</DialogTitle>
            <DialogDescription>{copy.intro}</DialogDescription>
          </DialogHeader>

          <Field>
            <FieldLabel htmlFor="bug-summary">{copy.summaryLabel}</FieldLabel>
            <Input
              id="bug-summary"
              value={summary}
              maxLength={SUMMARY_MAX}
              placeholder={copy.summaryPlaceholder}
              onChange={(e) => setSummary(e.target.value)}
              autoComplete="off"
              required
              autoFocus
            />
          </Field>

          <Field>
            <FieldLabel htmlFor="bug-details">{copy.detailsLabel}</FieldLabel>
            <Textarea
              id="bug-details"
              rows={3}
              value={details}
              maxLength={DETAILS_MAX}
              placeholder={copy.detailsPlaceholder}
              onChange={(e) => setDetails(e.target.value)}
              className="max-h-48"
            />
          </Field>

          {screenshot ? (
            <Field orientation="horizontal" className="items-start gap-3">
              <Checkbox
                id="bug-screenshot"
                checked={includeShot}
                onCheckedChange={(v) => setIncludeShot(v === true)}
                className="mt-0.5"
              />
              <div className="flex min-w-0 flex-1 flex-col gap-0.5">
                <FieldLabel htmlFor="bug-screenshot">{copy.screenshotLabel}</FieldLabel>
                <FieldDescription>{copy.screenshotHelp}</FieldDescription>
              </div>
              {/* biome-ignore lint/performance/noImgElement: an in-memory data URL preview, nothing to optimise. */}
              <img
                src={screenshot}
                alt={copy.screenshotAlt}
                className="h-14 w-20 shrink-0 rounded-md object-cover object-top ring-1 ring-border transition-opacity duration-150 ease-out data-[off=true]:opacity-40"
                data-off={!includeShot}
              />
            </Field>
          ) : (
            <p className="text-body text-muted-foreground">{copy.screenshotFailed}</p>
          )}

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={sending}
            >
              {copy.cancel}
            </Button>
            <Button type="submit" disabled={!canSend}>
              {sending ? <Spinner /> : <Send aria-hidden="true" />}
              {sending ? copy.sending : copy.send}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
