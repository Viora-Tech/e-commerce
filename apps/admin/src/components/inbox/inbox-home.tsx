import type { InboxSettings } from '@commerce/core/inbox'
import { ArrowRight, CircleCheck, ExternalLink, MessageSquare } from '@commerce/ui/icons'
import { Button } from '@commerce/ui/shadcn/button'
import Link from 'next/link'
import PageHeader from '@/components/layout/page-header'
import StatStrip from '@/components/layout/stat-strip'
import StatusChip from '@/components/layout/status-chip'
import SettingsCard from '@/components/settings/settings-card'
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
    <div className="flex flex-col gap-5">
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
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl surface-banner px-4 py-3">
          <div className="flex min-w-0 flex-col">
            <p className="text-body-strong text-ink-strong">{h.banner.title}</p>
            <p className="text-caption text-muted-foreground">{h.banner.body}</p>
          </div>
          <Button
            variant="outline"
            nativeButton={false}
            render={<Link href={routes.salesChannels.inboxSettings()} />}
          >
            {h.banner.action}
          </Button>
        </div>
      ) : null}
      <div className="grid gap-5 lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
        <div className="flex min-w-0 flex-col gap-5">
          <SettingsCard title={h.todos.title}>
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
          </SettingsCard>
          <SettingsCard title={h.staff.title}>
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
          </SettingsCard>
        </div>
        <div className="flex min-w-0 flex-col gap-5">
          <SettingsCard title={h.status.title}>
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
          </SettingsCard>
          <SettingsCard title={h.metrics.title}>
            <StatStrip
              tiles={[
                {
                  id: 'conversations',
                  label: h.metrics.conversations,
                  value: String(metrics.conversations),
                },
                { id: 'messages', label: h.metrics.messages, value: String(metrics.messages) },
                {
                  id: 'first-reply',
                  label: h.metrics.firstReply,
                  value: minutes === null ? h.metrics.none : h.metrics.minutes(minutes),
                },
                { id: 'answered', label: h.metrics.answered, value: String(metrics.answered) },
              ]}
            />
          </SettingsCard>
        </div>
      </div>
    </div>
  )
}
