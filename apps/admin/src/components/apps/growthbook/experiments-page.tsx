'use client'

import { RefreshCw } from '@commerce/ui/icons'
import { Button } from '@commerce/ui/shadcn/button'
import { Input } from '@commerce/ui/shadcn/input'
import { useEffect, useState } from 'react'
import { toast } from 'sonner'
import LoadFailedState from '@/components/apps/shared/load-failed-state'
import NoticeBar from '@/components/layout/notice-bar'
import PageHeader from '@/components/layout/page-header'
import SaveBar from '@/components/layout/save-bar'
import SectionPageSkeleton from '@/components/layout/section-page-skeleton'
import SettingsCard from '@/components/settings/settings-card'
import SettingsRow from '@/components/settings/settings-row'
import { appsContent } from '@/data/apps'
import { growthbookContent } from '@/data/growthbook'
import { useCopy } from '@/hooks/use-copy'
import { api } from '@/lib/api-client'
import { errorText } from '@/lib/api-errors'
import ExperimentList from './experiment-list'

type View = Awaited<ReturnType<typeof api.growthbook.settings.get>>

type Form = {
  apiHost: string
  clientKey: string
  decryptionKey: string
  appUrl: string
  secretKey: string
}

type Busy = 'save' | 'test' | 'remove' | null

type Copy = typeof growthbookContent

const TEXT_FIELDS = ['apiHost', 'clientKey', 'decryptionKey', 'appUrl'] as const

const formOf = (view: View): Form => ({
  apiHost: view.apiHost,
  clientKey: view.clientKey,
  decryptionKey: view.decryptionKey,
  appUrl: view.appUrl,
  secretKey: '',
})

function statusOf(copy: Copy, view: View): string {
  if (view.listing) return copy.status.listing
  if (view.assigning) return copy.status.assigning
  return copy.status.notSetUp
}

/**
 * The GrowthBook app's page: the SDK connection (API host, client key, optional decryption
 * key), the GrowthBook address for links, an optional secret API key (stored encrypted, never
 * shown again) to list experiments, a connection test, how to put a section in a test, and
 * the experiments GrowthBook has.
 */
export default function ExperimentsPage() {
  // Hooks
  const apps = useCopy(appsContent)
  const copy = useCopy(growthbookContent)
  const [view, setView] = useState<View | null>(null)
  const [form, setForm] = useState<Form | null>(null)
  const [busy, setBusy] = useState<Busy>(null)
  const [version, setVersion] = useState(0)

  /** The first read failed: Try again instead of a blank page. */
  const [loadFailed, setLoadFailed] = useState(false)
  const [loadAttempt, setLoadAttempt] = useState(0)
  // biome-ignore lint/correctness/useExhaustiveDependencies: `loadAttempt` is Try again
  useEffect(() => {
    setLoadFailed(false)
    api.growthbook.settings.get().then(
      (v) => {
        setView(v)
        setForm(formOf(v))
      },
      () => setLoadFailed(true),
    )
  }, [loadAttempt])

  // Helpers
  const patch = (next: Partial<Form>) => setForm((f) => (f ? { ...f, ...next } : f))

  /** Saves the form (a typed secret only when there is one) and shows the stored state. */
  const persist = async (current: Form): Promise<View> => {
    const saved = await api.growthbook.settings.save({
      apiHost: current.apiHost,
      clientKey: current.clientKey,
      decryptionKey: current.decryptionKey,
      appUrl: current.appUrl,
      ...(current.secretKey.trim() ? { secretKey: current.secretKey } : {}),
    })
    setView(saved)
    setForm(formOf(saved))
    setVersion((n) => n + 1)
    return saved
  }

  const run = async (kind: Exclude<Busy, null>, work: () => Promise<void>) => {
    setBusy(kind)
    try {
      await work()
    } catch (err) {
      toast.error(errorText(err, copy.failed))
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
      const found = await api.growthbook.settings.test()
      toast.success(copy.connect.testOk(found.features, found.experiments))
    })

  const handleDiscard = () => setForm(view ? formOf(view) : null)

  const handleRemoveKey = () =>
    run('remove', async () => {
      const saved = await api.growthbook.settings.save({ secretKey: '' })
      setView(saved)
      patch({ secretKey: '' })
      setVersion((n) => n + 1)
      toast.success(copy.connect.secretKey.removed)
    })

  // Early returns
  if ((!view || !form) && loadFailed) {
    return (
      <LoadFailedState
        size="page"
        heading={apps.couldNotLoad.settings}
        onRetry={() => setLoadAttempt((n) => n + 1)}
      />
    )
  }
  if (!view || !form) return <SectionPageSkeleton cards={2} />

  // Render logic
  const canTest = form.apiHost.trim() !== '' && form.clientKey.trim() !== ''
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
      <NoticeBar>
        {statusOf(copy, view)}{' '}
        {view.openUrl ? (
          <a href={view.openUrl} target="_blank" rel="noreferrer" className="font-medium underline">
            {copy.status.open}
          </a>
        ) : null}
      </NoticeBar>
      <SettingsCard title={copy.connect.title} description={copy.connect.description}>
        {TEXT_FIELDS.map((key) => (
          <SettingsRow
            key={key}
            label={copy.connect[key].label}
            description={copy.connect[key].help}
            htmlFor={`growthbook-${key}`}
          >
            <Input
              id={`growthbook-${key}`}
              autoComplete="off"
              spellCheck={false}
              inputMode={key === 'apiHost' || key === 'appUrl' ? 'url' : undefined}
              placeholder={copy.connect[key].placeholder}
              value={form[key]}
              onChange={(e) => patch({ [key]: e.target.value })}
              className={key === 'clientKey' || key === 'decryptionKey' ? 'font-mono' : undefined}
            />
          </SettingsRow>
        ))}
        <SettingsRow
          label={copy.connect.secretKey.label}
          description={copy.connect.secretKey.help}
          htmlFor="growthbook-secret-key"
        >
          <Input
            id="growthbook-secret-key"
            type="password"
            autoComplete="off"
            placeholder={copy.connect.secretKey.placeholder}
            value={form.secretKey}
            onChange={(e) => patch({ secretKey: e.target.value })}
          />
          {view.hasSecretKey ? (
            <span className="flex flex-wrap items-center gap-x-3 gap-y-1 text-caption text-muted-foreground">
              {copy.connect.secretKey.saved}
              <Button
                variant="link"
                size="xs"
                className="h-auto p-0 text-destructive"
                loading={busy === 'remove'}
                disabled={busy !== null}
                onClick={handleRemoveKey}
              >
                {copy.connect.secretKey.remove}
              </Button>
            </span>
          ) : null}
          <div>
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
        </SettingsRow>
      </SettingsCard>
      <SettingsCard title={copy.howTo.title}>
        <ol className="flex list-decimal flex-col gap-2 pl-5 text-body text-foreground">
          {copy.howTo.steps.map((step) => (
            <li key={step}>{step}</li>
          ))}
        </ol>
        <p className="text-caption text-muted-foreground">{copy.howTo.prices}</p>
      </SettingsCard>
      <ExperimentList version={version} openUrl={view.openUrl} />
      <p className="text-caption text-muted-foreground">{copy.credit}</p>
    </div>
  )
}
