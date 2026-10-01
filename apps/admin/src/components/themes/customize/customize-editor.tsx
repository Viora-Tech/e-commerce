'use client'

import { type TemplateKind, THEME_FONT_IDS, THEME_FONTS } from '@commerce/core/theme'
import { liquidPlacement } from '@commerce/core/theme-import'
import { type Data, Puck, type PuckAction } from '@puckeditor/core'
import '@/styles/vendor-puck.css'
import '@/styles/vendor-blocks.css'
import '@/styles/vendor-editor.css'
import { useEffect, useState } from 'react'
import { toast } from 'sonner'
import { customizeContent } from '@/data/customize'
import { themesContent } from '@/data/themes'
import { api } from '@/lib/api-client'
import { prefersReducedMotion, scrollToSection } from '@/lib/customize-canvas-motion'
import { createCustomizeConfig } from '@/lib/customize-config'
import {
  type CustomizeDoc,
  composeDoc,
  FOOTER_ZONE,
  HEADER_ZONE,
  normalizeDoc,
} from '@/lib/customize-doc'
import { CUSTOMIZE_OVERRIDES } from '@/lib/customize-overrides'
import { previewMetadata } from '@/lib/customize-preview'
import { zoneItems } from '@/lib/customize-slots'
import {
  LiquidHeadContext,
  PreviewModeContext,
  ThemePreviewContext,
} from '@/lib/customize-theme-context'
import { DynamicSourceContext, scopeFor } from '@/lib/dynamic-sources'
import { useCustomizePreview } from '@/lib/use-customize-preview'
import { useLiquidTheme } from '@/lib/use-liquid-theme'
import { partsOf, useTemplateDrafts } from '@/lib/use-template-drafts'
import ThemePresets from '../theme-presets'
import type { PreviewDevice } from '../theme-preview'
import ThemeSettings from '../theme-settings'
import type { ThemeItem } from '../theme-types'
import CanvasDock from './canvas-dock'
import CreateTemplateDialog, { type AlternateKind } from './create-template-dialog'
import CustomizeHotkeys from './customize-hotkeys'
import CustomizeLayout from './customize-layout'
import CustomizeTopBar from './customize-top-bar'
import LiquidCanvasSection from './liquid-canvas-section'
import ResourcePicker from './resource-picker'
import TemplatePicker, { type TemplateRef } from './template-picker'

type CustomizeEditorProps = {
  theme: ThemeItem
  canPublish: boolean
  initial: { template: TemplateKind; suffix: string; resource: string | null }
}

type Loaded = { ref: TemplateRef; doc: CustomizeDoc; nonce: number }

const copy = customizeContent.bar

/** Curated Google Fonts for picker samples and the preview (the storefront self-hosts them). */
const FONT_SAMPLES = `https://fonts.googleapis.com/css2?${THEME_FONT_IDS.map(
  (id) => `family=${THEME_FONTS[id].google}`,
).join('&')}&display=swap`

const sameRef = (a: TemplateRef, b: TemplateRef) => a.key === b.key && a.suffix === b.suffix

/** Save's only refusal is a connected setting whose source is gone; its message names it. */
const isSourceError = (err: unknown): err is Error =>
  err instanceof Error && (err as { code?: unknown }).code === 'BAD_REQUEST'

/**
 * Every way a section gets added — a click in the Add panel, the Sections
 * tree's "Add section" popover, or a card dragged onto the canvas — ends in
 * one Puck `insert` action, so this is the one place that brings the new
 * section into view. (Selection is already handled: a click selects it
 * itself, and Puck selects a dropped one.)
 */
function revealInserted(action: PuckAction, next: { data: Data }): void {
  if (action.type !== 'insert') return
  const doc = next.data as unknown as CustomizeDoc
  const id = action.id ?? zoneItems(doc, action.destinationZone)[action.destinationIndex]?.props.id
  if (id) scrollToSection(id, prefersReducedMotion())
}

/**
 * Online Store › Themes › Customize. Puck is the engine: one document per template
 * (with the header and footer groups as root zones), so the tree, the preview,
 * the inspector and undo all share Puck's state. Edits autosave as drafts of this
 * theme; Save commits them, which for the live theme is what shoppers see.
 */

