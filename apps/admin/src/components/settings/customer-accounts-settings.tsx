'use client'

import type { CustomerAccountSettings as Settings } from '@commerce/core'
import {
  LOGIN_METHODS,
  type LoginMethod,
  type LoginProvider,
  type ProviderReadiness,
} from '@commerce/core/customer-accounts'
import { Badge } from '@commerce/ui/shadcn/badge'
import { Button } from '@commerce/ui/shadcn/button'
import { Skeleton } from '@commerce/ui/shadcn/skeleton'
import Link from 'next/link'
import { useEffect, useState } from 'react'
import { toast } from 'sonner'
import PageHeader from '@/components/layout/page-header'
import SaveBar from '@/components/layout/save-bar'
import ChoiceList from '@/components/returns/choice-list'
import LoginAppDialog from '@/components/settings/login-app-dialog'
import SignInExtrasCard from '@/components/settings/sign-in-extras-card'
import SignInProvidersCard from '@/components/settings/sign-in-providers-card'
import {
  customerAccountsContent as copy,
  LOGIN_METHOD_COPY,
  PROVIDER_COPY,
} from '@/data/customer-accounts'
import { settingsContent } from '@/data/settings'
import { api } from '@/lib/api-client'
import { routes } from '@/lib/routes'
import SettingsCard from './settings-card'
import SettingsDrill from './settings-drill'
import SettingsDrillPanel from './settings-drill-panel'
import SettingsToggleRow from './settings-toggle-row'

type Loaded = {
  settings: Settings
  available: LoginMethod[]
  unavailable: LoginMethod[]
  readiness: ProviderReadiness
  needsSetup: LoginProvider[]
  ownApps: Partial<Record<LoginProvider, Record<string, string>>>
  fields: Record<LoginProvider, { key: string; secret?: boolean; multiline?: boolean }[]>
  callbacks: Record<LoginProvider, string>
}

