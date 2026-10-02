'use client'

import type { GrievanceOfficer, CustomerPrivacySettings as Settings } from '@commerce/core'
import { PRIVACY_LIMITS } from '@commerce/core/privacy'
import { ShieldCheck } from '@commerce/ui/icons'
import { Button } from '@commerce/ui/shadcn/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@commerce/ui/shadcn/card'
import { Field, FieldDescription, FieldGroup, FieldLabel } from '@commerce/ui/shadcn/field'
import { Input } from '@commerce/ui/shadcn/input'
import { Skeleton } from '@commerce/ui/shadcn/skeleton'
import { Textarea } from '@commerce/ui/shadcn/textarea'
import Link from 'next/link'
import { useEffect, useState } from 'react'
import { toast } from 'sonner'
import PageHeader from '@/components/layout/page-header'
import SaveBar from '@/components/layout/save-bar'
import AskAgainDialog from '@/components/settings/ask-again-dialog'
import { customerPrivacyContent as copy } from '@/data/customer-privacy'
import { settingsContent } from '@/data/settings'
import { api } from '@/lib/api-client'

type Overview = {
  settings: Settings
  grievanceOfficer: GrievanceOfficer
  requests: { open: number; overdue: number }
  consent30Days: { total: number; analytics: number; marketing: number }
}

type Form = { bannerMessage: string; requestDueDays: number }

const formOf = (o: Overview): Form => ({
  bannerMessage: o.settings.bannerMessage,
  requestDueDays: o.settings.requestDueDays,
})

const clampDays = (raw: string): number =>
  Math.min(
    PRIVACY_LIMITS.maxDueDays,
    Math.max(PRIVACY_LIMITS.minDueDays, Math.round(Number(raw) || PRIVACY_LIMITS.minDueDays)),
  )