export default function CustomizeEditor({ theme, canPublish, initial }: CustomizeEditorProps) {
  // Hooks
  const [record, setRecord] = useState(theme)
  const [settings, setSettings] = useState(theme.settings)
  const [ref, setRef] = useState<TemplateRef>({ key: initial.template, suffix: initial.suffix })
  const [loaded, setLoaded] = useState<Loaded | null>(null)
  const [switching, setSwitching] = useState(false)
  const [alternates, setAlternates] = useState<{ template: string; suffix: string }[]>([])
  const [templatesDirty, setTemplatesDirty] = useState(false)
  const [saving, setSaving] = useState(false)
  const [publishing, setPublishing] = useState(false)
  const [creating, setCreating] = useState<'closed' | 'open' | 'busy'>('closed')
  const [creatingKind, setCreatingKind] = useState<AlternateKind | null>(null)
  const [device, setDevice] = useState<PreviewDevice>('desktop')
  const [modePick, setModePick] = useState<'light' | 'dark'>('light')
  const [nonce, setNonce] = useState(0)
  const [config, setConfig] = useState(() => createCustomizeConfig())
  // Bumped once the real installed-apps set replaces the empty-set config Puck
  // first mounted with — see the effect below for why this has to force a
  // Puck remount rather than rely on the `config` prop changing in place.
  const [appsVersion, setAppsVersion] = useState(0)
  const drafts = useTemplateDrafts(record.id, () => toast.error(copy.draftFailed))
  const preview = useCustomizePreview(ref.key, initial.resource)
  // An imported Shopify theme: section fields from each `{% schema %}`, its head for the canvas.
  const liquidTheme = useLiquidTheme(record.id)

  // Which apps this store has installed, for the Add panel's Apps tab and the
  // storefront-matching "app is off" placeholder for anything already placed
  // from an app since uninstalled. `<Puck>` only reads its `config` prop at
  // mount — a later `setConfig` alone does not make it re-derive
  // `categories`/`components`, so the Apps tab stayed stuck on the
  // enabled-nothing config it mounted with even after this resolved. Folding
  // `appsVersion` into the `key` below forces the one-time remount that
  // actually picks the new config up.
  useEffect(() => {
    let active = true
    api.apps.list().then((apps) => {
      if (!active) return
      setConfig(createCustomizeConfig(new Set(apps.filter((a) => a.installed).map((a) => a.id))))
      setAppsVersion((v) => v + 1)
    })
    return () => {
      active = false
    }
  }, [])

  // biome-ignore lint/correctness/useExhaustiveDependencies: `drafts` only holds refs; reloading keys on the theme, template and discard nonce.
  useEffect(() => {
    let active = true
    const get = (template: TemplateRef['key'] | 'header' | 'footer', suffix = '') =>
      api.themes.templates.get({ themeId: record.id, template, suffix })
    Promise.all([get('header'), get(ref.key, ref.suffix), get('footer')]).then(
      ([header, main, footer]) => {
        if (!active) return
        const doc = normalizeDoc(
          composeDoc({ header: header.data, main: main.data, footer: footer.data }),
          config,
        )
        drafts.prime(partsOf(ref, doc))
        setTemplatesDirty(header.draft || main.draft || footer.draft)
        setLoaded({ ref, doc, nonce })
        setSwitching(false)
      },
      () => {
        toast.error(themesContent.failed)
        setSwitching(false)
      },
    )
    api.themes.templates.list({ themeId: record.id }).then((rows) => active && setAlternates(rows))
    return () => {
      active = false
    }
  }, [record.id, ref, nonce])

  // Section edits are kept as drafts on the server, so leaving only loses a write
  // still in flight, or theme settings (which save with Save).
  // biome-ignore lint/correctness/useExhaustiveDependencies: `drafts.pending` reads a ref.
  useEffect(() => {
    const settingsDirty = JSON.stringify(settings) !== JSON.stringify(record.settings)
    const warn = (event: BeforeUnloadEvent) => {
      if (settingsDirty || drafts.pending()) event.preventDefault()
    }
    window.addEventListener('beforeunload', warn)
    return () => window.removeEventListener('beforeunload', warn)
  }, [settings, record.settings])

  // Event handlers
  const handleChange = (data: Data) => {
    if (!loaded) return
    const parts = partsOf(loaded.ref, data as unknown as CustomizeDoc)
    if (!drafts.differs(parts)) return
    setTemplatesDirty(true)
    drafts.schedule(parts)
  }

  const handleTemplate = async (next: TemplateRef) => {
    if (sameRef(next, ref)) return
    setSwitching(true)
    await drafts.flush()
    setRef(next)
  }

  const handleSave = async () => {
    setSaving(true)
    try {
      await drafts.flush()
      await api.themes.templates.commit({ themeId: record.id })
      if (JSON.stringify(settings) !== JSON.stringify(record.settings)) {
        const next = await api.themes.update({ id: record.id, settings })
        setRecord(next)
        setSettings(next.settings)
      }
      setTemplatesDirty(false)
      toast.success(copy.saved)
    } catch (err) {
      // A connected setting whose source is gone names itself (see dynamic sources).
      toast.error(isSourceError(err) ? err.message : copy.saveFailed)
    } finally {
      setSaving(false)
    }
  }

  const handleDiscard = async () => {
    setSwitching(true)
    await drafts.flush()
    await api.themes.templates.discard({ themeId: record.id })
    setSettings(record.settings)
    setTemplatesDirty(false)
    setNonce((n) => n + 1)
    toast.success(copy.discarded)
  }

  const handlePublish = async () => {
    setPublishing(true)
    try {
      setRecord(await api.themes.publish({ id: record.id }))
      toast.success(themesContent.editor.published)
    } catch {
      toast.error(themesContent.library.failed)
    } finally {
      setPublishing(false)
    }
  }

  const handleCreate = async (kind: TemplateKind, suffix: string, basedOn: string) => {
    setCreating('busy')
    try {
      await drafts.flush()
      await api.themes.templates.create({ themeId: record.id, template: kind, suffix, basedOn })
      toast.success(customizeContent.createDialog.created)
      setCreating('closed')
      setSwitching(true)
      setRef({ key: kind, suffix })
    } catch (err) {
      toast.error(err instanceof Error ? err.message : customizeContent.createDialog.failed)
      setCreating('open')
    }
  }

  // Render logic
  const settingsDirty = JSON.stringify(settings) !== JSON.stringify(record.settings)
  const mode = settings.darkMode.enabled ? modePick : 'light'
  const logo = settings.brand.logo
    ? { url: settings.brand.logo.url, width: settings.brand.logoWidth }
    : null
  const base = previewMetadata({ ...preview, logo })
  const liquidInfo = liquidTheme.info
  const groupOf = (id: unknown) => {
    const inZone = (zone: string) => (loaded?.doc.zones[zone] ?? []).some((s) => s.props.id === id)
    return inZone(HEADER_ZONE) ? 'header-group' : inZone(FOOTER_ZONE) ? 'footer-group' : 'template'
  }
  const metadata =
    liquidInfo && liquidTheme.fields
      ? {
          ...base,
          liquid: { fields: liquidTheme.fields as NonNullable<typeof base.liquid>['fields'] },
          renderers: {
            ...base.renderers,
            LiquidSection: (props: Record<string, unknown>) => {
              const type = typeof props.sectionType === 'string' ? props.sectionType : ''
              return (
                <LiquidCanvasSection
                  themeId={record.id}
                  section={liquidPlacement(props, liquidInfo.schemas[type], groupOf(props.id), 0)}
                />
              )
            },
          },
        }
      : base
  const liquidHead = liquidInfo
    ? {
        head: liquidInfo.head,
        beforeHeader: liquidInfo.beforeHeader,
        fontsHref: liquidInfo.fontsHref,
        htmlAttrs: liquidInfo.htmlAttrs,
      }
    : null
  const sourceScope = scopeFor(ref.key, preview.kind, preview.resourceId)
  // Keep showing the previously loaded template (dimmed via `switching`) while the
  // next one fetches, instead of unmounting the whole editor to a blank "Connecting" screen.
  const doc = loaded?.doc ?? null

  const topBar = (
    <CustomizeTopBar
      name={record.name}
      live={record.role === 'main'}
      dirty={templatesDirty || settingsDirty}
      saving={saving}
      publishing={publishing}
      canPublish={canPublish}
      onDiscard={handleDiscard}
      onSave={handleSave}
      onPublish={handlePublish}
      pickers={
        <>
          <TemplatePicker
            value={ref}
            alternates={alternates}
            loading={switching}
            onChange={handleTemplate}
            onCreate={(kind) => {
              setCreatingKind(kind)
              setCreating('open')
            }}
          />
          {preview.kind ? (
            <ResourcePicker
              kind={preview.kind}
              value={preview.resourceId}
              options={preview.options}
              onChange={preview.setResourceId}
            />
          ) : null}
        </>
      }
    />
  )

  const settingsPanel = (
    <>
      <div className="border-b border-border px-4 py-4">
        <ThemePresets theme={settings} onChange={setSettings} />
      </div>
      <ThemeSettings theme={settings} mode={mode} onChange={setSettings} />
    </>
  )

  return (
    <>
      <link rel="stylesheet" href={FONT_SAMPLES} precedence="default" />
      {doc ? (
        <Puck
          key={`${loaded?.ref.key}.${loaded?.ref.suffix}.${loaded?.nonce}.${appsVersion}`}
          config={config}
          data={doc as unknown as Data}
          metadata={metadata}
          onChange={handleChange}
          onAction={revealInserted}
          onPublish={handleSave}
          iframe={{ enabled: true, waitForStyles: true }}
          dnd={{ behavior: 'auto' }}
          overrides={CUSTOMIZE_OVERRIDES}
        >
          <ThemePreviewContext.Provider value={settings}>
            <LiquidHeadContext.Provider value={liquidHead}>
            <PreviewModeContext.Provider value={mode}>
              <DynamicSourceContext.Provider value={sourceScope}>
                <CustomizeHotkeys />
                <CustomizeLayout
                  topBar={topBar}
                  settings={settingsPanel}
                  dock={
                    <CanvasDock
                      device={device}
                      mode={mode}
                      darkMode={settings.darkMode.enabled}
                      onDevice={setDevice}
                      onMode={setModePick}
                    />
                  }
                  device={device}
                  loading={switching}
                />
              </DynamicSourceContext.Provider>
            </PreviewModeContext.Provider>
            </LiquidHeadContext.Provider>
          </ThemePreviewContext.Provider>
        </Puck>
      ) : (
        <div className="flex h-svh items-center justify-center bg-background text-body text-muted-foreground">
          {themesContent.preview.connecting}
        </div>
      )}
      {creating === 'closed' ? null : (
        <CreateTemplateDialog
          current={ref}
          initialKind={creatingKind}
          busy={creating === 'busy'}
          onCancel={() => {
            setCreating('closed')
            setCreatingKind(null)
          }}
          onCreate={handleCreate}
        />
      )}
    </>
  )
}
