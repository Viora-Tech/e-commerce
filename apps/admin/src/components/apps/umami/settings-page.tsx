'use client'

import { Button } from '@commerce/ui/shadcn/button'
import { Input } from '@commerce/ui/shadcn/input'
import { Switch } from '@commerce/ui/shadcn/switch'
import Link from 'next/link'
import { useEffect, useState } from 'react'
import { toast } from 'sonner'
import PageHeader from '@/components/layout/page-header'
import SettingsCard from '@/components/settings/settings-card'
import SettingsRow from '@/components/settings/settings-row'
import { umamiContent } from '@/data/umami'
import { useCopy } from '@/hooks/use-copy'
import { api } from '@/lib/api-client'
import { routes } from '@/lib/routes'

type View = Awaited<ReturnType<typeof api.umami.settings.get>>

type Form = { url: string; websiteId: string; apiKey: string; waitForConsent: boolean }

type Busy = 'save' | 'test' | 'create' | 'remove' | null

const formOf = (view: View): Form => ({
  url: view.url,
  websiteId: view.websiteId,
  apiKey: '',
  waitForConsent: view.waitForConsent,
})

type Copy = typeof umamiContent

const errorText = (copy: Copy, err: unknown) =>
  err instanceof Error && err.message ? err.message : copy.failed

function statusOf(copy: Copy, view: View): string {
  if (view.reporting) return copy.status.reporting
  if (view.tracking) return copy.status.tracking
  return copy.status.notSetUp
}

/**
 * The Umami app's page: the Umami address, an API key (stored encrypted, never shown again),
 * the website id or "Create a website for this store", a read-only connection test, and
 * whether the tracker waits for cookie consent.
 */
export default function SettingsPage() {
  // Hooks
  const copy = useCopy(umamiContent)
  const [view, setView] = useState<View | null>(null)
  const [form, setForm] = useState<Form | null>(null)
  const [busy, setBusy] = useState<Busy>(null)

  useEffect(() => {
    api.umami.settings.get().then((v) => {
      setView(v)
      setForm(formOf(v))
    })
  }, [])

  // Helpers
  const patch = (next: Partial<Form>) => setForm((f) => (f ? { ...f, ...next } : f))

  /** Saves the form (a typed key only when there is one) and shows the stored state. */
  const persist = async (current: Form): Promise<View> => {
    const saved = await api.umami.settings.save({
      url: current.url,
      websiteId: current.websiteId,
      waitForConsent: current.waitForConsent,
      ...(current.apiKey.trim() ? { apiKey: current.apiKey } : {}),
    })
    setView(saved)
    setForm(formOf(saved))
    return saved
  }

  const run = async (kind: Exclude<Busy, null>, work: () => Promise<void>) => {
    setBusy(kind)
    try {
      await work()
    } catch (err) {
      toast.error(errorText(copy, err))
    } finally {
      setBusy(null)
    }
  }

  // Event handlers
  const handleSave = () =>
    run('save', async () => {
      if (!form) return
      await persist(form)
      toast.success(copy.saved)
    })

  const handleTest = () =>
    run('test', async () => {
      if (!form) return
      await persist(form)
      const website = await api.umami.settings.test()
      toast.success(copy.connect.testOk(website.name || website.domain))
    })

  const handleCreate = () =>
    run('create', async () => {
      if (!form) return
      await persist({ ...form, websiteId: '' })
      const saved = await api.umami.settings.createWebsite()
      setView(saved)
      setForm(formOf(saved))
      toast.success(copy.connect.websiteId.created)
    })

  const handleRemoveKey = () =>
    run('remove', async () => {
      const saved = await api.umami.settings.save({ apiKey: '' })
      setView(saved)
      patch({ apiKey: '' })
      toast.success(copy.connect.apiKey.removed)
    })

  // Early returns
  if (!view || !form) return null

  // Render logic
  const keyReady = view.hasApiKey || form.apiKey.trim() !== ''
  const canCreate = form.url.trim() !== '' && keyReady
  const canTest = canCreate && form.websiteId.trim() !== ''

  return (
    <div className="flex flex-col gap-5">
      <PageHeader
        title={copy.title}
        summary={copy.subtitle}
        actions={
          <Button loading={busy === 'save'} disabled={busy !== null} onClick={handleSave}>
            {copy.save}
          </Button>
        }
      />
      <p className="rounded-xl surface-banner px-4 py-3 text-body text-foreground">
        {statusOf(copy, view)}{' '}
        {view.reporting ? (
          <Link href={routes.analytics.home()} className="font-medium underline">
            {copy.status.analyticsLink}
          </Link>
        ) : null}
      </p>
      <SettingsCard title={copy.connect.title} description={copy.connect.description}>
        <SettingsRow
          label={copy.connect.url.label}
          description={copy.connect.url.help}
          htmlFor="umami-url"
        >
          <Input
            id="umami-url"
            inputMode="url"
            autoComplete="off"
            placeholder={copy.connect.url.placeholder}
            value={form.url}
            onChange={(e) => patch({ url: e.target.value })}
          />
        </SettingsRow>
        <SettingsRow
          label={copy.connect.apiKey.label}
          description={copy.connect.apiKey.help}
          htmlFor="umami-api-key"
        >
          <Input
            id="umami-api-key"
            type="password"
            autoComplete="off"
            placeholder={copy.connect.apiKey.placeholder}
            value={form.apiKey}
            onChange={(e) => patch({ apiKey: e.target.value })}
          />
          {view.hasApiKey ? (
            <span className="flex flex-wrap items-center gap-x-3 gap-y-1 text-caption text-muted-foreground">
              {copy.connect.apiKey.saved}
              <Button
                variant="link"
                size="xs"
                className="h-auto p-0 text-destructive"
                loading={busy === 'remove'}
                disabled={busy !== null}
                onClick={handleRemoveKey}
              >
                {copy.connect.apiKey.remove}
              </Button>
            </span>
          ) : null}
        </SettingsRow>
        <SettingsRow
          label={copy.connect.websiteId.label}
          description={copy.connect.websiteId.help}
          htmlFor="umami-website-id"
        >
          <Input
            id="umami-website-id"
            autoComplete="off"
            spellCheck={false}
            placeholder={copy.connect.websiteId.placeholder}
            value={form.websiteId}
            onChange={(e) => patch({ websiteId: e.target.value })}
            className="font-mono"
          />
          <div className="flex flex-wrap items-center gap-2">
            <Button
              variant="outline"
              loading={busy === 'create'}
              disabled={busy !== null || !canCreate}
              onClick={handleCreate}
            >
              {copy.connect.websiteId.create}
            </Button>
            <Button
              variant="outline"
              loading={busy === 'test'}
              disabled={busy !== null || !canTest}
              onClick={handleTest}
            >
              {copy.connect.test}
            </Button>
          </div>
          {canCreate ? null : (
            <span className="text-caption text-muted-foreground">
              {copy.connect.websiteId.createNeeds}
            </span>
          )}
        </SettingsRow>
      </SettingsCard>
      <SettingsCard title={copy.privacy.title}>
        <SettingsRow
          label={copy.privacy.label}
          description={copy.privacy.help}
          htmlFor="umami-consent"
        >
          <Switch
            id="umami-consent"
            checked={form.waitForConsent}
            onCheckedChange={(v) => patch({ waitForConsent: v })}
          />
        </SettingsRow>
      </SettingsCard>
      <p className="text-caption text-muted-foreground">{copy.credit}</p>
    </div>
  )
}
