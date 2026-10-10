import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@commerce/ui/shadcn/card'
import StatusChip from '@/components/layout/status-chip'
import { abandonedDetailContent } from '@/data/abandoned-detail'
import { useCopy, useFormat } from '@/hooks/use-copy'
import type { AbandonedCheckout } from './abandoned-detail-types'

type AbandonedReminderCardProps = {
  checkout: AbandonedCheckout
}

export default function AbandonedReminderCard({ checkout }: AbandonedReminderCardProps) {
  // Hooks
  const content = useCopy(abandonedDetailContent)
  const fmt = useFormat()

  // Render logic
  const copy = content.reminder
  const chip = checkout.recovered
    ? { tone: 'neutral' as const, label: copy.recovered }
    : checkout.recoverySentAt
      ? { tone: 'neutral' as const, label: copy.sent(fmt.when(checkout.recoverySentAt)) }
      : { tone: 'attention' as const, label: copy.notSent }
  const note = checkout.recovered ? copy.recoveredNote : checkout.email ? null : copy.noEmail

  return (
    <Card>
      <CardHeader>
        <CardTitle>{copy.heading}</CardTitle>
        <CardDescription>{copy.sub}</CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        <StatusChip tone={chip.tone} className="w-fit">
          {chip.label}
        </StatusChip>
        {note ? <p className="text-caption text-muted-foreground">{note}</p> : null}
      </CardContent>
    </Card>
  )
}
