'use client'

import { ACCENT_PRESETS, DEFAULT_ACCENT } from '@commerce/core/admin-accent'
import { CheckIcon, Save } from '@commerce/ui/icons'
import { Button } from '@commerce/ui/shadcn/button'
import { Card } from '@commerce/ui/shadcn/card'
import { Skeleton } from '@commerce/ui/shadcn/skeleton'
import { useRouter } from 'next/navigation'
import { useTheme } from 'next-themes'
import { useEffect, useState } from 'react'
import { toast } from 'sonner'
import PageHeader from '@/components/layout/page-header'
import { appearanceContent } from '@/data/appearance'
import { writeAccentCookie } from '@/lib/accent-cookie'
import { api } from '@/lib/api-client'
import type { ProductLayout } from '@/lib/product-layout'
import AccentPicker from './accent-picker'
import AccentPreview from './accent-preview'
import ProductLayoutField from './product-layout-field'
import SettingsCard from './settings-card'
import SettingsDrill from './settings-drill'
import SettingsDrillPanel from './settings-drill-panel'
import ThemeModeField from './theme-mode-field'

type Loaded = Awaited<ReturnType<typeof api.appearance.get>>

const copy = appearanceContent

/** "Blue" for a preset, the hex code for anything else. */
function colourName(hex: string | null): string {
  const value = hex ?? DEFAULT_ACCENT
  const preset = ACCENT_PRESETS.find((p) => p.hex === value)
  return preset ? (copy.accent.presets[preset.id] ?? value) : value
}

/** The theme row's value: "Light", "Dark" or "System". */
function modeName(theme: string | undefined): string {
  if (theme === 'light') return copy.mode.light
  if (theme === 'dark') return copy.mode.dark
  return copy.mode.system
}

function sourceLine(loaded: Loaded): string {
  if (loaded.mine) return copy.accent.source.mine
  if (loaded.storeDefault) return copy.accent.source.store
  return copy.accent.source.default
}

type AppearanceSettingsProps = {
  /** The member's product page layout, read from the cookie on the server. Account › Appearance
   *  passes it to show that card too; Settings › Appearance leaves it out. */
  productLayout?: ProductLayout
}

/**
 * Settings › Appearance and Account › Appearance, Shopify-style (#147): rows for the theme mode,
 * the member's admin accent (with the owner's store default) and, on Account, the product page
 * layout, each opening in place (`?open=`).
 */
export default function AppearanceSettings({ productLayout }: AppearanceSettingsProps) {
  // Hooks
  const router = useRouter()
  const { theme } = useTheme()
  const [loaded, setLoaded] = useState<Loaded | null>(null)
  const [draft, setDraft] = useState(DEFAULT_ACCENT)
  const [busy, setBusy] = useState(false)
  useEffect(() => {
    api.appearance
      .get()
      .then((r) => {
        setLoaded(r)
        setDraft(r.effective ?? DEFAULT_ACCENT)
      })
      .catch(() => toast.error(copy.accent.failed))
  }, [])

  // Helpers
  /** Stores the answer, caches it for the next server render and re-renders the layout. */
  const run = async (save: () => Promise<Loaded>, done: string) => {
    setBusy(true)
    try {
      const r = await save()
      setLoaded(r)
      setDraft(r.effective ?? DEFAULT_ACCENT)
      writeAccentCookie(r.organizationId, r.effective)
      router.refresh()
      toast.success(done)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : copy.accent.failed)
    } finally {
      setBusy(false)
    }
  }

  // Event handlers
  const handleSave = () => run(() => api.appearance.setMine({ accent: draft }), copy.accent.saved)
  const handleReset = () =>
    run(() => api.appearance.setMine({ accent: null }), copy.accent.resetDone)
  const handleStoreDefault = () =>
    run(() => api.appearance.setStoreDefault({ accent: draft }), copy.store.saved)
  const handleStoreReset = () =>
    run(() => api.appearance.setStoreDefault({ accent: null }), copy.store.resetDone)

  // Early returns
  if (!loaded) {
    return (
      <div className="flex flex-col gap-6">
        <PageHeader title={copy.title} subtitle={copy.intro} />
        <Card gap={4} inset={6}>
          <Skeleton className="h-5 w-40" />
          <Skeleton className="h-9 w-full" />
          <Skeleton className="h-48 w-full" />
        </Card>
      </div>
    )
  }

  // Render logic
  const unchanged = draft === (loaded.effective ?? DEFAULT_ACCENT)
  const storeUnchanged = draft === (loaded.storeDefault ?? DEFAULT_ACCENT)
  const rows = [
    { id: 'mode', title: copy.mode.heading, value: modeName(theme) },
    {
      id: 'accent',
      title: copy.accent.heading,
      value: colourName(loaded.effective),
    },
    ...(productLayout ? [{ id: 'layout', title: copy.productLayout.heading }] : []),
  ]

  return (
    <div className="flex flex-col gap-6">
      <PageHeader title={copy.title} subtitle={copy.intro} />
      <SettingsDrill rows={rows} backLabel={copy.title}>
        <SettingsDrillPanel id="mode">
          <SettingsCard title={copy.mode.heading} description={copy.mode.body}>
            <ThemeModeField />
          </SettingsCard>
        </SettingsDrillPanel>
        <SettingsDrillPanel id="accent">
          <SettingsCard
            title={copy.accent.heading}
            description={copy.accent.body}
            bodyClassName="gap-4"
          >
            <AccentPicker value={draft} onChange={setDraft} help={sourceLine(loaded)} />
            <div className="flex flex-wrap items-center gap-2">
              <Button onClick={handleSave} disabled={busy || unchanged}>
                <Save aria-hidden="true" />
                {copy.accent.save}
              </Button>
              <Button variant="ghost" onClick={handleReset} disabled={busy || !loaded.mine}>
                {copy.accent.reset}
              </Button>
            </div>
            <p className="text-caption text-muted-foreground">{copy.accent.resetHelp}</p>
          </SettingsCard>
          <SettingsCard title={copy.preview.heading}>
            <AccentPreview accent={draft} />
          </SettingsCard>
          {loaded.canSetStoreDefault ? (
            <SettingsCard
              title={copy.store.heading}
              description={copy.store.body}
              bodyClassName="gap-4"
            >
              <p className="text-body text-foreground">
                {copy.store.current(colourName(loaded.storeDefault))}
              </p>
              <div className="flex flex-wrap items-center justify-end gap-2">
                <Button
                  variant="outline"
                  onClick={handleStoreDefault}
                  disabled={busy || storeUnchanged}
                >
                  <CheckIcon aria-hidden="true" />
                  {copy.store.apply}
                </Button>
                <Button
                  variant="ghost"
                  onClick={handleStoreReset}
                  disabled={busy || !loaded.storeDefault}
                >
                  {copy.store.reset}
                </Button>
              </div>
            </SettingsCard>
          ) : null}
        </SettingsDrillPanel>
        {productLayout ? (
          <SettingsDrillPanel id="layout">
            <SettingsCard title={copy.productLayout.heading} description={copy.productLayout.body}>
              <ProductLayoutField initial={productLayout} />
              <p className="text-caption text-muted-foreground">{copy.productLayout.help}</p>
            </SettingsCard>
          </SettingsDrillPanel>
        ) : null}
      </SettingsDrill>
    </div>
  )
}
