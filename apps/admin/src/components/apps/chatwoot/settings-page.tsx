'use client'

import { ExternalLink } from '@commerce/ui/icons'
import { Button } from '@commerce/ui/shadcn/button'
import { Input } from '@commerce/ui/shadcn/input'
import { NativeSelect, NativeSelectOption } from '@commerce/ui/shadcn/native-select'
import { Switch } from '@commerce/ui/shadcn/switch'
import { useEffect, useState } from 'react'
import { toast } from 'sonner'
import PageHeader from '@/components/layout/page-header'
import SaveBar from '@/components/layout/save-bar'
import SettingsCard from '@/components/settings/settings-card'
import SettingsRow from '@/components/settings/settings-row'
import { chatwootContent } from '@/data/chatwoot'
import { useCopy } from '@/hooks/use-copy'
import { api } from '@/lib/api-client'
import SecretRow from './secret-row'

type View = Awaited<ReturnType<typeof api.chatwoot.settings.get>>

type Consent = View['consent']
type Form = {
  baseUrl: string
  accountId: string
  websiteToken: string
  apiToken: string
  hmacToken: string
  consent: Consent
  identifyShoppers: boolean
  syncContacts: boolean
}

type Busy = 'save' | 'test' | 'remove-api' | 'remove-hmac' | null

const CONSENTS: readonly Consent[] = ['necessary', 'analytics', 'marketing']

const formOf = (view: View): Form => ({
  baseUrl: view.baseUrl,
  accountId: view.accountId,
  websiteToken: view.websiteToken,
  apiToken: '',
  hmacToken: '',
  consent: view.consent,
  identifyShoppers: view.identifyShoppers,
  syncContacts: view.syncContacts,
})

type Copy = typeof chatwootContent
const errorText = (copy: Copy, err: unknown) =>
  err instanceof Error && err.message ? err.message : copy.failed

/** What is working, one sentence per part that is. */
function statusOf(copy: Copy, view: View): string {
  const parts = [
    view.chat ? copy.status.live : null,
    view.identifying ? copy.status.identifying : null,
    view.api ? copy.status.api : null,
  ].filter(Boolean)
  return parts.length ? parts.join(' ') : copy.status.notSetUp
}

/**
 * The Chatwoot app's page: address, account id and website token (the widget); the API token
 * (sync, Conversations cards) and HMAC secret (signed-in shoppers), stored encrypted and never
 * shown again; a read-only test; who is recognised and synced; the consent the chat waits for.
 */
