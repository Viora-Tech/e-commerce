'use client'

import { THEME_FONT_IDS, THEME_FONTS } from '@commerce/core/theme'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@commerce/ui/shadcn/tabs'
import { useEffect, useState } from 'react'
import { toast } from 'sonner'
import { themesContent } from '@/data/themes'
import { api } from '@/lib/api-client'
import CustomizerTopBar from './customizer-top-bar'
import ThemePresets from './theme-presets'
import ThemePreview, { type PreviewDevice } from './theme-preview'
import ThemeSettings from './theme-settings'
import type { ThemeItem } from './theme-types'

type ThemeCustomizerProps = {
  theme: ThemeItem
  storefrontOrigin: string
  canPublish: boolean
}

const copy = themesContent.editor

/**
 * Every curated face from Google Fonts, for picker samples in the admin only. The
 * storefront self-hosts the same faces through next/font.
 */
const FONT_SAMPLES = `https://fonts.googleapis.com/css2?${THEME_FONT_IDS.map(
  (id) => `family=${THEME_FONTS[id].google}`,
).join('&')}&display=swap`

/**
 * Online Store › Themes › Customize, full screen outside the admin shell: a tabbed
 * panel on the left, the storefront rendering this theme on the right. Saves go to
 * this theme only; the storefront changes when the theme is live or gets published.
 */
export default function ThemeCustomizer({
  theme,
  storefrontOrigin,
  canPublish,
}: ThemeCustomizerProps) {
  // Hooks
  const [record, setRecord] = useState(theme)
  const [draft, setDraft] = useState(theme.settings)
  const [saving, setSaving] = useState(false)
  const [publishing, setPublishing] = useState(false)
  const [device, setDevice] = useState<PreviewDevice>('desktop')
  const [modePick, setModePick] = useState<'light' | 'dark'>('light')

  useEffect(() => {
    if (JSON.stringify(draft) === JSON.stringify(record.settings)) return
    const warn = (event: BeforeUnloadEvent) => event.preventDefault()
    window.addEventListener('beforeunload', warn)
    return () => window.removeEventListener('beforeunload', warn)
  }, [draft, record.settings])

  // Event handlers
  const handleSave = async () => {
    setSaving(true)
    try {
      const next = await api.themes.update({ id: record.id, settings: draft })
      setRecord(next)
      setDraft(next.settings)
      toast.success(themesContent.saved)
    } catch {
      toast.error(themesContent.failed)
    } finally {
      setSaving(false)
    }
  }

  const handlePublish = async () => {
    setPublishing(true)
    try {
      setRecord(await api.themes.publish({ id: record.id }))
      toast.success(copy.published)
    } catch {
      toast.error(themesContent.library.failed)
    } finally {
      setPublishing(false)
    }
  }

  // Render logic
  const dirty = JSON.stringify(draft) !== JSON.stringify(record.settings)
  const mode = draft.darkMode.enabled ? modePick : 'light'

  return (
    <div className="flex h-svh flex-col bg-background">
      <link rel="stylesheet" href={FONT_SAMPLES} precedence="default" />
      <CustomizerTopBar
        name={record.name}
        live={record.role === 'main'}
        dirty={dirty}
        saving={saving}
        publishing={publishing}
        canPublish={canPublish}
        device={device}
        mode={mode}
        darkMode={draft.darkMode.enabled}
        onDevice={setDevice}
        onMode={setModePick}
        onDiscard={() => setDraft(record.settings)}
        onSave={handleSave}
        onPublish={handlePublish}
      />
      <div className="flex min-h-0 flex-1">
        <aside className="flex w-[22rem] shrink-0 flex-col border-r border-border bg-card">
          <Tabs defaultValue="settings" className="min-h-0 flex-1 gap-0">
            <TabsList aria-label={copy.panelLabel} className="m-3 w-auto">
              <TabsTrigger value="settings">{copy.tabs.settings}</TabsTrigger>
            </TabsList>
            <TabsContent value="settings" className="min-h-0 flex-1 overflow-y-auto">
              <div className="border-b border-border px-4 pb-4">
                <ThemePresets theme={draft} onChange={setDraft} />
              </div>
              <ThemeSettings theme={draft} mode={mode} onChange={setDraft} />
            </TabsContent>
          </Tabs>
        </aside>
        <main id="main" className="min-w-0 flex-1 p-3">
          <ThemePreview
            theme={draft}
            mode={mode}
            device={device}
            origin={storefrontOrigin}
            previewToken={record.previewToken}
          />
        </main>
      </div>
    </div>
  )
}
