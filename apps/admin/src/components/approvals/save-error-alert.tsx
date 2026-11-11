'use client'

import { CircleAlert, Clock } from '@commerce/ui/icons'
import { cn } from '@commerce/ui/lib/utils'
import { Alert, AlertDescription, AlertTitle } from '@commerce/ui/shadcn/alert'
import Link from 'next/link'
import { approvalsContent } from '@/data/approvals'
import { useCopy } from '@/hooks/use-copy'
import { isApprovalNotice } from '@/lib/approval-notice'
import { routes } from '@/lib/routes'

type SaveErrorAlertProps = {
  /** The caught save error's message, as the form keeps it. */
  message: string
  /** Title of the red alert ("Save failed"); left out, the alert shows the message alone. */
  title?: string | undefined
  className?: string | undefined
}

/**
 * A form's save error under its header. A change the member's role sent for approval is not a
 * failure (#1531): it shows as a calm amber notice titled "Sent for approval", with a link to
 * Settings › Approvals, instead of the red alert.
 */
export default function SaveErrorAlert({ message, title, className }: SaveErrorAlertProps) {
  // Hooks
  const copy = useCopy(approvalsContent)

  // Early returns
  if (!isApprovalNotice(message)) {
    return (
      <Alert variant="destructive" className={className}>
        <CircleAlert />
        {title ? <AlertTitle>{title}</AlertTitle> : null}
        <AlertDescription>{message}</AlertDescription>
      </Alert>
    )
  }

  // Render logic
  return (
    <Alert
      role="status"
      className={cn(
        'border-warning/30 bg-warning-soft text-warning-foreground dark:text-warning',
        className,
      )}
    >
      <Clock />
      <AlertTitle>{copy.sentTitle}</AlertTitle>
      <AlertDescription className="text-warning-foreground dark:text-warning">
        <p>{message}</p>
        <Link href={routes.settings.approvals()} className="underline underline-offset-2">
          {copy.openApprovals}
        </Link>
      </AlertDescription>
    </Alert>
  )
}
