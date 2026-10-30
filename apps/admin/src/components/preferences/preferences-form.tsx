'use client'

import {
  PREFERENCE_LIMITS,
  type StorePreferences,
  StorePreferencesSchema,
} from '@commerce/core/preferences'
import { Button } from '@commerce/ui/shadcn/button'
import Link from 'next/link'
import { useState } from 'react'
import { toast } from 'sonner'
import PageBody from '@/components/layout/page-body'
import PageColumns from '@/components/layout/page-columns'
import PageHeader from '@/components/layout/page-header'
import SaveBar from '@/components/layout/save-bar'
import SettingsCard from '@/components/settings/settings-card'
import SettingsToggleRow from '@/components/settings/settings-toggle-row'
import { preferencesContent as copy } from '@/data/preferences'
import { api } from '@/lib/api-client'
import { routes } from '@/lib/routes'
import PreferencesPreviews from './preferences-previews'
import PreferencesRelated from './preferences-related'
import SocialImageField from './social-image-field'
import TextSetting from './text-setting'

/** The verification fields, in the order the card lists them. */
const VERIFICATION_FIELDS = ['google', 'bing', 'meta', 'pinterest'] as const

type PreferencesFormProps = {
  initial: StorePreferences
  /** The storefront's address, for the search and share previews. */
  storefrontOrigin: string
}

type Errors = Partial<Record<string, string>>

/** Zod issues keyed by dotted path, e.g. `tracking.ga4`. */
function validate(form: StorePreferences): Errors {
  const r = StorePreferencesSchema.safeParse(form)
  if (r.success) return {}
  return Object.fromEntries(r.error.issues.map((i) => [i.path.join('.'), i.message]))
}

/**
 * Online Store › Preferences: search listing, social image, password page, search engine and
 * AI crawler access, site verification, spam protection, consent, tags, and links to the
 * storefront settings that live elsewhere.
 */