export default function SettingsPage() {
  // Hooks
  const copy = useCopy(chatwootContent)
  const [view, setView] = useState<View | null>(null)
  const [form, setForm] = useState<Form | null>(null)
  const [busy, setBusy] = useState<Busy>(null)

  useEffect(() => {
    api.chatwoot.settings.get().then((v) => {
      setView(v)
      setForm(formOf(v))
    })
  }, [])

  // Helpers
  const patch = (next: Partial<Form>) => setForm((f) => (f ? { ...f, ...next } : f))

  /** Saves the form (typed secrets only when there are some) and shows the stored state. */
  const persist = async (current: Form): Promise<View> => {
    const { apiToken, hmacToken, ...rest } = current
    const saved = await api.chatwoot.settings.save({
      ...rest,
      ...(apiToken.trim() ? { apiToken } : {}),
      ...(hmacToken.trim() ? { hmacToken } : {}),
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

  const remove = (kind: 'remove-api' | 'remove-hmac') =>
    run(kind, async () => {
      const field = kind === 'remove-api' ? 'apiToken' : 'hmacToken'
      const saved = await api.chatwoot.settings.save({ [field]: '' })
      setView(saved)
      patch({ [field]: '' })
      toast.success(
        kind === 'remove-api' ? copy.connect.apiToken.removed : copy.connect.hmacToken.removed,
      )
    })

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
      const result = await api.chatwoot.settings.test()
      toast.success(copy.connect.testOk(result.agent, result.inbox))
    })

  const handleDiscard = () => setForm(view ? formOf(view) : null)

  // Early returns
  if (!view || !form) return null

  // Render logic
  const tokenReady = view.hasApiToken || form.apiToken.trim() !== ''
  const canTest = form.baseUrl.trim() !== '' && form.accountId.trim() !== '' && tokenReady
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
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl surface-banner px-4 py-3">
        <p className="text-body text-foreground">{statusOf(copy, view)}</p>
        {view.dashboardUrl ? (
          <a
            href={view.dashboardUrl}
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-1 text-body font-medium underline"
          >
            {copy.open}
            <ExternalLink className="size-3.5" />
          </a>
        ) : null}
      </div>
      <SettingsCard title={copy.connect.title} description={copy.connect.description}>
        <SettingsRow
          label={copy.connect.baseUrl.label}
          description={copy.connect.baseUrl.help}
          htmlFor="chatwoot-url"
        >
          <Input
            id="chatwoot-url"
            inputMode="url"
            autoComplete="off"
            placeholder={copy.connect.baseUrl.placeholder}
            value={form.baseUrl}
            onChange={(e) => patch({ baseUrl: e.target.value })}
          />
        </SettingsRow>
        <SettingsRow
          label={copy.connect.accountId.label}
          description={copy.connect.accountId.help}
          htmlFor="chatwoot-account"
        >
          <Input
            id="chatwoot-account"
            inputMode="numeric"
            autoComplete="off"
            placeholder={copy.connect.accountId.placeholder}
            value={form.accountId}
            onChange={(e) => patch({ accountId: e.target.value })}
            className="font-mono"
          />
        </SettingsRow>
        <SettingsRow
          label={copy.connect.websiteToken.label}
          description={copy.connect.websiteToken.help}
          htmlFor="chatwoot-website-token"
        >
          <Input
            id="chatwoot-website-token"
            autoComplete="off"
            spellCheck={false}
            placeholder={copy.connect.websiteToken.placeholder}
            value={form.websiteToken}
            onChange={(e) => patch({ websiteToken: e.target.value })}
            className="font-mono"
          />
        </SettingsRow>
        <SecretRow
          id="chatwoot-api-token"
          copy={copy.connect.apiToken}
          value={form.apiToken}
          saved={view.hasApiToken}
          busy={busy !== null}
          removing={busy === 'remove-api'}
          onChange={(apiToken) => patch({ apiToken })}
          onRemove={() => remove('remove-api')}
        />
        <SecretRow
          id="chatwoot-hmac-token"
          copy={copy.connect.hmacToken}
          value={form.hmacToken}
          saved={view.hasHmacToken}
          busy={busy !== null}
          removing={busy === 'remove-hmac'}
          onChange={(hmacToken) => patch({ hmacToken })}
          onRemove={() => remove('remove-hmac')}
        />
        <SettingsRow
          label={copy.connect.check.label}
          description={canTest ? copy.connect.check.help : copy.connect.testNeeds}
        >
          <Button
            variant="outline"
            className="w-fit"
            loading={busy === 'test'}
            disabled={busy !== null || !canTest}
            onClick={handleTest}
          >
            {copy.connect.test}
          </Button>
        </SettingsRow>
      </SettingsCard>
      <SettingsCard title={copy.shoppers.title}>
        <SettingsRow
          label={copy.shoppers.identify.label}
          description={copy.shoppers.identify.help}
          htmlFor="chatwoot-identify"
        >
          <Switch
            id="chatwoot-identify"
            checked={form.identifyShoppers}
            onCheckedChange={(v) => patch({ identifyShoppers: v })}
          />
        </SettingsRow>
        <SettingsRow
          label={copy.shoppers.sync.label}
          description={copy.shoppers.sync.help}
          htmlFor="chatwoot-sync"
        >
          <Switch
            id="chatwoot-sync"
            checked={form.syncContacts}
            onCheckedChange={(v) => patch({ syncContacts: v })}
          />
        </SettingsRow>
      </SettingsCard>
      <SettingsCard title={copy.privacy.title}>
        <SettingsRow
          label={copy.privacy.label}
          description={copy.privacy.help}
          htmlFor="chatwoot-consent"
        >
          <NativeSelect
            id="chatwoot-consent"
            value={form.consent}
            onChange={(e) =>
              patch({ consent: CONSENTS.find((c) => c === e.target.value) ?? 'necessary' })
            }
          >
            {CONSENTS.map((c) => (
              <NativeSelectOption key={c} value={c}>
                {copy.privacy.options[c]}
              </NativeSelectOption>
            ))}
          </NativeSelect>
        </SettingsRow>
      </SettingsCard>
      <p className="text-caption text-muted-foreground">{copy.credit}</p>
    </div>
  )
}
