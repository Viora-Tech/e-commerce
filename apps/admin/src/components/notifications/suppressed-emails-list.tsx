'use client'

import { Button } from '@commerce/ui/shadcn/button'
import { useEffect, useState } from 'react'
import { toast } from 'sonner'
import { emailSuppressionContent } from '@/data/email-suppression'
import { useCopy, useLocale } from '@/hooks/use-copy'
import { api } from '@/lib/api-client'
import { formatDate } from '@/lib/format-date'

type Row = Awaited<ReturnType<typeof api.notifications.emailSuppressions>>[number]

/**
 * Settings › Notifications › Sender email: the addresses the shop stopped emailing after a
 * bounce or a spam complaint, each with "Allow again". Small on purpose: it only ever lists
 * addresses that failed.
 */
export default function SuppressedEmailsList() {
  // Hooks
  const copy = useCopy(emailSuppressionContent).list
  const locale = useLocale()
  const [rows, setRows] = useState<Row[] | null>(null)
  const [failed, setFailed] = useState(false)
  const [busy, setBusy] = useState<string | null>(null)

  useEffect(() => {
    api.notifications
      .emailSuppressions()
      .then(setRows)
      .catch(() => setFailed(true))
  }, [])

  // Event handlers
  const handleAllow = async (email: string) => {
    setBusy(email)
    try {
      await api.notifications.allowSuppressedEmail({ email })
      setRows((list) => (list ?? []).filter((r) => r.email !== email))
      toast.success(copy.allowed(email))
    } catch {
      toast.error(copy.failed)
    } finally {
      setBusy(null)
    }
  }

  // Early returns
  if (failed) return <p className="text-caption text-muted-foreground">{copy.loadFailed}</p>
  if (!rows) return null

  return (
    <section className="flex flex-col gap-2 border-t border-border pt-4">
      <h3 className="text-body font-medium text-foreground">{copy.heading}</h3>
      <p className="text-caption text-muted-foreground">{copy.help}</p>
      {rows.length === 0 ? (
        <p className="text-caption text-muted-foreground">{copy.empty}</p>
      ) : (
        <ul className="flex flex-col divide-y divide-border rounded-lg border border-border">
          {rows.map((r) => (
            <li
              key={r.email}
              className="flex flex-col gap-2 p-3 sm:flex-row sm:items-center sm:justify-between"
            >
              <div className="flex min-w-0 flex-col gap-0.5">
                <span className="font-mono text-body break-all text-foreground">{r.email}</span>
                <span className="text-caption text-muted-foreground">
                  {copy.reason[r.reason]} · {formatDate(r.suppressedAt, locale)}
                </span>
                {r.detail ? (
                  <span className="text-caption break-words text-muted-foreground">{r.detail}</span>
                ) : null}
              </div>
              <Button
                variant="outline"
                size="sm"
                disabled={busy !== null}
                onClick={() => handleAllow(r.email)}
                className="w-full sm:w-auto"
              >
                {copy.allowAgain}
              </Button>
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}
