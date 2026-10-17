'use client'

import { Button } from '@commerce/ui/shadcn/button'
import { Card } from '@commerce/ui/shadcn/card'
import { Skeleton } from '@commerce/ui/shadcn/skeleton'
import Link from 'next/link'
import { useEffect, useState } from 'react'
import { toast } from 'sonner'
import PageHeader from '@/components/layout/page-header'
import HelpFooter from '@/components/payments/help-footer'
import HealthLine from '@/components/settings/health-line'
import SettingsTable from '@/components/settings/settings-table'
import WhatsThisHelp from '@/components/settings/whats-this-help'
import { type MessageGroupId, notificationsSettingsContent } from '@/data/notifications'
import { senderEmailContent } from '@/data/sender-email'
import { SETTINGS_BACK } from '@/data/settings'
import { useCopy } from '@/hooks/use-copy'
import { api } from '@/lib/api-client'
import AdvancedSection from './advanced-section'
import MessageRow from './message-row'
import PreviewDialog from './preview-dialog'
import SenderEmailCard from './sender-email-card'
import SendingCard from './sending-card'
import type { MessageRowData, NotificationsOverview } from './types'

type MessageId = Parameters<typeof api.notifications.setMessage>[0]['id']

const GROUPS: MessageGroupId[] = [
  'orders',
  'returns',
  'transfer',
  'preorder',
  'manual',
  'account',
  'app',
]

/** Advanced (the developer log) only exists while developing. */
const DEV = process.env.NODE_ENV !== 'production'

function errorText(err: unknown, fallback: string): string {
  return err instanceof Error && err.message ? err.message : fallback
}

/**
 * Settings → Notifications: a status line, every message customers get (on/off,
 * Preview, Send me a test), the messages that go to you, how messages are sent,
 * and a developer-only Advanced section.
 */
