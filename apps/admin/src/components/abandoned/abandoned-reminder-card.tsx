import { Copy, Send } from '@commerce/ui/icons'
import { cn } from '@commerce/ui/lib/utils'
import { Button } from '@commerce/ui/shadcn/button'
import DataCard from '@/components/layout/data-card'
import KeyValueList from '@/components/layout/key-value-list'
import StatusChip from '@/components/layout/status-chip'
import { abandonedDetailContent } from '@/data/abandoned-detail'
import { useCopy, useFormat } from '@/hooks/use-copy'
import type { AbandonedCheckout } from './abandoned-detail-types'

type AbandonedReminderCardProps = {
  checkout: AbandonedCheckout
  canSend: boolean
  sending: boolean
  onSend: () => void
  onCopyLink: () => void
}

const CHANNELS = ['email', 'whatsapp'] as const

/**
 * Figma "Abandoned checkout · Polish" › Recover this cart: the state chip, a two-step bar (sent,
 * recovered; opens are not tracked), the last reminder and each channel, then Send reminder and
 * Copy link side by side.
 */
export default function AbandonedReminderCard({
  checkout,
  canSend,
  sending,
  onSend,
  onCopyLink,
}: AbandonedReminderCardProps) {
  // Hooks
  const content = useCopy(abandonedDetailContent)
  const fmt = useFormat()

  // Render logic
  const copy = content.reminder
  const sentAt = checkout.recoverySentAt
  const chip = checkout.recovered
    ? { tone: 'success' as const, label: copy.recovered }
    : sentAt
      ? { tone: 'info' as const, label: copy.sent(fmt.ago(sentAt)) }
      : { tone: 'attention' as const, label: copy.notSent }
  const channelName = (c: string) => copy.channels[c] ?? c
  const last = checkout.reminders.find((r) => r.status === 'sent')
  const rows = [
    ...(last
      ? [
          {
            label: copy.lastReminder,
            value: copy.lastReminderValue(channelName(last.channel), fmt.when(last.at)),
          },
        ]
      : []),
    ...CHANNELS.filter((c) => !last || c !== last.channel).map((c) => {
      const r = checkout.reminders.find((x) => x.channel === c)
      return {
        label: channelName(c),
        value: !r
          ? copy.channelNotSent
          : r.status === 'failed'
            ? copy.channelFailed
            : copy.channelSent(fmt.ago(r.at)),
      }
    }),
  ]
  const steps = [
    { key: 'sent', label: sentAt ? copy.sentStep(fmt.ago(sentAt)) : copy.steps.sent, done: !!sentAt },
    { key: 'recovered', label: copy.steps.recovered, done: checkout.recovered },
  ]
  const note = checkout.recovered ? copy.recoveredNote : checkout.email ? copy.sub : copy.noEmail

  return (
    <DataCard
      title={
        <>
          {copy.heading}
          <StatusChip tone={chip.tone}>{chip.label}</StatusChip>
        </>
      }
      bodyClassName="flex flex-col gap-4"
    >
      <ol className="grid grid-cols-2 gap-3">
        {steps.map((s) => (
          <li key={s.key} className="flex flex-col gap-1.5">
            <span className={cn('h-1 rounded-full', s.done ? 'bg-foreground' : 'bg-muted')} />
            <span
              className={cn('text-caption', s.done ? 'text-foreground' : 'text-muted-foreground')}
            >
              {s.label}
            </span>
          </li>
        ))}
      </ol>
      {sentAt ? <KeyValueList rows={rows} variant="grid" /> : null}
      <p className="text-caption text-muted-foreground">{note}</p>
      {canSend || checkout.recoveryUrl ? (
        <div className="grid grid-cols-2 gap-2">
          {canSend ? (
            <Button loading={sending} onClick={onSend}>
              <Send aria-hidden="true" />
              {sentAt ? content.sendAgain : content.sendReminder}
            </Button>
          ) : null}
          {checkout.recoveryUrl ? (
            <Button variant="outline" onClick={onCopyLink}>
              <Copy aria-hidden="true" />
              {content.copyLink}
            </Button>
          ) : null}
        </div>
      ) : null}
    </DataCard>
  )
}
