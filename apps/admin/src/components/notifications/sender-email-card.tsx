'use client'

import { Badge } from '@commerce/ui/shadcn/badge'
import { Button } from '@commerce/ui/shadcn/button'
import { Card, CardContent } from '@commerce/ui/shadcn/card'
import { Skeleton } from '@commerce/ui/shadcn/skeleton'
import { Spinner } from '@commerce/ui/shadcn/spinner'
import { useEffect, useState } from 'react'
import { toast } from 'sonner'
import ConfirmDialog from '@/components/layout/confirm-dialog'
import { senderEmailContent as copy } from '@/data/sender-email'
import { useSetupNext } from '@/hooks/use-setup-next'
import { api } from '@/lib/api-client'
import SenderDnsTable from './sender-dns-table'
import SenderEmailForm from './sender-email-form'
import SenderPreview from './sender-preview'
import SpamHelp from './spam-help'
import type { SenderEmailOverview } from './types'

/** Re-read the saved status this often while waiting; the worker does the SES checks. */
const POLL_MS = 30_000

const TONE = { pending: 'warning', verified: 'success', failed: 'destructive' } as const

/** The server's refusal code (`data.reason`) in plain words. */
function errorText(err: unknown): string {
  const reason = (err as { data?: { reason?: unknown } } | null)?.data?.reason
  if (typeof reason === 'string' && reason in copy.errors) {
    return copy.errors[reason as keyof typeof copy.errors]
  }
  return err instanceof Error && err.message ? err.message : copy.errors.generic
}

const when = (iso: Date | string) =>
  new Date(iso).toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' })

/**
 * Settings → Notifications → Sender email. The merchant types an address at
 * their own domain; the card lists the DNS records to add, checks them
 * (Check now, plus the worker every few minutes) and shows what customers see
 * in From and Reply-To meanwhile.
 */
export default function SenderEmailCard() {
  // Hooks
  const announceSetup = useSetupNext()
  const [data, setData] = useState<SenderEmailOverview | null>(null)
  const [editing, setEditing] = useState(false)
  const [busy, setBusy] = useState<'save' | 'check' | 'remove' | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [confirmRemove, setConfirmRemove] = useState(false)

  useEffect(() => {
    api.notifications.senderEmail().then(setData)
  }, [])

  // While the domain waits on DNS, re-read the status the worker keeps up to date.
  useEffect(() => {
    if (data?.sender?.status !== 'pending') return
    const timer = setInterval(async () => {
      const next = await api.notifications.senderEmail()
      setData(next)
      if (next.sender?.status === 'verified') toast.success(copy.verifiedToast)
    }, POLL_MS)
    return () => clearInterval(timer)
  }, [data?.sender?.status])

  // Event handlers
  const handleSave = async (input: { email: string; displayName: string }) => {
    setBusy('save')
    setError(null)
    try {
      const next = await api.notifications.setSenderEmail({
        email: input.email,
        displayName: input.displayName || null,
      })
      setData(next)
      setEditing(false)
      toast.success(next.sender?.status === 'verified' ? copy.verifiedToast : copy.saved)
      void announceSetup('notifications')
    } catch (err) {
      setError(errorText(err))
    } finally {
      setBusy(null)
    }
  }

  const handleCheck = async () => {
    setBusy('check')
    try {
      const next = await api.notifications.checkSenderEmail()
      setData(next)
      if (next.restarted) toast.info(copy.restarted)
      else if (next.sender?.status === 'verified') toast.success(copy.verifiedToast)
      else toast.info(copy.stillPending)
    } catch (err) {
      toast.error(errorText(err))
    } finally {
      setBusy(null)
    }
  }

  const handleRemove = async () => {
    setBusy('remove')
    try {
      setData(await api.notifications.removeSenderEmail())
      setEditing(false)
      toast.success(copy.removed)
    } catch (err) {
      toast.error(errorText(err))
    } finally {
      setBusy(null)
      setConfirmRemove(false)
    }
  }

  const handleEdit = () => {
    setError(null)
    setEditing(true)
  }

  const handleCancelEdit = () => setEditing(false)

  // Early returns
  if (!data) {
    return (
      <Card gap={3} inset={6}>
        <Skeleton className="h-5 w-48" />
        <Skeleton className="h-10 w-full" />
      </Card>
    )
  }

  // Render logic
  const sender = data.sender
  const reason = sender?.error ? copy.reasons[sender.error] : null

  return (
    <Card>
      <CardContent className="flex flex-col gap-4">
        {data.ownApp ? (
          <p className="rounded-lg border border-border p-3 text-body text-muted-foreground">
            {copy.ownApp}
          </p>
        ) : null}

        {!sender || editing ? (
          <SenderEmailForm
            initialEmail={sender?.email ?? ''}
            initialName={sender?.displayName ?? ''}
            storeName={data.storeName}
            saving={busy === 'save'}
            error={error}
            changing={Boolean(sender)}
            onSave={handleSave}
            onCancel={sender ? handleCancelEdit : undefined}
          />
        ) : (
          <div className="flex flex-col gap-3 sm:flex-row sm:items-start">
            <div className="flex min-w-0 flex-1 flex-col gap-1">
              <div className="flex flex-wrap items-center gap-2">
                <p className="font-mono text-body font-medium break-all text-foreground">
                  {sender.email}
                </p>
                <Badge variant={TONE[sender.status]}>{copy.status[sender.status]}</Badge>
              </div>
              <p className="text-caption text-muted-foreground">{copy.statusHelp[sender.status]}</p>
              {reason ? <p className="text-caption text-destructive">{reason}</p> : null}
              {sender.lastCheckedAt ? (
                <p className="text-caption text-muted-foreground">
                  {copy.checkedAt(when(sender.lastCheckedAt))}
                </p>
              ) : null}
            </div>
            <div className="flex flex-col gap-2 sm:flex-row">
              {sender.status !== 'verified' ? (
                <Button onClick={handleCheck} disabled={busy !== null} className="w-full sm:w-auto">
                  {busy === 'check' ? <Spinner /> : null}
                  {busy === 'check' ? copy.checking : copy.checkNow}
                </Button>
              ) : null}
              <Button variant="outline" onClick={handleEdit} className="w-full sm:w-auto">
                {copy.form.change}
              </Button>
            </div>
          </div>
        )}

        <SenderPreview preview={data.preview} devOnly={!data.platformSending} />

        {sender && !editing ? <SenderDnsTable records={sender.records} /> : null}

        <div className="flex flex-wrap items-center justify-between gap-3">
          <SpamHelp />
          {sender && !editing ? (
            <Button
              variant="ghost"
              className="text-destructive"
              disabled={busy !== null}
              onClick={() => setConfirmRemove(true)}
            >
              {copy.remove}
            </Button>
          ) : null}
        </div>
      </CardContent>

      <ConfirmDialog
        open={confirmRemove}
        onOpenChange={setConfirmRemove}
        title={copy.remove}
        body={copy.removeConfirm}
        confirmLabel={copy.remove}
        cancelLabel={copy.form.cancel}
        onConfirm={handleRemove}
      />
    </Card>
  )
}
