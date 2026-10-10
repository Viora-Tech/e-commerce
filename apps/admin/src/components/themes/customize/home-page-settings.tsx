'use client'

import { PREFERENCE_LIMITS, type StorePreferences } from '@commerce/core/preferences'
import { X } from '@commerce/ui/icons'
import { cn } from '@commerce/ui/lib/utils'
import { Button } from '@commerce/ui/shadcn/button'
import { Input } from '@commerce/ui/shadcn/input'
import { Textarea } from '@commerce/ui/shadcn/textarea'
import Image from 'next/image'
import { useEffect, useState } from 'react'
import { toast } from 'sonner'
import MediaPickDialog from '@/components/media/media-pick-dialog'
import { customizeContent } from '@/data/customize'
import { useCopy } from '@/hooks/use-copy'
import { api } from '@/lib/api-client'
import { FIELD_INPUT, FIELD_TEXTAREA } from '@/lib/customize-field-styles'
import FieldFrame from './field-frame'
import SettingsSegmented from './settings-segmented'

type HomePageSettingsProps = {
  /** The template's own name ("Home page"), shown as the page title. */
  title: string
  /** The store's web address, for the Google preview. */
  domain: string
}

type Section = 'seo' | 'password'

/**
 * Page settings for the home page (Figma 381:7853): its title and address (fixed for the home
 * page), the search engine listing with a Google preview, the social image, and visibility
 * (Published, or the store password). These are the store's Online store › Preferences, saved
 * from here with their own Save, apart from the theme's.
 */
