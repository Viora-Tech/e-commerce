'use client'

import { THEME_FONT_IDS, THEME_FONTS, type Theme } from '@commerce/core/theme'
import { ExternalLink, Monitor, Moon, Smartphone, Sun, Tablet } from '@commerce/ui/icons'
import { Button } from '@commerce/ui/shadcn/button'
import { ToggleGroup, ToggleGroupItem } from '@commerce/ui/shadcn/toggle-group'
import { useState } from 'react'
import { toast } from 'sonner'
import PageBody from '@/components/layout/page-body'
import PageHeader from '@/components/layout/page-header'
import SaveBar from '@/components/layout/save-bar'
import { themesContent as copy } from '@/data/themes'
import { api } from '@/lib/api-client'
import ThemePresets from './theme-presets'
import ThemePreview, { type PreviewDevice } from './theme-preview'
import ThemeSettings from './theme-settings'

type ThemeEditorProps = {
  theme: Theme
  previewToken: string
  storefrontOrigin: string
}

/**
 * Every curated face from Google Fonts, for picker samples in the admin only. The
 * storefront self-hosts the same faces through next/font.
 */
const FONT_SAMPLES = `https://fonts.googleapis.com/css2?${THEME_FONT_IDS.map(
  (id) => `family=${THEME_FONTS[id].google}`,
).join('&')}&display=swap`

const DEVICES = [
  { value: 'desktop', icon: Monitor },
  { value: 'tablet', icon: Tablet },
  { value: 'mobile', icon: Smartphone },
] as const
const MODES = [
  { value: 'light', icon: Sun },
  { value: 'dark', icon: Moon },
] as const

/** Online Store › Themes: settings on the left, the live storefront on the right. */
export default function ThemeEditor({ theme, previewToken, storefrontOrigin }: ThemeEditorProps) {
  // Hooks
  const [draft, setDraft] = useState(theme)
  const [saved, setSaved] = useState(theme)
  const [saving, setSaving] = useState(false)
  const [device, setDevice] = useState<PreviewDevice>('desktop')
  const [modePick, setModePick] = useState<'light' | 'dark'>('light')

  // Event handlers
  const handleSave = async () => {
    setSaving(true)
    try {
      const next = await api.store.updateTheme(draft)
      setDraft(next)
      setSaved(next)
      toast.success(copy.saved)
    } catch {
      toast.error(copy.failed)
    } finally {
      setSaving(false)
    }
  }

  const handleDevice = (values: unknown[]) => {
    const next = DEVICES.find((d) => d.value === values[0])
    if (next) setDevice(next.value)
  }

  const handleMode = (values: unknown[]) => {
    const next = MODES.find((m) => m.value === values[0])
    if (next) setModePick(next.value)
  }

  // Render logic
  const dirty = JSON.stringify(draft) !== JSON.stringify(saved)
  const mode = draft.darkMode.enabled ? modePick : 'light'

  return (
    <PageBody width="frame">
      <link rel="stylesheet" href={FONT_SAMPLES} precedence="default" />
      <SaveBar
        open={dirty}
        message={copy.unsaved}
        saveLabel={copy.save}
        discardLabel={copy.discard}
        onSave={handleSave}
        onDiscard={() => setDraft(saved)}
        saving={saving}
      />
      <PageHeader
        title={copy.title}
        subtitle={copy.subtitle}
        breadcrumbs={[...copy.breadcrumbs]}
        actions={
          <>
            {draft.darkMode.enabled ? (
              <ToggleGroup value={[mode]} onValueChange={handleMode} variant="outline" spacing={0}>
                {MODES.map(({ value, icon: Icon }) => (
                  <ToggleGroupItem
                    key={value}
                    value={value}
                    aria-label={copy.preview.modes[value]}
                    title={copy.preview.modes[value]}
                  >
                    <Icon aria-hidden />
                  </ToggleGroupItem>
                ))}
              </ToggleGroup>
            ) : null}
            <ToggleGroup
              value={[device]}
              onValueChange={handleDevice}
              variant="outline"
              spacing={0}
            >
              {DEVICES.map(({ value, icon: Icon }) => (
                <ToggleGroupItem
                  key={value}
                  value={value}
                  aria-label={copy.preview.devices[value]}
                  title={copy.preview.devices[value]}
                >
                  <Icon aria-hidden />
                </ToggleGroupItem>
              ))}
            </ToggleGroup>
            <Button
              variant="outline"
              nativeButton={false}
              render={<a href={storefrontOrigin} target="_blank" rel="noreferrer" />}
            >
              <ExternalLink aria-hidden />
              {copy.preview.openStore}
            </Button>
          </>
        }
      />
      <ThemePresets theme={draft} onChange={setDraft} />
      <div className="grid gap-4 lg:grid-cols-[22rem_minmax(0,1fr)]">
        <aside className="overflow-hidden rounded-lg border border-border bg-card lg:max-h-[calc(100dvh-8rem)] lg:overflow-y-auto">
          <ThemeSettings theme={draft} mode={mode} onChange={setDraft} />
        </aside>
        <div className="h-[70dvh] lg:sticky lg:top-4 lg:h-[calc(100dvh-8rem)]">
          <ThemePreview
            theme={draft}
            mode={mode}
            device={device}
            origin={storefrontOrigin}
            previewToken={previewToken}
          />
        </div>
      </div>
    </PageBody>
  )
}
