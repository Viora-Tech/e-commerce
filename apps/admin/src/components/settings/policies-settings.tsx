'use client'

import type { PolicySettings, StorePolicy } from '@commerce/core'
import { REQUIRED_POLICY_TYPES } from '@commerce/core/policies'
import { ClipboardList, InfoIcon } from '@commerce/ui/icons'
import { Alert, AlertDescription, AlertTitle } from '@commerce/ui/shadcn/alert'
import { Badge } from '@commerce/ui/shadcn/badge'
import { Button } from '@commerce/ui/shadcn/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@commerce/ui/shadcn/card'
import { Field, FieldDescription, FieldGroup, FieldLabel } from '@commerce/ui/shadcn/field'
import { Input } from '@commerce/ui/shadcn/input'
import { Skeleton } from '@commerce/ui/shadcn/skeleton'
import Link from 'next/link'
import { useEffect, useState } from 'react'
import { toast } from 'sonner'
import PageHeader from '@/components/layout/page-header'
import SaveBar from '@/components/layout/save-bar'
import { policiesContent as copy } from '@/data/policies'
import { settingsContent } from '@/data/settings'
import { api } from '@/lib/api-client'
import { formatDate } from '@/lib/format-date'

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

/** Settings → Policies: business details every policy prints, then the five policies. */
export default function PoliciesSettings() {
  // Hooks
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

  return (
    <div className="flex max-w-3xl flex-col gap-4">
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
        icon={<ClipboardList aria-hidden="true" />}
      />
      <Alert>
        <InfoIcon aria-hidden="true" />
        <AlertTitle>{copy.disclaimer.title}</AlertTitle>
        <AlertDescription>{copy.disclaimer.body}</AlertDescription>
      </Alert>
      {!policies || !form ? (
        <Skeleton className="h-64 w-full rounded-2xl" />
      ) : (
        <>
          <Card size="form">
            <CardHeader>
              <CardTitle>{copy.list.heading}</CardTitle>
            </CardHeader>
            <CardContent>
              <ul className="flex flex-col divide-y divide-border">
                {policies.map((p) => (
                  <PolicyRow key={p.type} policy={p} />
                ))}
              </ul>
            </CardContent>
          </Card>

          <Card size="form">
            <CardHeader>
              <CardTitle>{copy.business.heading}</CardTitle>
              <CardDescription>{copy.business.help}</CardDescription>
            </CardHeader>
            <CardContent>
              <FieldGroup>
                <Field>
                  <FieldLabel htmlFor="policy-legal-name">{copy.business.legalName}</FieldLabel>
                  <Input
                    size="lg"
                    id="policy-legal-name"
                    value={form.legalName}
                    maxLength={200}
                    onChange={(e) => setForm({ ...form, legalName: e.target.value })}
                  />
                  <FieldDescription>{copy.business.legalNameHint}</FieldDescription>
                </Field>
                <Button
                  variant="outline"
                  className="self-start"
                  render={<Link href="/settings/general" />}
                >
                  {copy.business.generalLink}
                </Button>
              </FieldGroup>
            </CardContent>
          </Card>

          <Card size="form" id="grievance">
            <CardHeader>
              <CardTitle>{copy.grievance.heading}</CardTitle>
              <CardDescription>{copy.grievance.help}</CardDescription>
            </CardHeader>
            <CardContent>
              <FieldGroup className="grid gap-4 sm:grid-cols-2">
                {OFFICER_FIELDS.map((f) => (
                  <Field key={f.key}>
                    <FieldLabel htmlFor={`grievance-${f.key}`}>{copy.grievance[f.key]}</FieldLabel>
                    <Input
                      size="lg"
                      id={`grievance-${f.key}`}
                      type={f.type}
                      placeholder={f.placeholder}
                      value={form.grievanceOfficer[f.key]}
                      onChange={(e) => patchOfficer(f.key, e.target.value)}
                    />
                  </Field>
                ))}
              </FieldGroup>
              <p className="mt-3 text-caption text-muted-foreground">{copy.grievance.shownIn}</p>
            </CardContent>
          </Card>
        </>
      )}
    </div>
  )
}

/* One policy: its name, whether shoppers can see it, when it last changed, and the next step. */
function PolicyRow({ policy }: PolicyRowProps) {
  const created = policy.pageId !== null
  const status = !created ? 'missing' : policy.published ? 'published' : 'draft'
  const variant = status === 'published' ? 'success' : status === 'draft' ? 'neutral' : 'warning'
  const href = `/settings/policies/${policy.type}${created ? '' : '?template=1'}`
  return (
    <li className="flex flex-col gap-2 py-3 first:pt-0 last:pb-0 sm:flex-row sm:items-center sm:justify-between">
      <div className="flex min-w-0 flex-col gap-0.5">
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-body-strong">{copy.names[policy.type]}</span>
          <Badge variant={variant}>{copy.list.status[status]}</Badge>
          {REQUIRED_POLICY_TYPES.includes(policy.type) && status !== 'published' ? (
            <Badge variant="outline">{copy.list.required}</Badge>
          ) : null}
        </div>
        <span className="text-caption text-muted-foreground">
          {policy.updatedAt
            ? copy.list.updated(formatDate(policy.updatedAt))
            : copy.hints[policy.type]}
        </span>
      </div>
      <Button
        variant={created ? 'outline' : 'default'}
        className="self-start sm:self-center"
        render={<Link href={href} />}
      >
        {created ? copy.list.edit : copy.list.create}
      </Button>
    </li>
  )
}
