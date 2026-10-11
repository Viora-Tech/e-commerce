'use client'

import { type StoreGeneral, StoreGeneralSchema } from '@commerce/core/store-settings'
import { MapPinLineIcon } from '@commerce/ui/icons'
import { Button } from '@commerce/ui/shadcn/button'
import { Card } from '@commerce/ui/shadcn/card'
import { Input } from '@commerce/ui/shadcn/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@commerce/ui/shadcn/select'
import { Skeleton } from '@commerce/ui/shadcn/skeleton'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useEffect, useState } from 'react'
import { toast } from 'sonner'
import SaveBar from '@/components/layout/save-bar'
import { settingsContent } from '@/data/settings'
import { taxesContent } from '@/data/taxes'
import { useSetupNext } from '@/hooks/use-setup-next'
import { api } from '@/lib/api-client'
import GeneralCompletion, { detailsDone } from './general-completion'
import SettingsCard from './settings-card'
import SettingsPageHeader from './settings-page-header'
import SettingsRow from './settings-row'
import SettingsTextRow from './settings-text-row'
import StoreDataSection from './store-data-section'

type Loaded = NonNullable<Awaited<ReturnType<typeof api.store.getGeneral>>>
type Errors = Partial<Record<string, string>>

const copy = settingsContent.general
const movedCopy = taxesContent.movedFromGeneral
const TAXES_HREF = '/settings/taxes'
const timezoneItems = Object.fromEntries(copy.timezones.map((t) => [t.value, t.label]))

/** Zod issues keyed by dotted path, e.g. `address.pincode`. */
function validate(form: StoreGeneral): Errors {
  const r = StoreGeneralSchema.safeParse(form)
  if (r.success) return {}
  return Object.fromEntries(r.error.issues.map((i) => [i.path.join('.'), i.message]))
}

function LoadingCards() {
  return (
    <>
      {[0, 1, 2].map((i) => (
        <Card key={i} gap={4} inset={6}>
          <Skeleton className="h-5 w-40" />
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-10 w-full" />
        </Card>
      ))}
    </>
  )
}

/**
 * Settings › Store details (once "General") in three cards (store details, business address,
 * currency and time), each with a help line, plus how many details are done
 * and a prompt when the business address is still empty, then the store's data
 * (export, delete). Taxes moved to Settings › Taxes & GST; `#tax` redirects there.
 */
