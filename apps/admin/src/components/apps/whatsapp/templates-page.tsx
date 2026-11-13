'use client'

import { permissions } from '@commerce/core/permissions'
import { Button } from '@commerce/ui/shadcn/button'
import { Skeleton } from '@commerce/ui/shadcn/skeleton'
import { Spinner } from '@commerce/ui/shadcn/spinner'
import { useEffect, useState } from 'react'
import { toast } from 'sonner'
import NoticeBar from '@/components/layout/notice-bar'
import PageHeader from '@/components/layout/page-header'
import { notificationsSettingsContent } from '@/data/notifications'
import { whatsappAppContent } from '@/data/whatsapp-app'
import { useCopy } from '@/hooks/use-copy'
import { usePermissions } from '@/hooks/use-permissions'
import { api } from '@/lib/api-client'
import TemplateCard from './template-card'

type Templates = Awaited<ReturnType<typeof api.platformApps.whatsappTemplates>>

/**
 * Apps → WhatsApp → Templates: every message the store can send on WhatsApp with the template
 * Meta must approve for it (name, Utility body with `{{n}}`, parameters in order, an example
 * each) and its review status. With the saved WhatsApp Business Account ID an owner submits
 * them from here; without it, the bodies are there to copy into WhatsApp Manager.
 */
export default function WhatsappTemplatesPage() {
  // Hooks
  const copy = useCopy(whatsappAppContent)
  const settingsCopy = useCopy(notificationsSettingsContent)
  const { hasPermission } = usePermissions()
  const [data, setData] = useState<Templates | null>(null)
  const [busy, setBusy] = useState<string | null>(null)

  useEffect(() => {
    let live = true
    api.platformApps
      .whatsappTemplates()
      .then((r) => live && setData(r))
      .catch((err: unknown) => toast.error(err instanceof Error ? err.message : String(err)))
    return () => {
      live = false
    }
  }, [])

  // Helpers
  const labelOf = (id: string) =>
    (settingsCopy.messages as Record<string, { name: string }>)[id]?.name ?? id
  const submit = async (ids: string[], key: string) => {
    setBusy(key)
    try {
      const results = await api.platformApps.submitWhatsappTemplates({ ids })
      const failed = results.filter((r) => !r.ok)
      const sent = results.length - failed.length
      if (sent) toast.success(copy.submit.sent(sent))
      for (const r of failed) if (!r.ok) toast.error(copy.submit.failed(labelOf(r.id), r.error))
      setData(await api.platformApps.whatsappTemplates())
    } catch (err) {
      toast.error(err instanceof Error ? err.message : copy.submit.error)
    } finally {
      setBusy(null)
    }
  }

  // Event handlers
  const handleSubmitAll = () => {
    if (!data) return
    const ids = data.templates
      .filter((t) => t.status === 'not_submitted' && t.category === 'UTILITY')
      .map((t) => t.id)
    if (ids.length) void submit(ids, 'all')
  }

  // Render logic
  const words = copy.templates
  const canSubmit = Boolean(
    data?.access === 'live' && data.statusKnown && hasPermission(permissions.SETTINGS_MANAGE),
  )
  const notSubmitted =
    data?.templates.filter((t) => t.status === 'not_submitted' && t.category === 'UTILITY')
      .length ?? 0
  const notice = !data
    ? null
    : data.error
      ? { danger: true, text: words.metaError(data.error) }
      : data.access === 'no_waba'
        ? { danger: false, text: words.noWaba }
        : data.access === 'no_connection'
          ? { danger: false, text: words.noConnection }
          : null

  return (
    <div className="flex flex-col gap-5">
      <PageHeader
        title={words.title}
        summary={words.intro}
        actions={
          canSubmit && notSubmitted > 0 ? (
            <Button onClick={handleSubmitAll} disabled={busy !== null}>
              {busy === 'all' ? <Spinner /> : null}
              {words.submitAll}
            </Button>
          ) : null
        }
      />
      {notice ? (
        <NoticeBar className={notice.danger ? 'text-destructive' : undefined}>
          {notice.text}
        </NoticeBar>
      ) : null}
      {!data ? (
        <div className="flex flex-col gap-3" role="status" aria-label={words.loading}>
          <Skeleton className="h-36 w-full" />
          <Skeleton className="h-36 w-full" />
        </div>
      ) : (
        <ul className="flex flex-col gap-3">
          {data.templates.map((t) => (
            <TemplateCard
              key={t.id}
              template={t}
              label={labelOf(t.id)}
              statusKnown={data.statusKnown}
              submitting={busy === t.id}
              onSubmit={canSubmit ? () => void submit([t.id], t.id) : undefined}
            />
          ))}
        </ul>
      )}
    </div>
  )
}
