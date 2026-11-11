'use client'

import { TriangleAlert } from '@commerce/ui/icons'
import { Alert, AlertDescription, AlertTitle } from '@commerce/ui/shadcn/alert'
import { Button } from '@commerce/ui/shadcn/button'
import { useEffect, useState } from 'react'
import { toast } from 'sonner'
import { emailSuppressionContent } from '@/data/email-suppression'
import { useCopy, useLocale } from '@/hooks/use-copy'
import { api } from '@/lib/api-client'
import { formatDate } from '@/lib/format-date'

type EmailSuppressionNoticeProps = {
  customerId: string
}

type Suppression = Awaited<ReturnType<typeof api.customers.emailSuppression>>

/**
 * "Email bounced/complained — not sending" on the customer page, with "Allow again". Shows
 * nothing while the store mails the customer normally.
 */
export default function EmailSuppressionNotice({ customerId }: EmailSuppressionNoticeProps) {
  // Hooks
  const copy = useCopy(emailSuppressionContent).notice
  const locale = useLocale()
  const [suppression, setSuppression] = useState<Suppression>(null)
  const [allowing, setAllowing] = useState(false)

  useEffect(() => {
    api.customers
      .emailSuppression({ id: customerId })
      .then(setSuppression)
      .catch(() => setSuppression(null))
  }, [customerId])

  // Event handlers
  const handleAllow = async () => {
    setAllowing(true)
    try {
      await api.customers.allowEmailAgain({ id: customerId })
      setSuppression(null)
      toast.success(copy.allowed)
    } catch {
      toast.error(copy.failed)
    } finally {
      setAllowing(false)
    }
  }

  // Early returns
  if (!suppression) return null

  // Render logic
  const reason = suppression.reason

  return (
    <Alert variant="destructive" className="rounded-xl">
      <TriangleAlert aria-hidden="true" />
      <AlertTitle>{copy.title[reason]}</AlertTitle>
      <AlertDescription className="flex flex-col gap-2">
        <p>{copy.body[reason]}</p>
        <p className="text-caption">
          {suppression.email} · {copy.since(formatDate(suppression.suppressedAt, locale))}
        </p>
        {suppression.detail ? (
          <p className="text-caption break-words">
            {copy.detail}: {suppression.detail}
          </p>
        ) : null}
        {reason === 'complaint' ? <p className="text-caption">{copy.complaintWarning}</p> : null}
        <div>
          <Button variant="outline" size="sm" onClick={handleAllow} disabled={allowing}>
            {allowing ? copy.allowing : copy.allowAgain}
          </Button>
        </div>
      </AlertDescription>
    </Alert>
  )
}
