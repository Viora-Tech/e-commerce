'use client'

import type { EmailBranding } from '@commerce/core'
import { ImagePlus, RotateCcw, Trash2 } from '@commerce/ui/icons'
import { Button } from '@commerce/ui/shadcn/button'
import { useState } from 'react'
import { toast } from 'sonner'
import ConfirmDialog from '@/components/layout/confirm-dialog'
import DataCard from '@/components/layout/data-card'
import PageBody from '@/components/layout/page-body'
import PageHeader from '@/components/layout/page-header'
import SaveBar from '@/components/layout/save-bar'
import MediaPickDialog, { type PickedMedia } from '@/components/media/media-pick-dialog'
import LoadFailed from '@/components/states/load-failed'
import ColourField from '@/components/themes/colour-field'
import RangeField from '@/components/themes/range-field'
import { emailBrandingContent } from '@/data/email-branding'
import { notificationsSettingsContent } from '@/data/notifications'
import { useCopy } from '@/hooks/use-copy'
import { useLoad } from '@/hooks/use-load'
import { api } from '@/lib/api-client'
import { errorText } from '@/lib/api-errors'
import { routes } from '@/lib/routes'
import BrandingPreview from './branding-preview'

type Loaded = Awaited<ReturnType<typeof api.notifications.branding>>

/** The theme's look as a starting point; the neutral look where the theme has none. */
function startFrom(
  o: Loaded,
): Required<Omit<EmailBranding, 'logoUrl'>> & { logoUrl: string | null } {
  const s = o.saved
  return {
    logoUrl: s?.logoUrl !== undefined ? s.logoUrl : o.theme.logoUrl,
    logoWidth: s?.logoWidth ?? o.theme.logoWidth ?? 160,
    colour: s?.colour ?? o.theme.colour ?? '#111111',
    onColour: s?.onColour ?? o.theme.onColour ?? '#FFFFFF',
  }
}

/**
 * Settings → Notifications → Email branding, like Shopify's "Customize email templates" (owner,
 * 22 Nov 2026): the logo, its size and the colours every email uses, starting from the theme,
 * with a live preview to flip through the emails. Saved once for all of them.
 */
export default function EmailBrandingPage() {
  // Hooks
  const copy = useCopy(emailBrandingContent)
  const messagesCopy = useCopy(notificationsSettingsContent)
  const [draft, setDraft] = useState<ReturnType<typeof startFrom> | null>(null)
  const [dirty, setDirty] = useState(false)
  const [saving, setSaving] = useState(false)
  const [picking, setPicking] = useState(false)
  const [confirmReset, setConfirmReset] = useState(false)
  const { data, failed, retry, setData } = useLoad(async () => {
    const [branding, overview] = await Promise.all([
      api.notifications.branding(),
      api.notifications.overview(),
    ])
    setDraft(startFrom(branding))
    return { branding, overview }
  })

  // Helpers
  const change = (patch: Partial<NonNullable<typeof draft>>) => {
    setDraft((d) => (d ? { ...d, ...patch } : d))
    setDirty(true)
  }

  // Event handlers
  const handlePick = (media: PickedMedia | null) => {
    setPicking(false)
    if (media) change({ logoUrl: media.url })
  }

  const handleSave = async () => {
    if (!draft) return
    setSaving(true)
    try {
      const branding = await api.notifications.saveBranding(draft)
      setData((d) => (d ? { ...d, branding } : d))
      setDirty(false)
      toast.success(copy.save.saved)
    } catch (err) {
      toast.error(errorText(err, copy.save.failed))
    } finally {
      setSaving(false)
    }
  }

  const handleDiscard = () => {
    if (data) setDraft(startFrom(data.branding))
    setDirty(false)
  }

  const handleReset = async () => {
    const branding = await api.notifications.resetBranding()
    setData((d) => (d ? { ...d, branding } : d))
    setDraft(startFrom(branding))
    setDirty(false)
    toast.success(copy.reset.done)
  }

  // Early returns
  if (failed) return <LoadFailed failed={failed} onRetry={retry} />

  // Render logic
  const emails = (data?.overview.messages ?? [])
    .filter((m) => m.designable)
    .map((m) => ({ id: m.id, name: messagesCopy.messages[m.id]?.name ?? m.id }))

  return (
    <PageBody width="detail" className="flex flex-col gap-4">
      <SaveBar
        open={dirty}
        message={copy.save.message}
        saveLabel={copy.save.save}
        discardLabel={copy.save.discard}
        onSave={handleSave}
        onDiscard={handleDiscard}
        saving={saving}
      />
      <PageHeader
        title={copy.title}
        subtitle={copy.intro}
        back={{ label: copy.back, href: `${routes.settings.notifications()}?open=messages` }}
        actions={
          data?.branding.saved ? (
            <Button variant="outline" onClick={() => setConfirmReset(true)}>
              <RotateCcw aria-hidden="true" />
              {copy.reset.action}
            </Button>
          ) : null
        }
      />
      {draft ? (
        <div className="grid grid-cols-1 items-start gap-4 lg:grid-cols-[22rem_minmax(0,1fr)]">
          <div className="flex flex-col gap-4">
            <DataCard title={copy.logo.title} bodyClassName="flex flex-col gap-4">
              {draft.logoUrl ? (
                // biome-ignore lint/performance/noImgElement: the picked logo, any host
                <img
                  src={draft.logoUrl}
                  alt=""
                  className="max-h-24 w-full rounded-md border border-border bg-muted/40 object-contain p-3"
                />
              ) : (
                <p className="text-caption text-muted-foreground">{copy.logo.none}</p>
              )}
              <div className="flex flex-wrap gap-2">
                <Button variant="outline" size="sm" onClick={() => setPicking(true)}>
                  <ImagePlus aria-hidden="true" />
                  {draft.logoUrl ? copy.logo.change : copy.logo.choose}
                </Button>
                {draft.logoUrl ? (
                  <Button variant="ghost" size="sm" onClick={() => change({ logoUrl: null })}>
                    <Trash2 aria-hidden="true" />
                    {copy.logo.remove}
                  </Button>
                ) : null}
              </div>
              <RangeField
                label={copy.logo.size}
                value={draft.logoWidth}
                min={60}
                max={320}
                step={10}
                format={copy.logo.px}
                onChange={(logoWidth) => change({ logoWidth })}
              />
            </DataCard>
            <DataCard title={copy.colours.title} bodyClassName="flex flex-col gap-4">
              <ColourField
                label={copy.colours.accent}
                value={draft.colour}
                onChange={(colour) => change({ colour })}
              />
              <ColourField
                label={copy.colours.onAccent}
                value={draft.onColour}
                onChange={(onColour) => change({ onColour })}
              />
            </DataCard>
          </div>
          <BrandingPreview emails={emails} branding={draft} />
        </div>
      ) : null}
      <MediaPickDialog
        open={picking}
        title={copy.logo.pickTitle}
        description={copy.logo.pickHelp}
        onClose={() => setPicking(false)}
        onPick={handlePick}
      />
      <ConfirmDialog
        open={confirmReset}
        onOpenChange={setConfirmReset}
        title={copy.reset.title}
        body={copy.reset.body}
        confirmLabel={copy.reset.confirm}
        cancelLabel={copy.reset.keep}
        tone="destructive"
        onConfirm={handleReset}
      />
    </PageBody>
  )
}
