'use client'

import type { CustomerAccountSettings as Settings } from '@commerce/core'
import { LOGIN_METHODS, type LoginMethod } from '@commerce/core/customer-accounts'
import { UserCircle } from '@commerce/ui/icons'
import { Badge } from '@commerce/ui/shadcn/badge'
import { Button } from '@commerce/ui/shadcn/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@commerce/ui/shadcn/card'
import { Field, FieldDescription, FieldGroup, FieldLabel } from '@commerce/ui/shadcn/field'
import { Skeleton } from '@commerce/ui/shadcn/skeleton'
import { Switch } from '@commerce/ui/shadcn/switch'
import Link from 'next/link'
import { useEffect, useState } from 'react'
import { toast } from 'sonner'
import PageHeader from '@/components/layout/page-header'
import SaveBar from '@/components/layout/save-bar'
import ChoiceList from '@/components/returns/choice-list'
import { customerAccountsContent as copy, LOGIN_METHOD_COPY } from '@/data/customer-accounts'
import { settingsContent } from '@/data/settings'
import { api } from '@/lib/api-client'

type Loaded = { settings: Settings; available: LoginMethod[]; unavailable: LoginMethod[] }

/** Settings → Customer accounts: guest checkout, and which sign-in codes customers get. */
export default function CustomerAccountsSettings() {
  // Hooks
  const [loaded, setLoaded] = useState<Loaded | null>(null)
  const [form, setForm] = useState<Settings | null>(null)
  const [saved, setSaved] = useState<string | null>(null)
  const [failed, setFailed] = useState(false)
  const [busy, setBusy] = useState(false)

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

  // Event handlers
  const handleSave = async () => {
    if (!form || !loaded) return
    setBusy(true)
    try {
      const settings = await api.customerAccounts.save(form)
      setLoaded({ ...loaded, settings, unavailable: [] })
      setForm(settings)
      setSaved(JSON.stringify(settings))
      toast.success(copy.saved)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : copy.failed)
    } finally {
      setBusy(false)
    }
  }

  // Early returns
  if (failed) return <p className="text-body text-muted-foreground">{copy.loadFailed}</p>

  // Render logic
  const dirty = form !== null && saved !== null && JSON.stringify(form) !== saved
  const none = form !== null && form.loginMethods.length === 0
  const stale = loaded?.unavailable ?? []

  return (
    <div className="flex max-w-3xl flex-col gap-4">
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
        icon={<UserCircle aria-hidden="true" />}
      />
      {!form || !loaded ? (
        <Skeleton className="h-96 w-full rounded-2xl" />
      ) : (
        <>
          <Card size="form" id="checkout">
            <CardHeader>
              <CardTitle>{copy.checkout.heading}</CardTitle>
            </CardHeader>
            <CardContent>
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
            </CardContent>
          </Card>

          <Card size="form" id="sign-in">
            <CardHeader>
              <CardTitle>{copy.methods.heading}</CardTitle>
              <CardDescription>{copy.methods.body}</CardDescription>
            </CardHeader>
            <CardContent>
              <FieldGroup>
                {LOGIN_METHODS.map((m) => {
                  const can = loaded.available.includes(m)
                  const text = LOGIN_METHOD_COPY[m]
                  return (
                    <Field key={m} orientation="horizontal" className="items-start justify-between">
                      <div className="flex flex-col gap-0.5">
                        <FieldLabel htmlFor={`login-${m}`} className="flex items-center gap-2">
                          {text.label}
                          {can ? null : <Badge variant="neutral">{copy.methods.unavailable}</Badge>}
                        </FieldLabel>
                        <FieldDescription>{can ? text.hint : text.needs}</FieldDescription>
                      </div>
                      <Switch
                        id={`login-${m}`}
                        checked={form.loginMethods.includes(m)}
                        disabled={!can && !form.loginMethods.includes(m)}
                        onCheckedChange={(on) => toggle(m, on)}
                      />
                    </Field>
                  )
                })}
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
                    render={<Link href="/settings/notifications" />}
                    nativeButton={false}
                  >
                    {copy.methods.turnOnApp}
                  </Button>
                ) : null}
              </FieldGroup>
            </CardContent>
          </Card>

          <Card size="form">
            <CardHeader>
              <CardTitle>{copy.deletion.heading}</CardTitle>
              <CardDescription>{copy.deletion.body}</CardDescription>
            </CardHeader>
            <CardContent>
              <Button
                variant="outline"
                render={<Link href="/settings/customer-privacy" />}
                nativeButton={false}
              >
                {copy.deletion.link}
              </Button>
            </CardContent>
          </Card>
        </>
      )}
    </div>
  )
}
