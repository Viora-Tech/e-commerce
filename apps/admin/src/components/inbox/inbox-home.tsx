import type { InboxSettings } from '@commerce/core/inbox'
import { ArrowRight, CircleCheck, ExternalLink, MessageSquare } from '@commerce/ui/icons'
import { Alert, AlertDescription, AlertTitle } from '@commerce/ui/shadcn/alert'
import { Button } from '@commerce/ui/shadcn/button'
import Link from 'next/link'
import DataCard from '@/components/layout/data-card'
import PageColumns from '@/components/layout/page-columns'
import PageHeader from '@/components/layout/page-header'
import StatStrip from '@/components/layout/stat-strip'
import StatusChip from '@/components/layout/status-chip'
import SettingsRow from '@/components/settings/settings-row'
import { inboxConversationsContent } from '@/data/inbox-conversations'
import { getCopy } from '@/lib/copy-server'
import { routes } from '@/lib/routes'

type InboxHomeProps = {
  settings: InboxSettings
  /** Staff show as online right now (always, or inside the business hours). */
  availableNow: boolean
  unread: number
  quickReplies: number
  metrics: {
    conversations: number
    messages: number
    medianFirstResponseMinutes: number | null
    answered: number
  }
  storefrontUrl: string
}

/**
 * Sales channels › Inbox (Shopify Inbox's app home): the email banner, to-dos, the staff card
 * (hours, contact capture, quick replies), active status and the last 30 days. The AI agent
 * card joins in Inbox PR 6.
 */
export default async function InboxHome({
  settings,
  availableNow,
  unread,
  quickReplies,
  metrics,
  storefrontUrl,
}: InboxHomeProps) {
  const copy = await getCopy(inboxConversationsContent)
  const h = copy.home
  const todos = [
    settings.availability === 'always'
      ? { key: 'hours', ...h.todos.hours, href: routes.salesChannels.inboxSettings() }
      : null,
    quickReplies === 0
      ? { key: 'replies', ...h.todos.replies, href: routes.salesChannels.inboxQuickReplies() }
      : null,
  ].filter((t) => t !== null)
  const hoursBadge =
    settings.availability === 'always' ? (
      <StatusChip tone="success">{h.staff.alwaysOn}</StatusChip>
    ) : availableNow ? (
      <StatusChip tone="success">{h.staff.availableNow}</StatusChip>
    ) : (
      <StatusChip>{h.staff.away}</StatusChip>
    )
  const contactBadge = settings.requireSignIn ? (
    <StatusChip tone="info">{h.staff.signInRequired}</StatusChip>
  ) : settings.contactCapture === 'off' ? (
    <StatusChip>{h.staff.contactOff}</StatusChip>
  ) : (
    <StatusChip tone="success">{h.staff.contactOn}</StatusChip>
  )
  const minutes = metrics.medianFirstResponseMinutes

  return (
    <>
      <PageHeader
        title={h.title}
        summary={h.subtitle}
        actions={
          <Button
            nativeButton={false}
            render={<Link href={routes.salesChannels.inboxConversations()} />}
          >
            <MessageSquare aria-hidden="true" />
            {h.open}
            {unread > 0 ? ` · ${h.unread(unread)}` : ''}
          </Button>
        }
      />
      {settings.contactCapture === 'off' && !settings.requireSignIn ? (
        <Alert
          tone="info"
          action={
            <Button
              variant="outline"
              nativeButton={false}
              render={<Link href={routes.salesChannels.inboxSettings()} />}
            >
              {h.banner.action}
            </Button>
          }
        >
          <AlertTitle>{h.banner.title}</AlertTitle>
          <AlertDescription>{h.banner.body}</AlertDescription>
        </Alert>
      ) : null}
      {/* Full width, like Home: the four numbers were squeezed into the side column. */}
      <StatStrip
        tiles={[
          {
            id: 'conversations',
            label: h.metrics.conversations,
            value: String(metrics.conversations),
            note: h.metrics.title,
          },
          {
            id: 'messages',
            label: h.metrics.messages,
            value: String(metrics.messages),
            note: h.metrics.title,
          },
          {
            id: 'first-reply',
            label: h.metrics.firstReply,
            value: minutes === null ? h.metrics.none : h.metrics.minutes(minutes),
            note: h.metrics.title,
          },
          {
            id: 'answered',
            label: h.metrics.answered,
            value: String(metrics.answered),
            note: h.metrics.title,
          },
        ]}
      />
      <PageColumns
        main={
          <>
            <DataCard title={h.todos.title}>
              {todos.length === 0 ? (
                <p className="flex items-center gap-2 text-body text-muted-foreground">
                  <CircleCheck className="size-4" aria-hidden="true" />
                  {h.todos.done}
                </p>
              ) : (
                <ul className="flex flex-col divide-y divide-hairline">
                  {todos.map((t) => (
                    <li
                      key={t.key}
                      className="flex items-center justify-between gap-3 py-3 first:pt-0 last:pb-0"
                    >
                      <span className="text-body text-foreground">{t.title}</span>
                      <Button
                        variant="outline"
                        size="sm"
                        nativeButton={false}
                        render={<Link href={t.href} />}
                      >
                        {t.action}
                      </Button>
                    </li>
                  ))}
                </ul>
              )}
            </DataCard>
            <DataCard title={h.staff.title} bodyClassName="flex flex-col">
              <SettingsRow label={h.staff.hours}>
                <div className="flex items-center justify-between gap-3">
                  {hoursBadge}
                  <Link href={routes.salesChannels.inboxSettings()} className="text-body underline">
                    {h.staff.edit}
                  </Link>
                </div>
              </SettingsRow>
              <SettingsRow label={h.staff.contact}>
                <div className="flex items-center justify-between gap-3">
                  {contactBadge}
                  <Link href={routes.salesChannels.inboxSettings()} className="text-body underline">
                    {h.staff.edit}
                  </Link>
                </div>
              </SettingsRow>
              <SettingsRow label={h.staff.replies}>
                <div className="flex items-center justify-between gap-3">
                  <span className="text-body tabular-nums">{quickReplies}</span>
                  <Link
                    href={routes.salesChannels.inboxQuickReplies()}
                    className="text-body underline"
                  >
                    {h.staff.edit}
                  </Link>
                </div>
              </SettingsRow>
            </DataCard>
          </>
        }
        side={
          <>
            <DataCard title={h.status.title} bodyClassName="flex flex-col gap-3">
              <p className="flex items-center gap-2 text-body text-foreground">
                <StatusChip tone="success" variant="dot">
                  {h.status.live}
                </StatusChip>
              </p>
              <div className="flex flex-wrap gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  nativeButton={false}
                  render={<a href={storefrontUrl} target="_blank" rel="noreferrer" />}
                >
                  <ExternalLink aria-hidden="true" />
                  {h.status.preview}
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  nativeButton={false}
                  render={<Link href={routes.salesChannels.inboxSettings()} />}
                >
                  {h.status.settings}
                  <ArrowRight aria-hidden="true" />
                </Button>
              </div>
            </DataCard>
          </>
        }
      />
    </>
  )
}
