'use client'

import {
  PREFERENCE_LIMITS,
  type StorePreferences,
  StorePreferencesSchema,
} from '@commerce/core/preferences'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@commerce/ui/shadcn/card'
import { FieldGroup } from '@commerce/ui/shadcn/field'
import { useState } from 'react'
import { toast } from 'sonner'
import PageBody from '@/components/layout/page-body'
import PageHeader from '@/components/layout/page-header'
import SaveBar from '@/components/layout/save-bar'
import SwitchField from '@/components/themes/switch-field'
import { preferencesContent as copy } from '@/data/preferences'
import { api } from '@/lib/api-client'
import SocialImageField from './social-image-field'
import TextSetting from './text-setting'

type PreferencesFormProps = {
  initial: StorePreferences
}

type Errors = Partial<Record<string, string>>

/** Zod issues keyed by dotted path, e.g. `tracking.ga4`. */
function validate(form: StorePreferences): Errors {
  const r = StorePreferencesSchema.safeParse(form)
  if (r.success) return {}
  return Object.fromEntries(r.error.issues.map((i) => [i.path.join('.'), i.message]))
}

/** Online Store › Preferences: search listing, social image, password page, consent, tags. */
export default function PreferencesForm({ initial }: PreferencesFormProps) {
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
    <PageBody width="narrow">
      <SaveBar
        open={dirty}
        message={copy.unsaved}
        saveLabel={copy.save}
        discardLabel={copy.discard}
        onSave={handleSave}
        onDiscard={handleDiscard}
        saving={busy}
      />
      <PageHeader title={copy.title} subtitle={copy.subtitle} />

      <Card size="form">
        <CardHeader>
          <CardTitle>{copy.seo.heading}</CardTitle>
          <CardDescription>{copy.seo.body}</CardDescription>
        </CardHeader>
        <CardContent>
          <FieldGroup>
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
              help={copy.seo.count(form.seo.description.length, PREFERENCE_LIMITS.seoDescription)}
              error={errors['seo.description']}
            />
          </FieldGroup>
        </CardContent>
      </Card>

      <Card size="form">
        <CardHeader>
          <CardTitle>{copy.social.heading}</CardTitle>
          <CardDescription>{copy.social.body}</CardDescription>
        </CardHeader>
        <CardContent>
          <FieldGroup>
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
          </FieldGroup>
        </CardContent>
      </Card>

      <Card size="form">
        <CardHeader>
          <CardTitle>{copy.password.heading}</CardTitle>
          <CardDescription>{copy.password.body}</CardDescription>
        </CardHeader>
        <CardContent>
          <FieldGroup>
            <SwitchField
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
          </FieldGroup>
        </CardContent>
      </Card>

      <Card size="form">
        <CardHeader>
          <CardTitle>{copy.privacy.heading}</CardTitle>
          <CardDescription>{copy.privacy.body}</CardDescription>
        </CardHeader>
        <CardContent>
          <FieldGroup>
            <SwitchField
              label={copy.privacy.enabled}
              help={copy.privacy.enabledHelp}
              checked={form.privacy.bannerEnabled}
              onChange={(bannerEnabled) => patch('privacy', { bannerEnabled })}
            />
            {form.privacy.bannerEnabled ? (
              <TextSetting
                id="privacy-message"
                label={copy.privacy.message}
                value={form.privacy.message}
                maxLength={PREFERENCE_LIMITS.message}
                multiline
                onChange={(message) => patch('privacy', { message })}
                help={copy.privacy.messageHelp}
              />
            ) : null}
          </FieldGroup>
        </CardContent>
      </Card>

      <Card size="form">
        <CardHeader>
          <CardTitle>{copy.tracking.heading}</CardTitle>
          <CardDescription>{copy.tracking.body}</CardDescription>
        </CardHeader>
        <CardContent>
          <FieldGroup>
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
            <TextSetting
              id="tracking-meta"
              label={copy.tracking.metaPixel}
              value={form.tracking.metaPixel}
              placeholder={copy.tracking.metaPixelPlaceholder}
              onChange={(metaPixel) => patch('tracking', { metaPixel })}
              help={copy.tracking.marketing}
              error={errors['tracking.metaPixel']}
            />
          </FieldGroup>
        </CardContent>
      </Card>
    </PageBody>
  )
}