export default function NotificationsPage() {
  // Hooks
  const copy = useCopy(notificationsSettingsContent)
  const [data, setData] = useState<NotificationsOverview | null>(null)
  const [saving, setSaving] = useState<string | null>(null)
  const [testing, setTesting] = useState<string | null>(null)
  const [previewing, setPreviewing] = useState<string | null>(null)

  useEffect(() => {
    api.notifications.overview().then(setData)
  }, [])

  // Helpers
  const reload = async () => {
    setData(await api.notifications.overview())
  }

  const patchMessage = (id: string, on: boolean) =>
    setData((d) =>
      d ? { ...d, messages: d.messages.map((m) => (m.id === id ? { ...m, on } : m)) } : d,
    )

  const rows = (group: MessageGroupId) => (data?.messages ?? []).filter((m) => m.group === group)
  const renderRows = (list: MessageRowData[], heading?: string, description?: string) => (
    <SettingsTable
      heading={heading}
      description={description}
      actions
      total={list.length}
      columns={[
        { label: copy.list.columns.message },
        { label: copy.list.columns.sentOn },
        { label: copy.list.columns.status, center: true },
      ]}
    >
      {list.map((m) => (
        <MessageRow
          key={m.id}
          message={m}
          saving={saving === m.id}
          testing={testing === m.id}
          onToggle={(on) => handleToggle(m, on)}
          onPreview={() => setPreviewing(m.id)}
          onTest={() => handleTest(m)}
        />
      ))}
    </SettingsTable>
  )

  // Event handlers
  const handleToggle = async (m: MessageRowData, on: boolean) => {
    setSaving(m.id)
    patchMessage(m.id, on)
    try {
      await api.notifications.setMessage({ id: m.id as MessageId, on })
      toast.success(copy.list.saved(copy.messages[m.id]?.name ?? m.id, on))
    } catch {
      patchMessage(m.id, !on)
      toast.error(copy.list.saveFailed)
    } finally {
      setSaving(null)
    }
  }

  const handleTest = async (m: MessageRowData) => {
    if (!data?.canSendTest) {
      toast.info(copy.test.noChannel)
      return
    }
    setTesting(m.id)
    try {
      const r = await api.notifications.sendTest({ id: m.id as MessageId })
      if (!r.ok) toast.error(r.error === 'no_channel' ? copy.test.noChannel : copy.test.failed)
      else if (data.channels.email.state === 'connected' || data.platformEmail) {
        toast.success(copy.test.sent(r.to))
      } else toast.success(copy.test.sentLog)
    } catch (err) {
      toast.error(errorText(err, copy.test.failed))
    } finally {
      setTesting(null)
    }
  }

  const handleClosePreview = () => setPreviewing(null)

  // Early returns
  if (!data) {
    return (
      <div className="flex flex-col gap-4">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-16 w-full" />
        <Card gap={4} inset={6}>
          <Skeleton className="h-5 w-56" />
          <Skeleton className="h-12 w-full" />
          <Skeleton className="h-12 w-full" />
        </Card>
      </div>
    )
  }

  // Render logic
  // The platform's SES account sends for the store when it has no email app of its own.
  const emailOn = data.channels.email.state === 'connected' || data.platformEmail
  const whatsappOn = data.channels.whatsapp.state === 'connected'
  return (
    <div className="flex flex-col gap-5">
      <PageHeader
        title={copy.title}
        subtitle={
          <span className="flex flex-wrap items-center gap-x-3 gap-y-1">
            {copy.intro}
            <WhatsThisHelp
              trigger={copy.whatsThis.trigger}
              title={copy.whatsThis.title}
              body={copy.whatsThis.body}
            />
          </span>
        }
        back={SETTINGS_BACK}
      />

      <HealthLine
        tone={emailOn ? 'ok' : 'warn'}
        title={
          emailOn
            ? whatsappOn
              ? copy.status.readyWhatsapp
              : copy.status.ready
            : copy.status.notReady
        }
        help={emailOn ? null : copy.status.notReadyHelp}
        action={
          emailOn ? null : (
            <Button nativeButton={false} render={<Link href="#how-messages-are-sent" />}>
              {copy.status.connectEmail}
            </Button>
          )
        }
      />

      <section className="flex flex-col gap-2" aria-labelledby="notifications-messages">
        <div className="flex flex-col gap-0.5">
          <h2 id="notifications-messages" className="text-card font-semibold text-foreground">
            {copy.list.heading}
          </h2>
          <p className="text-body text-muted-foreground">{copy.list.help}</p>
        </div>
        {GROUPS.map((g) => {
          const list = rows(g)
          if (list.length === 0) return null
          return <div key={g}>{renderRows(list, copy.groups[g].title, copy.groups[g].help)}</div>
        })}
      </section>

      <section className="flex flex-col gap-2" aria-labelledby="notifications-you">
        <div className="flex flex-col gap-0.5">
          <h2 id="notifications-you" className="text-card font-semibold text-foreground">
            {copy.groups.you.title}
          </h2>
          <p className="text-body text-muted-foreground">{copy.groups.you.help}</p>
        </div>
        {renderRows(rows('you'))}
      </section>

      <section className="flex flex-col gap-2" aria-labelledby="notifications-sender">
        <div className="flex flex-col gap-0.5">
          <h2 id="notifications-sender" className="text-card font-semibold text-foreground">
            {senderEmailContent.heading}
          </h2>
          <p className="text-body text-muted-foreground">{senderEmailContent.help}</p>
        </div>
        <SenderEmailCard />
      </section>

      <section
        id="how-messages-are-sent"
        className="flex scroll-mt-6 flex-col gap-2"
        aria-labelledby="notifications-sending"
      >
        <div className="flex flex-col gap-0.5">
          <h2 id="notifications-sending" className="text-card font-semibold text-foreground">
            {copy.sending.heading}
          </h2>
          <p className="text-body text-muted-foreground">{copy.sending.help}</p>
        </div>
        <SendingCard
          email={data.channels.email}
          whatsapp={data.channels.whatsapp}
          platformEmail={data.platformEmail}
        />
      </section>

      {DEV ? <AdvancedSection devLog={data.devLog} onChanged={reload} /> : null}
      <HelpFooter />

      <PreviewDialog messageId={previewing} onClose={handleClosePreview} />
    </div>
  )
}