export default function PreferencesForm({ initial, storefrontOrigin }: PreferencesFormProps) {
  // Hooks
  const [form, setForm] = useState(initial)
  const [saved, setSaved] = useState(initial)
  const [busy, setBusy] = useState(false)
  const [attempted, setAttempted] = useState(false)

  // Helpers
  const patch = <K extends keyof StorePreferences>(key: K, p: Partial<StorePreferences[K]>) =>
    setForm((f) => ({ ...f, [key]: { ...f[key], ...p } }))

  // Event handlers
  const handleSave = async () => {
    setAttempted(true)
    if (Object.keys(validate(form)).length) return
    setBusy(true)
    try {
      const next = await api.store.updatePreferences(form)
      setForm(next)
      setSaved(next)
      setAttempted(false)
      toast.success(copy.saved)
    } catch (err) {
      toast.error(err instanceof Error && err.message ? err.message : copy.failed)
    } finally {
      setBusy(false)
    }
  }

  const handleDiscard = () => {
    setForm(saved)
    setAttempted(false)
  }

  // Render logic
  const dirty = JSON.stringify(form) !== JSON.stringify(saved)
  const errors = attempted ? validate(form) : {}

  return (
    <PageBody className="gap-6 md:pt-5 md:pb-8">
      <SaveBar
        open={dirty}
        message={copy.unsaved}
        saveLabel={copy.save}
        discardLabel={copy.discard}
        onSave={handleSave}
        onDiscard={handleDiscard}
        saving={busy}
      />
      <PageHeader
        title={copy.title}
        subtitle={copy.subtitle}
        save={{ dirty, saving: busy, onSave: handleSave, label: copy.save }}
      />

      <PageColumns
        main={
          <>
            <SettingsCard title={copy.seo.heading} description={copy.seo.body}>
              <TextSetting
                id="seo-title"
                label={copy.seo.title}
                value={form.seo.title}
                maxLength={PREFERENCE_LIMITS.seoTitle}
                onChange={(title) => patch('seo', { title })}
                help={copy.seo.titleHelp}
                error={errors['seo.title']}
              />
              <TextSetting
                id="seo-description"
                label={copy.seo.description}
                value={form.seo.description}
                maxLength={PREFERENCE_LIMITS.seoDescription}
                multiline
                onChange={(description) => patch('seo', { description })}
                help={copy.seo.descriptionHelp}
                error={errors['seo.description']}
              />
            </SettingsCard>

            <SettingsCard title={copy.social.heading} description={copy.social.body}>
              <SocialImageField
                value={form.seo.image}
                onChange={(image) => patch('seo', { image })}
              />
              {form.seo.image ? (
                <TextSetting
                  id="seo-image-alt"
                  label={copy.social.alt}
                  value={form.seo.imageAlt}
                  maxLength={PREFERENCE_LIMITS.imageAlt}
                  onChange={(imageAlt) => patch('seo', { imageAlt })}
                  help={copy.social.altHelp}
                />
              ) : null}
            </SettingsCard>

            <SettingsCard
              id="password"
              title={copy.password.heading}
              description={copy.password.body}
            >
              <SettingsToggleRow
                id="password-enabled"
                label={copy.password.enabled}
                checked={form.password.enabled}
                onChange={(enabled) => patch('password', { enabled })}
              />
              {form.password.enabled ? (
                <>
                  <TextSetting
                    id="store-password"
                    label={copy.password.password}
                    value={form.password.password}
                    maxLength={PREFERENCE_LIMITS.password}
                    onChange={(password) => patch('password', { password })}
                    help={copy.password.passwordHelp}
                    error={errors['password.password']}
                  />
                  <TextSetting
                    id="store-password-message"
                    label={copy.password.message}
                    value={form.password.message}
                    maxLength={PREFERENCE_LIMITS.message}
                    multiline
                    onChange={(message) => patch('password', { message })}
                    help={copy.password.messageHelp}
                  />
                </>
              ) : null}
            </SettingsCard>

            <SettingsCard title={copy.indexing.heading} description={copy.indexing.body}>
              {form.password.enabled ? (
                <p className="mb-4 rounded-lg bg-muted px-3 py-2 text-caption text-muted-foreground">
                  {copy.indexing.locked}
                </p>
              ) : null}
              <SettingsToggleRow
                id="indexing-search"
                label={copy.indexing.search}
                description={copy.indexing.searchHelp}
                checked={form.indexing.searchEngines}
                onChange={(searchEngines) => patch('indexing', { searchEngines })}
              />
              <SettingsToggleRow
                id="indexing-ai"
                label={copy.indexing.ai}
                description={
                  form.indexing.searchEngines ? copy.indexing.aiHelp : copy.indexing.aiNeedsSearch
                }
                checked={form.indexing.searchEngines && form.indexing.aiCrawlers}
                disabled={!form.indexing.searchEngines}
                onChange={(aiCrawlers) => patch('indexing', { aiCrawlers })}
              />
            </SettingsCard>

            <SettingsCard
              title={copy.verification.heading}
              description={copy.verification.body}
              bodyClassName="gap-5"
            >
              {VERIFICATION_FIELDS.map((key) => (
                <TextSetting
                  key={key}
                  id={`verification-${key}`}
                  label={copy.verification[key]}
                  value={form.verification[key]}
                  placeholder={copy.verification.placeholder}
                  onChange={(v) => patch('verification', { [key]: v })}
                  help={copy.verification[`${key}Help`]}
                  error={errors[`verification.${key}`]}
                />
              ))}
            </SettingsCard>

            <SettingsCard title={copy.spam.heading}>
              <p className="text-body text-muted-foreground">{copy.spam.body}</p>
            </SettingsCard>

            <SettingsCard title={copy.privacy.heading} description={copy.privacy.body}>
              <Button
                variant="outline"
                className="self-end"
                render={<Link href="/settings/privacy#banner" />}
                nativeButton={false}
              >
                {copy.privacy.link}
              </Button>
            </SettingsCard>

            <SettingsCard title={copy.tracking.heading} description={copy.tracking.body}>
              <TextSetting
                id="tracking-ga4"
                label={copy.tracking.ga4}
                value={form.tracking.ga4}
                placeholder={copy.tracking.ga4Placeholder}
                onChange={(ga4) => patch('tracking', { ga4 })}
                help={copy.tracking.analytics}
                error={errors['tracking.ga4']}
              />
              <TextSetting
                id="tracking-gtm"
                label={copy.tracking.gtm}
                value={form.tracking.gtm}
                placeholder={copy.tracking.gtmPlaceholder}
                onChange={(gtm) => patch('tracking', { gtm })}
                help={copy.tracking.analytics}
                error={errors['tracking.gtm']}
              />
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="flex flex-col gap-1">
                  <span className="text-body font-medium">{copy.tracking.metaPixel}</span>
                  <span className="text-caption text-muted-foreground">
                    {copy.tracking.metaPixelMoved}
                  </span>
                </div>
                <Button
                  variant="outline"
                  render={<Link href={routes.apps.page('pixels')} />}
                  nativeButton={false}
                >
                  {copy.tracking.metaPixelLink}
                </Button>
              </div>
              <TextSetting
                id="tracking-google-ads"
                label={copy.tracking.googleAds}
                value={form.tracking.googleAds}
                placeholder={copy.tracking.googleAdsPlaceholder}
                onChange={(googleAds) => patch('tracking', { googleAds })}
                help={copy.tracking.marketing}
                error={errors['tracking.googleAds']}
              />
            </SettingsCard>

            <PreferencesRelated />
          </>
        }
        side={<PreferencesPreviews seo={form.seo} origin={storefrontOrigin} />}
      />
    </PageBody>
  )
}