export default function HomePageSettings({ title, domain }: HomePageSettingsProps) {
  // Hooks
  const copy = useCopy(customizeContent.pageSettings)
  const [saved, setSaved] = useState<StorePreferences | null>(null)
  const [form, setForm] = useState<StorePreferences | null>(null)
  const [failed, setFailed] = useState(false)
  const [busy, setBusy] = useState(false)
  const [picking, setPicking] = useState(false)
  const [attempt, setAttempt] = useState(0)
  // biome-ignore lint/correctness/useExhaustiveDependencies: `attempt` re-runs the load on Try again.
  useEffect(() => {
    let live = true
    setFailed(false)
    api.store.getPreferences().then(
      (prefs) => {
        if (!live) return
        setSaved(prefs)
        setForm(prefs)
      },
      () => live && setFailed(true),
    )
    return () => {
      live = false
    }
  }, [attempt])

  // Helpers
  const patch = <K extends Section>(key: K, part: Partial<StorePreferences[K]>) =>
    setForm((f) => (f ? { ...f, [key]: { ...f[key], ...part } } : f))

  // Event handlers
  const handleSave = async () => {
    if (!form) return
    setBusy(true)
    try {
      const next = await api.store.updatePreferences(form)
      setSaved(next)
      setForm(next)
      toast.success(copy.saved)
    } catch (err) {
      toast.error(err instanceof Error && err.message ? err.message : copy.failed)
    } finally {
      setBusy(false)
    }
  }
  const handlePick = (media: { id: string; url: string } | null) => {
    setPicking(false)
    if (media) patch('seo', { image: { mediaId: media.id, url: media.url } })
  }

  // Early returns
  if (failed) {
    return (
      <div className="flex flex-col items-start gap-2">
        <p className="text-[0.8125rem] text-muted-foreground">{copy.loadFailed}</p>
        <Button variant="outline" size="sm" onClick={() => setAttempt((n) => n + 1)}>
          {copy.retry}
        </Button>
      </div>
    )
  }
  if (!form || !saved) {
    return (
      <div aria-busy className="flex flex-col gap-4">
        {[0, 1, 2, 3].map((i) => (
          <span key={i} className="h-16 animate-pulse rounded-[0.625rem] bg-muted" />
        ))}
      </div>
    )
  }

  // Render logic
  const dirty = JSON.stringify(form) !== JSON.stringify(saved)
  const shortPassword =
    form.password.enabled && form.password.password.trim().length < PREFERENCE_LIMITS.passwordMin
  const image = form.seo.image

  return (
    <>
      <FieldFrame label={copy.title} htmlFor="page-title">
        <Input id="page-title" value={title} readOnly className={FIELD_INPUT} />
      </FieldFrame>
      <FieldFrame label={copy.handle} htmlFor="page-handle">
        <Input id="page-handle" value="/" readOnly className={FIELD_INPUT} />
      </FieldFrame>
      <p className="text-[0.625rem] leading-[1.0625rem] font-medium tracking-[0.05em] text-muted-foreground uppercase">
        {copy.listing}
      </p>
      <FieldFrame label={copy.seoTitle} htmlFor="page-seo-title">
        <Input
          id="page-seo-title"
          value={form.seo.title}
          maxLength={PREFERENCE_LIMITS.seoTitle}
          onChange={(e) => patch('seo', { title: e.target.value })}
          className={FIELD_INPUT}
        />
      </FieldFrame>
      <FieldFrame label={copy.seoDescription} htmlFor="page-seo-description">
        <Textarea
          id="page-seo-description"
          value={form.seo.description}
          maxLength={PREFERENCE_LIMITS.seoDescription}
          onChange={(e) => patch('seo', { description: e.target.value })}
          className={FIELD_TEXTAREA}
        />
      </FieldFrame>
      <figure
        aria-label={copy.previewLabel}
        className="flex flex-col gap-0.5 rounded-[0.625rem] bg-muted p-3"
      >
        <span className="truncate text-xs leading-[1.0625rem] text-muted-foreground">{domain}</span>
        <span className="text-sm leading-5 font-medium text-link">{form.seo.title || title}</span>
        {form.seo.description ? (
          <span className="line-clamp-2 text-xs leading-[1.0625rem] text-muted-foreground">
            {form.seo.description}
          </span>
        ) : null}
      </figure>
      <div className="flex items-center gap-2.5">
        <span className="relative h-12 w-[4.5rem] shrink-0 overflow-hidden rounded-lg border border-border bg-muted">
          {image ? (
            <Image src={image.url} alt="" fill sizes="4.5rem" className="object-cover" />
          ) : null}
        </span>
        <span className="min-w-0 flex-1 truncate text-[0.8125rem] leading-[1.1875rem] font-medium text-foreground">
          {copy.socialImage}
        </span>
        {image ? (
          <Button
            variant="ghost"
            size="icon-xs"
            onClick={() => patch('seo', { image: null })}
            aria-label={copy.removeImage}
            title={copy.removeImage}
            className="text-muted-foreground"
          >
            <X aria-hidden />
          </Button>
        ) : null}
        <Button variant="outline" onClick={() => setPicking(true)}>
          {image ? copy.change : copy.choose}
        </Button>
      </div>
      <SettingsSegmented
        label={copy.visibility}
        value={form.password.enabled ? 'password' : 'published'}
        options={[
          { value: 'published' as const, label: copy.visibilities.published },
          { value: 'password' as const, label: copy.visibilities.password },
        ]}
        onChange={(v) => patch('password', { enabled: v === 'password' })}
      />
      {form.password.enabled ? (
        <FieldFrame label={copy.password} htmlFor="page-password">
          <Input
            id="page-password"
            value={form.password.password}
            maxLength={PREFERENCE_LIMITS.password}
            onChange={(e) => patch('password', { password: e.target.value })}
            aria-invalid={shortPassword || undefined}
            aria-describedby="page-password-help"
            className={FIELD_INPUT}
          />
          <p
            id="page-password-help"
            className={cn(
              'text-xs leading-[1.0625rem]',
              shortPassword ? 'text-danger' : 'text-muted-foreground',
            )}
          >
            {shortPassword ? copy.passwordShort(PREFERENCE_LIMITS.passwordMin) : copy.passwordHelp}
          </p>
        </FieldFrame>
      ) : null}
      {dirty ? (
        <div className="sticky bottom-0 -mx-4 flex items-center gap-2 border-t border-border bg-card px-4 py-3">
          <Button size="sm" onClick={handleSave} disabled={busy || shortPassword}>
            {copy.save}
          </Button>
          <Button size="sm" variant="ghost" onClick={() => setForm(saved)} disabled={busy}>
            {copy.discard}
          </Button>
        </div>
      ) : null}
      <MediaPickDialog
        open={picking}
        title={copy.pickImage}
        empty={copy.noImages}
        onClose={() => setPicking(false)}
        onPick={handlePick}
      />
    </>
  )
}
