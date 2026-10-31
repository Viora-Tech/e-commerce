'use client'

import type { GrievanceOfficer, CustomerPrivacySettings as Settings } from '@commerce/core'
import { PRIVACY_LIMITS } from '@commerce/core/privacy'
import { Eye, Pencil } from '@commerce/ui/icons'
import { Button } from '@commerce/ui/shadcn/button'
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
import { SETTINGS_BACK, settingsContent } from '@/data/settings'
import { settingsRowsContent } from '@/data/settings-rows'
import { useCopy } from '@/hooks/use-copy'
import { api } from '@/lib/api-client'
import { routes } from '@/lib/routes'
import SettingsCard from './settings-card'
import SettingsDrill from './settings-drill'
import SettingsDrillPanel from './settings-drill-panel'
import SettingsRow from './settings-row'

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

/**
 * Settings → Privacy & data requests, Shopify-style (#147): rows for the cookie banner, data
 * requests, the grievance officer and customer accounts, each opening in place (`?open=`).
 */
export default function CustomerPrivacySettings() {
  // Hooks
  const rowsCopy = useCopy(settingsRowsContent)
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
  const r = rowsCopy.privacy
  const rows = overview
    ? [
        {
          id: 'banner',
          title: r.banner,
          value: r.bannerValue(overview.settings.bannerVersion, overview.consent30Days.total),
        },
        {
          id: 'requests',
          title: r.requests,
          value: r.requestsValue(overview.requests.open, overview.requests.overdue),
        },
        {
          id: 'grievance',
          title: r.grievance,
          value: officerSet && officer ? officer.name : rowsCopy.notSet,
        },
        { id: 'accounts', title: r.accounts, value: r.accountsValue },
      ]
    : []

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
        back={SETTINGS_BACK}
        save={{ dirty, saving: busy, onSave: handleSave, label: copy.save }}
      />
      {!overview || !form ? (
        <Skeleton className="h-96 w-full rounded-2xl" />
      ) : (
        <>
          <SettingsDrill rows={rows} backLabel={r.back}>
            <SettingsDrillPanel id="banner">
              <SettingsCard
                id="privacy-consent-card"
                title={copy.banner.heading}
                description={copy.banner.body}
              >
                <SettingsRow
                  label={copy.banner.message}
                  description={copy.banner.messageHelp}
                  htmlFor="privacy-consent-message"
                >
                  <Textarea
                    id="privacy-consent-message"
                    rows={3}
                    maxLength={PRIVACY_LIMITS.bannerMessage}
                    placeholder={copy.banner.messagePlaceholder}
                    value={form.bannerMessage}
                    onChange={(e) => setForm({ ...form, bannerMessage: e.target.value })}
                  />
                  <p className="text-caption text-muted-foreground">
                    {copy.banner.stats(
                      overview.consent30Days.total,
                      overview.consent30Days.analytics,
                      overview.consent30Days.marketing,
                    )}
                  </p>
                </SettingsRow>
                <div className="flex flex-col gap-2 pt-5 sm:flex-row sm:items-center sm:justify-between">
                  <div className="flex flex-col gap-0.5">
                    <p className="text-body font-semibold text-ink-strong">
                      {copy.banner.version(overview.settings.bannerVersion)}
                    </p>
                    <p className="text-caption text-muted-foreground">{copy.banner.askAgainHelp}</p>
                  </div>
                  <Button variant="outline" onClick={() => setAsking(true)} disabled={busy}>
                    {copy.banner.askAgain}
                  </Button>
                </div>
              </SettingsCard>
            </SettingsDrillPanel>

            <SettingsDrillPanel id="requests">
              <SettingsCard
                id="privacy-requests"
                title={copy.requests.heading}
                description={copy.requests.body}
              >
                <SettingsRow
                  label={copy.requests.dueDays}
                  description={copy.requests.dueDaysHelp}
                  htmlFor="privacy-due-days"
                >
                  <div className="flex items-center gap-2">
                    <Input
                      id="privacy-due-days"
                      type="number"
                      inputMode="numeric"
                      className="w-24"
                      min={PRIVACY_LIMITS.minDueDays}
                      max={PRIVACY_LIMITS.maxDueDays}
                      value={form.requestDueDays}
                      onChange={(e) =>
                        setForm({ ...form, requestDueDays: clampDays(e.target.value) })
                      }
                    />
                    <span className="text-body text-muted-foreground">{copy.requests.days}</span>
                  </div>
                </SettingsRow>
                <div className="flex flex-col gap-2 pt-5 sm:flex-row sm:items-center sm:justify-between">
                  <p className="text-body text-foreground">
                    {copy.requests.counts(overview.requests.open, overview.requests.overdue)}
                  </p>
                  <Button
                    render={<Link href={routes.settings.privacyRequests()} />}
                    nativeButton={false}
                  >
                    <Eye aria-hidden="true" />
                    {copy.requests.view}
                  </Button>
                </div>
              </SettingsCard>
            </SettingsDrillPanel>

            <SettingsDrillPanel id="grievance">
              <SettingsCard
                id="privacy-grievance"
                title={copy.grievance.heading}
                description={copy.grievance.body}
                bodyClassName="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between"
              >
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
                  className="self-end"
                  render={<Link href={`${routes.settings.policies()}?open=grievance`} />}
                  nativeButton={false}
                >
                  <Pencil aria-hidden="true" />
                  {copy.grievance.edit}
                </Button>
              </SettingsCard>
            </SettingsDrillPanel>

            <SettingsDrillPanel id="accounts">
              <SettingsCard title={copy.accounts.heading} description={copy.accounts.body}>
                <Button
                  variant="outline"
                  className="self-end"
                  render={<Link href={routes.settings.customerAccounts()} />}
                  nativeButton={false}
                >
                  {copy.accounts.link}
                </Button>
              </SettingsCard>
            </SettingsDrillPanel>
          </SettingsDrill>

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