/** Settings → Privacy & data requests: cookie banner, data requests, grievance officer. */
export default function CustomerPrivacySettings() {
  // Hooks
  const [overview, setOverview] = useState<Overview | null>(null)
  const [form, setForm] = useState<Form | null>(null)
  const [saved, setSaved] = useState<string | null>(null)
  const [failed, setFailed] = useState(false)
  const [busy, setBusy] = useState(false)
  const [asking, setAsking] = useState(false)

  useEffect(() => {
    api.customerPrivacy
      .overview()
      .then((o) => {
        setOverview(o)
        setForm(formOf(o))
        setSaved(JSON.stringify(formOf(o)))
      })
      .catch(() => setFailed(true))
  }, [])

  // Event handlers
  const handleSave = async () => {
    if (!form || !overview) return
    setBusy(true)
    try {
      const settings = await api.customerPrivacy.saveSettings(form)
      const next = { ...overview, settings }
      setOverview(next)
      setForm(formOf(next))
      setSaved(JSON.stringify(formOf(next)))
      toast.success(copy.saved)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : copy.failed)
    } finally {
      setBusy(false)
    }
  }

  const handleAskAgain = async () => {
    if (!overview) return
    setBusy(true)
    try {
      const settings = await api.customerPrivacy.askConsentAgain()
      setOverview({ ...overview, settings })
      setAsking(false)
      toast.success(copy.banner.askedAgain)
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
  const officer = overview?.grievanceOfficer
  const officerSet = Boolean(officer?.name && (officer.email || officer.phone))

  return (
    <div className="flex flex-col gap-4">
      <SaveBar
        open={dirty}
        message={settingsContent.general.unsaved}
        saveLabel={copy.save}
        discardLabel={settingsContent.general.discard}
        onSave={handleSave}
        onDiscard={() => saved && setForm(JSON.parse(saved) as Form)}
        saving={busy}
      />
      <PageHeader
        title={copy.title}
        subtitle={copy.subtitle}
        icon={<ShieldCheck aria-hidden="true" />}
      />
      {!overview || !form ? (
        <Skeleton className="h-96 w-full rounded-2xl" />
      ) : (
        <>
          <Card size="form" id="banner">
            <CardHeader>
              <CardTitle>{copy.banner.heading}</CardTitle>
              <CardDescription>{copy.banner.body}</CardDescription>
            </CardHeader>
            <CardContent>
              <FieldGroup>
                <Field>
                  <FieldLabel htmlFor="privacy-banner-message">{copy.banner.message}</FieldLabel>
                  <Textarea
                    id="privacy-banner-message"
                    rows={3}
                    maxLength={PRIVACY_LIMITS.bannerMessage}
                    placeholder={copy.banner.messagePlaceholder}
                    value={form.bannerMessage}
                    onChange={(e) => setForm({ ...form, bannerMessage: e.target.value })}
                  />
                  <FieldDescription>{copy.banner.messageHelp}</FieldDescription>
                </Field>
                <p className="text-caption text-muted-foreground">
                  {copy.banner.stats(
                    overview.consent30Days.total,
                    overview.consent30Days.analytics,
                    overview.consent30Days.marketing,
                  )}
                </p>
                <div className="flex flex-col gap-2 border-t border-border pt-4 sm:flex-row sm:items-center sm:justify-between">
                  <div className="flex flex-col gap-0.5">
                    <p className="text-body font-medium">
                      {copy.banner.version(overview.settings.bannerVersion)}
                    </p>
                    <p className="text-caption text-muted-foreground">{copy.banner.askAgainHelp}</p>
                  </div>
                  <Button variant="outline" onClick={() => setAsking(true)} disabled={busy}>
                    {copy.banner.askAgain}
                  </Button>
                </div>
              </FieldGroup>
            </CardContent>
          </Card>

          <Card size="form" id="requests">
            <CardHeader>
              <CardTitle>{copy.requests.heading}</CardTitle>
              <CardDescription>{copy.requests.body}</CardDescription>
            </CardHeader>
            <CardContent>
              <FieldGroup>
                <Field className="max-w-60">
                  <FieldLabel htmlFor="privacy-due-days">{copy.requests.dueDays}</FieldLabel>
                  <div className="flex items-center gap-2">
                    <Input
                      id="privacy-due-days"
                      type="number"
                      inputMode="numeric"
                      min={PRIVACY_LIMITS.minDueDays}
                      max={PRIVACY_LIMITS.maxDueDays}
                      value={form.requestDueDays}
                      onChange={(e) =>
                        setForm({ ...form, requestDueDays: clampDays(e.target.value) })
                      }
                    />
                    <span className="text-body text-muted-foreground">{copy.requests.days}</span>
                  </div>
                  <FieldDescription>{copy.requests.dueDaysHelp}</FieldDescription>
                </Field>
                <div className="flex flex-col gap-2 border-t border-border pt-4 sm:flex-row sm:items-center sm:justify-between">
                  <p className="text-body">
                    {copy.requests.counts(overview.requests.open, overview.requests.overdue)}
                  </p>
                  <Button render={<Link href="/settings/privacy/requests" />} nativeButton={false}>
                    {copy.requests.view}
                  </Button>
                </div>
              </FieldGroup>
            </CardContent>
          </Card>

          <Card size="form" id="grievance">
            <CardHeader>
              <CardTitle>{copy.grievance.heading}</CardTitle>
              <CardDescription>{copy.grievance.body}</CardDescription>
            </CardHeader>
            <CardContent className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              {officerSet && officer ? (
                <div className="flex flex-col text-body">
                  <span className="font-medium">
                    {officer.name}
                    {officer.designation ? `, ${officer.designation}` : ''}
                  </span>
                  <span className="text-muted-foreground">
                    {[officer.email, officer.phone].filter(Boolean).join(' · ')}
                  </span>
                </div>
              ) : (
                <p className="text-body text-warning-foreground dark:text-warning">
                  {copy.grievance.missing}
                </p>
              )}
              <Button
                variant="outline"
                render={<Link href="/settings/policies#grievance" />}
                nativeButton={false}
              >
                {copy.grievance.edit}
              </Button>
            </CardContent>
          </Card>

          <Card size="form">
            <CardHeader>
              <CardTitle>{copy.accounts.heading}</CardTitle>
              <CardDescription>{copy.accounts.body}</CardDescription>
            </CardHeader>
            <CardContent>
              <Button
                variant="outline"
                render={<Link href="/settings/customer-accounts" />}
                nativeButton={false}
              >
                {copy.accounts.link}
              </Button>
            </CardContent>
          </Card>

          <AskAgainDialog
            open={asking}
            busy={busy}
            onOpenChange={setAsking}
            onConfirm={handleAskAgain}
          />
        </>
      )}
    </div>
  )
}