export default function GeneralSettings() {
  // Hooks
  const announceSetup = useSetupNext()
  const router = useRouter()
  const [form, setForm] = useState<Loaded | null>(null)
  const [saved, setSaved] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [attempted, setAttempted] = useState(false)
  useEffect(() => {
    // Old links to the tax card (General's #tax, which redirects to this page) land on Taxes & GST.
    if (window.location.hash === '#tax') router.replace(TAXES_HREF)
  }, [router])
  useEffect(() => {
    api.store.getGeneral().then((g) => {
      if (!g) return
      setForm(g)
      setSaved(JSON.stringify(g))
    })
  }, [])

  // Helpers
  const patch = (p: Partial<Loaded>) => setForm((f) => (f ? { ...f, ...p } : f))
  const patchAddress = (p: Partial<Loaded['address']>) =>
    setForm((f) => (f ? { ...f, address: { ...f.address, ...p } } : f))

  // Event handlers
  const handleSave = async () => {
    if (!form) return
    setAttempted(true)
    if (Object.keys(validate(form)).length) return
    setBusy(true)
    try {
      // Tax fields belong to Settings › Taxes & GST; leaving them out keeps that page's values.
      const { currency: _c, gstin: _g, gstRatePercent: _r, ...input } = form
      const result = await api.store.updateGeneral(input)
      if (!result) throw new Error(copy.failed)
      setForm(result)
      setSaved(JSON.stringify(result))
      setAttempted(false)
      toast.success(copy.saved)
      void announceSetup('store')
    } catch (err) {
      toast.error(err instanceof Error ? err.message : copy.failed)
    } finally {
      setBusy(false)
    }
  }

  const handleDiscard = () => {
    if (saved) setForm(JSON.parse(saved) as Loaded)
    setAttempted(false)
  }

  const handleAddAddress = () => document.getElementById('addr-line1')?.focus()

  // Render logic
  const dirty = form !== null && saved !== null && JSON.stringify(form) !== saved
  const errors = form && attempted ? validate(form) : {}
  const savedDetails = saved ? (JSON.parse(saved) as Loaded) : null
  const addressMissing = savedDetails ? !detailsDone(savedDetails).address : false

  return (
    <div className="flex flex-col gap-6">
      <SaveBar
        open={dirty}
        message={copy.unsaved}
        saveLabel={copy.save}
        discardLabel={copy.discard}
        onSave={handleSave}
        onDiscard={handleDiscard}
        saving={busy}
      />
      <SettingsPageHeader
        title={copy.title}
        subtitle={copy.intro}
        onSave={handleSave}
        dirty={dirty}
        saving={busy}
        saveLabel={copy.save}
      />
      {!form ? (
        <LoadingCards />
      ) : (
        <>
          {savedDetails ? <GeneralCompletion details={savedDetails} /> : null}

          <SettingsCard
            id="store-details"
            title={copy.details.heading}
            description={copy.details.help}
          >
            <SettingsTextRow
              id="store-name"
              label={copy.details.name}
              description={copy.details.nameHelp}
              value={form.name}
              onChange={(name) => patch({ name })}
              error={errors.name}
            />
            <SettingsTextRow
              id="store-email"
              type="email"
              label={copy.details.email}
              description={copy.details.emailHelp}
              value={form.contactEmail}
              onChange={(contactEmail) => patch({ contactEmail })}
              error={errors.contactEmail}
              autoComplete="email"
            />
            <SettingsTextRow
              id="store-phone"
              type="tel"
              label={copy.details.phone}
              description={copy.details.phoneHelp}
              value={form.contactPhone}
              onChange={(contactPhone) => patch({ contactPhone })}
              error={errors.contactPhone}
              autoComplete="tel"
            />
          </SettingsCard>

          <SettingsCard id="address" title={copy.address.heading} description={copy.address.help}>
            {addressMissing ? (
              <div className="mb-5 flex flex-col gap-3 rounded-lg border border-warning/40 bg-warning-soft p-4 sm:flex-row sm:items-center">
                <MapPinLineIcon
                  aria-hidden="true"
                  className="size-5 shrink-0 text-warning-foreground dark:text-warning"
                />
                <div className="flex flex-1 flex-col gap-0.5">
                  <p className="text-body font-semibold text-foreground">
                    {copy.address.prompt.title}
                  </p>
                  <p className="text-body text-muted-foreground">{copy.address.prompt.body}</p>
                </div>
                <Button variant="outline" onClick={handleAddAddress}>
                  {copy.address.prompt.action}
                </Button>
              </div>
            ) : null}
            <SettingsTextRow
              id="addr-line1"
              label={copy.address.line1}
              value={form.address.line1}
              onChange={(line1) => patchAddress({ line1 })}
              autoComplete="address-line1"
            />
            <SettingsTextRow
              id="addr-line2"
              label={copy.address.line2}
              value={form.address.line2}
              onChange={(line2) => patchAddress({ line2 })}
              autoComplete="address-line2"
            />
            <SettingsTextRow
              id="addr-city"
              label={copy.address.city}
              value={form.address.city}
              onChange={(city) => patchAddress({ city })}
              autoComplete="address-level2"
            />
            <SettingsTextRow
              id="addr-state"
              label={copy.address.state}
              value={form.address.state}
              onChange={(state) => patchAddress({ state })}
              autoComplete="address-level1"
            />
            <SettingsTextRow
              id="addr-pincode"
              label={copy.address.pincode}
              value={form.address.pincode}
              onChange={(pincode) => patchAddress({ pincode })}
              error={errors['address.pincode']}
              autoComplete="postal-code"
              inputMode="numeric"
            />
          </SettingsCard>

          <div
            id="tax"
            className="flex scroll-mt-6 flex-col gap-3 rounded-xl border border-border bg-card p-4 sm:flex-row sm:items-center"
          >
            <p className="flex-1 text-body text-foreground">{movedCopy.body}</p>
            <Button variant="outline" render={<Link href={TAXES_HREF} />} nativeButton={false}>
              {movedCopy.action}
            </Button>
          </div>

          <SettingsCard id="formats" title={copy.locale.heading} description={copy.locale.help}>
            <SettingsRow
              label={copy.locale.currency}
              description={copy.locale.currencyHelp}
              htmlFor="store-currency"
            >
              <Input size="lg" id="store-currency" value={form.currency} readOnly disabled />
            </SettingsRow>
            <SettingsRow label={copy.locale.timezone} htmlFor="store-timezone">
              <Select
                items={timezoneItems}
                value={form.timezone}
                onValueChange={(timezone) => timezone && patch({ timezone })}
              >
                <SelectTrigger size="lg" id="store-timezone" className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {copy.timezones.map((t) => (
                    <SelectItem key={t.value} value={t.value}>
                      {t.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </SettingsRow>
          </SettingsCard>
          <StoreDataSection />
        </>
      )}
    </div>
  )
}
