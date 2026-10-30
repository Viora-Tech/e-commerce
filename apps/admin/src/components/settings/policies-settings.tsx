'use client'

import type { PolicySettings, StorePolicy } from '@commerce/core'
import { REQUIRED_POLICY_TYPES } from '@commerce/core/policies'
import { InfoIcon } from '@commerce/ui/icons'
import { Alert, AlertDescription, AlertTitle } from '@commerce/ui/shadcn/alert'
import { Badge } from '@commerce/ui/shadcn/badge'
import { Button } from '@commerce/ui/shadcn/button'
import { Skeleton } from '@commerce/ui/shadcn/skeleton'
import Link from 'next/link'
import { useEffect, useState } from 'react'
import { toast } from 'sonner'
import PageHeader from '@/components/layout/page-header'
import SaveBar from '@/components/layout/save-bar'
import StatusChip from '@/components/layout/status-chip'
import { policiesContent as copy } from '@/data/policies'
import { SETTINGS_BACK, settingsContent } from '@/data/settings'
import { settingsRowsContent } from '@/data/settings-rows'
import { useCopy } from '@/hooks/use-copy'
import { useSetupNext } from '@/hooks/use-setup-next'
import { api } from '@/lib/api-client'
import { formatDate } from '@/lib/format-date'
import { routes } from '@/lib/routes'
import SettingsCard from './settings-card'
import SettingsDrill from './settings-drill'
import SettingsDrillPanel from './settings-drill-panel'
import SettingsLinkRow from './settings-link-row'
import SettingsList from './settings-list'
import SettingsTextRow from './settings-text-row'

type PolicyRowProps = {
  policy: StorePolicy
}

type Officer = PolicySettings['grievanceOfficer']

const OFFICER_FIELDS: { key: keyof Officer; type: string; placeholder?: string }[] = [
  { key: 'name', type: 'text' },
  { key: 'designation', type: 'text', placeholder: copy.grievance.designationPlaceholder },
  { key: 'email', type: 'email' },
  { key: 'phone', type: 'tel' },
]

/**
 * Settings → Policies, Shopify-style (#147): rows for the five policies, the business name every
 * policy prints and the grievance officer, each opening in place (`?open=`).
 */
export default function PoliciesSettings() {
  // Hooks
  const rowsCopy = useCopy(settingsRowsContent)
  const announceSetup = useSetupNext()
  const [policies, setPolicies] = useState<StorePolicy[] | null>(null)
  const [form, setForm] = useState<PolicySettings | null>(null)
  const [saved, setSaved] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [failed, setFailed] = useState(false)

  useEffect(() => {
    api.policies
      .list()
      .then((r) => {
        setPolicies(r.policies)
        setForm(r.settings)
        setSaved(JSON.stringify(r.settings))
      })
      .catch(() => setFailed(true))
  }, [])

  // Helpers
  const patchOfficer = (key: keyof Officer, value: string) =>
    setForm((f) => (f ? { ...f, grievanceOfficer: { ...f.grievanceOfficer, [key]: value } } : f))

  // Event handlers
  const handleSave = async () => {
    if (!form) return
    setBusy(true)
    try {
      const next = await api.policies.saveSettings(form)
      setForm(next)
      setSaved(JSON.stringify(next))
      toast.success(copy.saved)
      void announceSetup('policies')
    } catch (err) {
      toast.error(err instanceof Error ? err.message : copy.failed)
    } finally {
      setBusy(false)
    }
  }

  const handleDiscard = () => {
    if (saved) setForm(JSON.parse(saved) as PolicySettings)
  }

  // Early returns
  if (failed) {
    return <p className="text-body text-muted-foreground">{copy.list.loadFailed}</p>
  }

  // Render logic
  const dirty = form !== null && saved !== null && JSON.stringify(form) !== saved
  const r = rowsCopy.policies
  const rows =
    policies && form
      ? [
          {
            id: 'policies',
            title: r.list,
            value: r.published(
              policies.filter((p) => p.pageId !== null && p.published).length,
              policies.length,
            ),
          },
          { id: 'business', title: r.business, value: form.legalName || rowsCopy.notSet },
          {
            id: 'grievance',
            title: r.grievance,
            value: form.grievanceOfficer.name || rowsCopy.notSet,
          },
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
        onDiscard={handleDiscard}
        saving={busy}
      />
      <PageHeader
        title={copy.title}
        subtitle={copy.subtitle}
        back={SETTINGS_BACK}
        save={{ dirty, saving: busy, onSave: handleSave, label: copy.save }}
      />
      <Alert>
        <InfoIcon aria-hidden="true" />
        <AlertTitle>{copy.disclaimer.title}</AlertTitle>
        <AlertDescription>{copy.disclaimer.body}</AlertDescription>
      </Alert>
      {!policies || !form ? (
        <Skeleton className="h-64 w-full rounded-2xl" />
      ) : (
        <SettingsDrill rows={rows} backLabel={r.back}>
          <SettingsDrillPanel id="policies">
            <SettingsList heading={copy.list.heading}>
              {policies.map((p) => (
                <PolicyRow key={p.type} policy={p} />
              ))}
            </SettingsList>
          </SettingsDrillPanel>

          <SettingsDrillPanel id="business">
            <SettingsCard title={copy.business.heading} description={copy.business.help}>
              <SettingsTextRow
                id="policy-legal-name"
                label={copy.business.legalName}
                description={copy.business.legalNameHint}
                value={form.legalName}
                onChange={(legalName) => setForm({ ...form, legalName })}
              />
              <div className="flex justify-end pt-5">
                <Button
                  variant="outline"
                  render={<Link href={routes.settings.store()} />}
                  nativeButton={false}
                >
                  {copy.business.generalLink}
                </Button>
              </div>
            </SettingsCard>
          </SettingsDrillPanel>

          <SettingsDrillPanel id="grievance">
            <SettingsCard
              id="grievance-officer"
              title={copy.grievance.heading}
              description={copy.grievance.help}
            >
              {OFFICER_FIELDS.map((f) => (
                <SettingsTextRow
                  key={f.key}
                  id={`grievance-${f.key}`}
                  type={f.type}
                  label={copy.grievance[f.key]}
                  value={form.grievanceOfficer[f.key]}
                  onChange={(v) => patchOfficer(f.key, v)}
                />
              ))}
              <p className="mt-3 text-caption text-muted-foreground">{copy.grievance.shownIn}</p>
            </SettingsCard>
          </SettingsDrillPanel>
        </SettingsDrill>
      )}
    </div>
  )
}

/* One policy: its name, whether shoppers can see it, when it last changed, and the next step. */
function PolicyRow({ policy }: PolicyRowProps) {
  const created = policy.pageId !== null
  const status = !created ? 'missing' : policy.published ? 'published' : 'draft'
  const variant = status === 'published' ? 'success' : status === 'draft' ? 'neutral' : 'attention'
  const href = `/settings/policies/${policy.type}${created ? '' : '?template=1'}`
  return (
    <li>
      <SettingsLinkRow
        href={href}
        title={
          <>
            <span>{copy.names[policy.type]}</span>
            <StatusChip tone={variant}>{copy.list.status[status]}</StatusChip>
            {REQUIRED_POLICY_TYPES.includes(policy.type) && status !== 'published' ? (
              <Badge variant="outline">{copy.list.required}</Badge>
            ) : null}
          </>
        }
        description={
          policy.updatedAt
            ? copy.list.updated(formatDate(policy.updatedAt))
            : copy.hints[policy.type]
        }
        value={created ? copy.list.edit : copy.list.create}
      />
    </li>
  )
}
