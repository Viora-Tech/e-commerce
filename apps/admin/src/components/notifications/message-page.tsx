'use client'

import { Pencil, RotateCcw, Send } from '@commerce/ui/icons'
import { Button } from '@commerce/ui/shadcn/button'
import { Switch } from '@commerce/ui/shadcn/switch'
import Link from 'next/link'
import { useState } from 'react'
import { toast } from 'sonner'
import ConfirmDialog from '@/components/layout/confirm-dialog'
import DataCard from '@/components/layout/data-card'
import PageBody from '@/components/layout/page-body'
import PageHeader from '@/components/layout/page-header'
import StatusChip from '@/components/layout/status-chip'
import LoadFailed from '@/components/states/load-failed'
import { emailDesignContent } from '@/data/email-design'
import { notificationsSettingsContent } from '@/data/notifications'
import { useCopy } from '@/hooks/use-copy'
import { useLoad } from '@/hooks/use-load'
import { api } from '@/lib/api-client'
import { routes } from '@/lib/routes'
import MessagePreview from './message-preview'
import type { MessageRowData } from './types'
import { useSendTest } from './use-send-test'

type MessagePageProps = { messageId: string }

type MessageId = Parameters<typeof api.notifications.setMessage>[0]['id']
type DesignId = Parameters<typeof api.notifications.resetDesign>[0]['id']

/**
 * Settings → Notifications → one message, like Shopify's email page (owner, 22 Nov 2026): the
 * subject over a large preview with a sample order, Send me a test and Edit at the top, its
 * on/off switch, and Reset to default once the email has its own design.
 */
export default function MessagePage({ messageId }: MessagePageProps) {
  // Hooks
  const copy = useCopy(notificationsSettingsContent)
  const designCopy = useCopy(emailDesignContent)
  const [saving, setSaving] = useState(false)
  const [confirmReset, setConfirmReset] = useState(false)
  const [previewKey, setPreviewKey] = useState(0)
  const { data: overview, failed, retry, setData } = useLoad(() => api.notifications.overview())
  const { testing, sendTest } = useSendTest(overview)

  // Derived values
  const message = overview?.messages.find((m) => m.id === messageId) ?? null

  // Helpers
  const patch = (next: Partial<MessageRowData>) =>
    setData((o) =>
      o
        ? { ...o, messages: o.messages.map((m) => (m.id === messageId ? { ...m, ...next } : m)) }
        : o,
    )

  // Event handlers
  const handleToggle = async (on: boolean) => {
    setSaving(true)
    patch({ on })
    try {
      await api.notifications.setMessage({ id: messageId as MessageId, on })
      toast.success(copy.list.saved(copy.messages[messageId]?.name ?? messageId, on))
    } catch {
      patch({ on: !on })
      toast.error(copy.list.saveFailed)
    } finally {
      setSaving(false)
    }
  }

  const handleReset = async () => {
    await api.notifications.resetDesign({ id: messageId as DesignId })
    patch({ designed: false })
    setPreviewKey((n) => n + 1)
    toast.success(designCopy.editor.resetDone)
  }

  // Early returns
  if (failed) return <LoadFailed failed={failed} onRetry={retry} />

  // Render logic
  const name = copy.messages[messageId]?.name ?? messageId
  const back = {
    label: copy.preview.back,
    href: `${routes.settings.notifications()}?open=messages`,
  }

  return (
    <PageBody width="settings" className="flex flex-col gap-4">
      <PageHeader
        title={name}
        subtitle={copy.messages[messageId]?.when}
        back={back}
        badges={
          message?.designed ? (
            <StatusChip tone="info">{designCopy.row.customised}</StatusChip>
          ) : null
        }
        actions={
          <>
            {message?.switchable ? (
              <span className="inline-flex items-center gap-2 pr-1">
                <span className="text-body text-muted-foreground">
                  {message.on ? copy.list.on : copy.list.off}
                </span>
                <Switch
                  aria-label={copy.list.switchLabel(name)}
                  checked={message.on}
                  disabled={saving}
                  onCheckedChange={(on) => void handleToggle(Boolean(on))}
                />
              </span>
            ) : null}
            {message?.designed ? (
              <Button variant="outline" onClick={() => setConfirmReset(true)}>
                <RotateCcw aria-hidden="true" />
                {designCopy.editor.reset}
              </Button>
            ) : null}
            <Button
              variant="outline"
              loading={testing === messageId}
              disabled={testing === messageId || !overview}
              onClick={() => void sendTest(messageId)}
            >
              <Send aria-hidden="true" />
              {copy.preview.sendTest}
            </Button>
            {message?.designable ? (
              <Button
                nativeButton={false}
                render={<Link href={routes.settings.notificationEdit(messageId)} />}
              >
                <Pencil aria-hidden="true" />
                {copy.preview.edit}
              </Button>
            ) : null}
          </>
        }
      />
      {overview && !message ? (
        <p className="text-body text-muted-foreground">{copy.preview.notFound}</p>
      ) : (
        <DataCard title={copy.list.preview} subtitle={copy.preview.help}>
          <MessagePreview key={previewKey} messageId={messageId} name={name} />
        </DataCard>
      )}
      <ConfirmDialog
        open={confirmReset}
        onOpenChange={setConfirmReset}
        title={designCopy.editor.resetTitle}
        body={designCopy.editor.resetBody}
        confirmLabel={designCopy.editor.resetConfirm}
        cancelLabel={designCopy.editor.resetKeep}
        tone="destructive"
        onConfirm={handleReset}
      />
    </PageBody>
  )
}
