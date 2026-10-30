'use client'

import { PAST_ORDERS_MAX, PAST_ORDERS_PER_HOUR } from '@commerce/plugin-reviews/settings'
import { Send } from '@commerce/ui/icons'
import { Button } from '@commerce/ui/shadcn/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@commerce/ui/shadcn/dialog'
import { Input } from '@commerce/ui/shadcn/input'
import { Label } from '@commerce/ui/shadcn/label'
import { Spinner } from '@commerce/ui/shadcn/spinner'
import { useEffect, useState } from 'react'
import { toast } from 'sonner'
import { reviewToolsContent } from '@/data/review-tools'
import { reviewsContent } from '@/data/reviews'
import { useCopy } from '@/hooks/use-copy'
import { api } from '@/lib/api-client'

type Preview = Awaited<ReturnType<typeof api.reviews.pastOrdersPreview>>

const DAY = 24 * 60 * 60 * 1000

/** The range the dialog opens with: the last 60 days, as "Ask for reviews" always asked. */
const DEFAULT_DAYS = 60

/** `yyyy-mm-dd` of a moment, in the browser's time zone (what a date input shows). */
function dayInput(at: Date): string {
  return new Date(at.getTime() - at.getTimezoneOffset() * 60_000).toISOString().slice(0, 10)
}

/** The picked days as the API's range: the start of the first to the end of the last, locally. */
function rangeInput(from: string, to: string) {
  return {
    from: new Date(`${from}T00:00:00`).toISOString(),
    to: new Date(`${to}T23:59:59.999`).toISOString(),
  }
}

/**
 * "Ask for reviews" (Request reviews from past orders): the merchant picks a delivery date
 * range, sees how many orders would be asked and how long the requests take to go out (they
 * leave a batch an hour), then sends.
 */
export default function AskReviewsButton() {
  // Hooks
  const { list: copy } = useCopy(reviewsContent)
  const { pastOrders: past } = useCopy(reviewToolsContent)
  const [open, setOpen] = useState(false)
  const [from, setFrom] = useState(() => dayInput(new Date(Date.now() - DEFAULT_DAYS * DAY)))
  const [to, setTo] = useState(() => dayInput(new Date()))
  // Keyed by the range it counted, so a stale count never shows for new dates.
  const [preview, setPreview] = useState<{ key: string; data: Preview | null; error: string }>({
    key: '',
    data: null,
    error: '',
  })
  const [busy, setBusy] = useState(false)
  useEffect(() => {
    if (!open || !from || !to) return
    let live = true
    const key = `${from}|${to}`
    api.reviews
      .pastOrdersPreview(rangeInput(from, to))
      .then((data) => live && setPreview({ key, data, error: '' }))
      .catch(
        (err: unknown) =>
          live &&
          setPreview({
            key,
            data: null,
            error: err instanceof Error ? err.message : reviewsContent.list.failed,
          }),
      )
    return () => {
      live = false
    }
  }, [open, from, to])

  // Event handlers
  const handleSend = async () => {
    setBusy(true)
    try {
      const r = await api.reviews.askPastOrders(rangeInput(from, to))
      toast.success(past.done(r.orders))
      setOpen(false)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : copy.failed)
    } finally {
      setBusy(false)
    }
  }

  // Render logic
  const current = preview.key === `${from}|${to}` ? preview : null
  const orders = current?.data?.orders ?? 0

  return (
    <>
      <Button type="button" onClick={() => setOpen(true)}>
        <Send aria-hidden="true" />
        {copy.ask}
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{past.title}</DialogTitle>
            <DialogDescription>{past.body}</DialogDescription>
          </DialogHeader>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="ask-from">{past.from}</Label>
              <Input
                id="ask-from"
                type="date"
                value={from}
                max={to}
                onChange={(e) => setFrom(e.target.value)}
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="ask-to">{past.to}</Label>
              <Input
                id="ask-to"
                type="date"
                value={to}
                min={from}
                max={dayInput(new Date())}
                onChange={(e) => setTo(e.target.value)}
              />
            </div>
          </div>
          <div className="flex flex-col gap-1 text-body" aria-live="polite">
            {!current ? (
              <span className="flex items-center gap-2 text-muted-foreground">
                <Spinner />
                {past.counting}
              </span>
            ) : current.error ? (
              <span className="text-destructive">{current.error}</span>
            ) : orders === 0 ? (
              <span className="text-muted-foreground">{past.none}</span>
            ) : (
              <span>{past.preview(orders, current.data?.hours ?? 0, PAST_ORDERS_PER_HOUR)}</span>
            )}
            {current?.data?.capped && (
              <span className="text-caption text-muted-foreground">
                {past.capped(PAST_ORDERS_MAX)}
              </span>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>
              {past.cancel}
            </Button>
            <Button onClick={handleSend} disabled={busy || orders === 0}>
              {busy ? <Spinner /> : <Send aria-hidden="true" />}
              {past.send(orders)}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