/** Settings → Customer accounts: guest checkout, and every way customers can sign in. */
export default function CustomerAccountsSettings() {
  // Hooks
  const [loaded, setLoaded] = useState<Loaded | null>(null)
  const [form, setForm] = useState<Settings | null>(null)
  const [saved, setSaved] = useState<string | null>(null)
  const [failed, setFailed] = useState(false)
  const [busy, setBusy] = useState(false)
  const [setupFor, setSetupFor] = useState<LoginProvider | null>(null)

  useEffect(() => {
    api.customerAccounts
      .get()
      .then((v) => {
        setLoaded(v)
        setForm(v.settings)
        setSaved(JSON.stringify(v.settings))
      })
      .catch(() => setFailed(true))
  }, [])

  // Helpers
  const toggle = (method: LoginMethod, on: boolean) => {
    if (!form) return
    const next = on
      ? LOGIN_METHODS.filter((m) => m === method || form.loginMethods.includes(m))
      : form.loginMethods.filter((m) => m !== method)
    setForm({ ...form, loginMethods: next })
  }

  /** After an app is saved or removed: fresh readiness, the merchant's unsaved edits kept. */
  const reloadApps = () => {
    api.customerAccounts
      .get()
      .then((v) => setLoaded(v))
      .catch(() => setFailed(true))
  }

  // Event handlers
  const handleSave = async () => {
    if (!form || !loaded) return
    setBusy(true)
    try {
      const settings = await api.customerAccounts.save(form)
      setLoaded({ ...loaded, settings, unavailable: [], needsSetup: [] })
      setForm(settings)
      setSaved(JSON.stringify(settings))
      toast.success(copy.saved)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : copy.failed)
    } finally {
      setBusy(false)
    }
  }

  const listOr = (names: string[]) => (names.length ? names.join(', ') : copy.rows.none)

  // Early returns
  if (failed) return <p className="text-body text-muted-foreground">{copy.loadFailed}</p>

  // Render logic
  const dirty = form !== null && saved !== null && JSON.stringify(form) !== saved
  const none = form !== null && form.loginMethods.length === 0
  const stale = loaded?.unavailable ?? []
  const hidden = loaded?.needsSetup ?? []
  const rows = form
    ? [
        {
          id: 'checkout',
          title: copy.checkout.heading,
          value: form.checkout === 'account_required' ? copy.rows.required : copy.rows.guest,
        },
        {
          id: 'sign-in',
          title: copy.methods.heading,
          value: listOr(form.loginMethods.map((m) => LOGIN_METHOD_COPY[m].label)),
        },
        {
          id: 'providers',
          title: copy.providers.heading,
          value: listOr(
            (Object.keys(form.providers) as LoginProvider[])
              .filter((p) => form.providers[p].enabled)
              .map((p) => PROVIDER_COPY[p].label),
          ),
        },
        { id: 'more-sign-in', title: copy.extras.heading, value: copy.rows.extrasValue },
        { id: 'deletion', title: copy.deletion.heading, value: copy.rows.deletionValue },
      ]
    : []

  return (
    <div className="flex flex-col gap-4">
      <SaveBar
        open={dirty && !none}
        message={settingsContent.general.unsaved}
        saveLabel={copy.save}
        discardLabel={settingsContent.general.discard}
        onSave={handleSave}
        onDiscard={() => saved && setForm(JSON.parse(saved) as Settings)}
        saving={busy}
      />
      <PageHeader
        title={copy.title}
        subtitle={copy.subtitle}
        save={{ dirty: dirty && !none, saving: busy, onSave: handleSave, label: copy.save }}
      />
      {!form || !loaded ? (
        <Skeleton className="h-96 w-full rounded-2xl" />
      ) : (
        <SettingsDrill rows={rows} backLabel={copy.rows.back}>
          <SettingsDrillPanel id="checkout">
            <SettingsCard title={copy.checkout.heading}>
              <ChoiceList
                name="account-checkout"
                value={form.checkout}
                onChange={(v) =>
                  setForm({
                    ...form,
                    checkout: v === 'account_required' ? 'account_required' : 'guest',
                  })
                }
                choices={[
                  { value: 'guest', ...copy.checkout.choices.guest },
                  { value: 'account_required', ...copy.checkout.choices.account_required },
                ]}
              />
              {loaded.available.length === 0 ? (
                <p className="pt-3 text-caption text-muted-foreground">{copy.checkout.noSender}</p>
              ) : null}
            </SettingsCard>
          </SettingsDrillPanel>

          <SettingsDrillPanel id="sign-in">
            <SettingsCard title={copy.methods.heading} description={copy.methods.body}>
              {LOGIN_METHODS.map((m) => {
                const can = loaded.available.includes(m)
                const text = LOGIN_METHOD_COPY[m]
                return (
                  <SettingsToggleRow
                    key={m}
                    id={`login-${m}`}
                    label={
                      <>
                        {text.label}
                        {can ? null : <Badge variant="neutral">{copy.methods.unavailable}</Badge>}
                      </>
                    }
                    description={can ? text.hint : text.needs}
                    checked={form.loginMethods.includes(m)}
                    disabled={!can && !form.loginMethods.includes(m)}
                    onChange={(on) => toggle(m, on)}
                  />
                )
              })}
              <div className="flex flex-col gap-3 pt-3 empty:hidden">
                {stale.length > 0 ? (
                  <p className="text-caption text-warning-foreground dark:text-warning">
                    {copy.methods.stillOn(stale.map((m) => LOGIN_METHOD_COPY[m].label).join(', '))}
                  </p>
                ) : null}
                {none ? (
                  <p className="text-caption text-destructive">{copy.methods.needOne}</p>
                ) : null}
                {loaded.available.length < LOGIN_METHODS.length ? (
                  <Button
                    variant="outline"
                    className="w-fit"
                    render={<Link href={routes.settings.notifications()} />}
                    nativeButton={false}
                  >
                    {copy.methods.turnOnApp}
                  </Button>
                ) : null}
              </div>
            </SettingsCard>
          </SettingsDrillPanel>

          <SettingsDrillPanel id="providers">
            <SignInProvidersCard
              form={form}
              onChange={setForm}
              readiness={loaded.readiness}
              onSetUp={setSetupFor}
            />
            {hidden.length > 0 ? (
              <p className="text-caption text-warning-foreground dark:text-warning">
                {copy.providers.stillHidden(hidden.map((p) => PROVIDER_COPY[p].label).join(', '))}
              </p>
            ) : null}
          </SettingsDrillPanel>

          <SettingsDrillPanel id="more-sign-in">
            <SignInExtrasCard form={form} onChange={setForm} />
          </SettingsDrillPanel>

          <LoginAppDialog
            key={setupFor ?? 'closed'}
            provider={setupFor}
            onOpenChange={(open) => {
              if (!open) setSetupFor(null)
            }}
            fields={loaded.fields}
            saved={setupFor ? loaded.ownApps[setupFor] : undefined}
            redirectUrl={setupFor ? loaded.callbacks[setupFor] : ''}
            onSaved={reloadApps}
          />

          <SettingsDrillPanel id="deletion">
            <SettingsCard title={copy.deletion.heading} description={copy.deletion.body}>
              <Button
                variant="outline"
                className="self-end"
                render={<Link href={routes.settings.privacy()} />}
                nativeButton={false}
              >
                {copy.deletion.link}
              </Button>
            </SettingsCard>
          </SettingsDrillPanel>
        </SettingsDrill>
      )}
    </div>
  )
}
