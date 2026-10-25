'use client'

import { RefreshCw } from '@commerce/ui/icons'
import { Button } from '@commerce/ui/shadcn/button'
import { Input } from '@commerce/ui/shadcn/input'
import { useEffect, useState } from 'react'
import { toast } from 'sonner'
import PageHeader from '@/components/layout/page-header'
import SaveBar from '@/components/layout/save-bar'
import SettingsCard from '@/components/settings/settings-card'
import SettingsRow from '@/components/settings/settings-row'
import { meilisearchContent } from '@/data/meilisearch'
import { useCopy } from '@/hooks/use-copy'
import { api } from '@/lib/api-client'
import IndexCard from './index-card'
import SynonymsCard from './synonyms-card'

type View = Awaited<ReturnType<typeof api.meilisearch.get>>

type Form = { host: string; adminKey: string }

type Busy = 'save' | 'test' | 'remove' | null

type Copy = typeof meilisearchContent

const formOf = (view: View): Form => ({ host: view.host, adminKey: '' })

const errorText = (copy: Copy, err: unknown) =>
  err instanceof Error && err.message ? err.message : copy.failed

function statusOf(copy: Copy, view: View): string {
  if (view.live) return copy.status.live
  if (view.host && view.hasAdminKey) return copy.status.index
  return copy.status.connect
}

/**
 * The Meilisearch app's page: the address and admin key (stored encrypted, never shown
 * again), a connection test that also prepares the index and a search-only key, the index's
 * status with "Reindex now", and the synonyms editor.
 */
export default function SettingsPage() {
  // Hooks
  const copy = useCopy(meilisearchContent)
  const [view, setView] = useState<View | null>(null)
  const [form, setForm] = useState<Form | null>(null)
  const [busy, setBusy] = useState<Busy>(null)

  useEffect(() => {
    api.meilisearch.get().then((v) => {
      setView(v)
      setForm(formOf(v))
    })
  }, [])

  // Helpers
  const patch = (next: Partial<Form>) => setForm((f) => (f ? { ...f, ...next } : f))

  const reload = async () => {
    const v = await api.meilisearch.get()
    setView(v)
    setForm(formOf(v))
  }

  /** Saves the form (a typed key only when there is one), then reads the page again. */
  const persist = async (current: Form) => {
    await api.meilisearch.save({
      host: current.host,
      ...(current.adminKey.trim() ? { adminKey: current.adminKey } : {}),
    })
    await reload()
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
      const result = await api.meilisearch.test()
      await reload()
      toast.success(copy.connect.testOk(result.version))
    })

  const handleDiscard = () => setForm(view ? formOf(view) : null)

  const handleRemoveKey = () =>
    run('remove', async () => {
      await api.meilisearch.save({ adminKey: '' })
      await reload()
      toast.success(copy.connect.adminKey.removed)
    })

  // Early returns
  if (!view || !form) return null

  // Render logic
  const canTest = form.host.trim() !== '' && (view.hasAdminKey || form.adminKey.trim() !== '')
  const dirty = JSON.stringify(form) !== JSON.stringify(formOf(view))

  return (
    <div className="flex flex-col gap-5">
      <SaveBar
        open={dirty}
        message={copy.unsaved}
        saveLabel={copy.save}
        discardLabel={copy.discard}
        onSave={handleSave}
        onDiscard={handleDiscard}
        saving={busy === 'save'}
      />
      <PageHeader title={copy.title} summary={copy.subtitle} />
      <div className="flex flex-col gap-1 rounded-xl surface-banner px-4 py-3 text-body text-foreground">
        <p>{statusOf(copy, view)}</p>
        <p className="text-caption text-muted-foreground">{copy.status.fallback}</p>
      </div>
      <SettingsCard title={copy.connect.title} description={copy.connect.description}>
        <SettingsRow
          label={copy.connect.host.label}
          description={copy.connect.host.help}
          htmlFor="meilisearch-host"
        >
          <Input
            id="meilisearch-host"
            inputMode="url"
            autoComplete="off"
            placeholder={copy.connect.host.placeholder}
            value={form.host}
            onChange={(e) => patch({ host: e.target.value })}
          />
        </SettingsRow>
        <SettingsRow
          label={copy.connect.adminKey.label}
          description={copy.connect.adminKey.help}
          htmlFor="meilisearch-admin-key"
        >
          <Input
            id="meilisearch-admin-key"
            type="password"
            autoComplete="off"
            placeholder={copy.connect.adminKey.placeholder}
            value={form.adminKey}
            onChange={(e) => patch({ adminKey: e.target.value })}
          />
          {view.hasAdminKey ? (
            <span className="flex flex-wrap items-center gap-x-3 gap-y-1 text-caption text-muted-foreground">
              {copy.connect.adminKey.saved}
              <Button
                variant="link"
                size="xs"
                className="h-auto p-0 text-destructive"
                loading={busy === 'remove'}
                disabled={busy !== null}
                onClick={handleRemoveKey}
              >
                {copy.connect.adminKey.remove}
              </Button>
            </span>
          ) : null}
          <div className="flex flex-wrap items-center gap-2">
            <Button
              variant="outline"
              loading={busy === 'test'}
              disabled={busy !== null || !canTest}
              onClick={handleTest}
            >
              <RefreshCw aria-hidden="true" />
              {copy.connect.test}
            </Button>
          </div>
          {view.hasAdminKey && view.documents !== null ? (
            <span className="text-caption text-muted-foreground">
              {view.hasSearchKey ? copy.connect.searchKey : copy.connect.noSearchKey}
            </span>
          ) : null}
        </SettingsRow>
      </SettingsCard>
      <IndexCard view={view} onChanged={reload} />
      <SynonymsCard synonyms={view.synonyms} onSaved={reload} />
      <p className="text-caption text-muted-foreground">{copy.credit}</p>
    </div>
  )
}
