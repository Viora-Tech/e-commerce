'use client'

import type { TemplateKind } from '@commerce/core/theme'
import { liquidPlacement } from '@commerce/core/theme-import'
import { type Data, Puck } from '@puckeditor/core'
import '@/styles/vendor-puck.css'
import '@/styles/vendor-blocks.css'
import '@/styles/vendor-editor.css'
import { useEffect, useState } from 'react'
import { toast } from 'sonner'
import { customizeContent } from '@/data/customize'
import { themesContent } from '@/data/themes'
import { api } from '@/lib/api-client'
import { createCustomizeConfig } from '@/lib/customize-config'
import {
  type CustomizeDoc,
  composeDoc,
  FOOTER_ZONE,
  HEADER_ZONE,
  normalizeDoc,
} from '@/lib/customize-doc'
import {
  FONT_SAMPLES,
  isDesktopHome,
  isSourceError,
  LOAD_TIMEOUT_MS,
  leftoverDrafts,
  revealInserted,
  sameRef,
} from '@/lib/customize-editor'
import { CUSTOMIZE_OVERRIDES } from '@/lib/customize-overrides'
import { previewMetadata } from '@/lib/customize-preview'
import {
  LiquidHeadContext,
  LiquidThemeSettingsContext,
  PreviewModeContext,
  ThemePreviewContext,
  useThemePacks,
} from '@/lib/customize-theme-context'
import { DynamicSourceContext, scopeFor } from '@/lib/dynamic-sources'
import { routes } from '@/lib/routes'
import { useCustomizePreview } from '@/lib/use-customize-preview'
import { useImportedThemeSettings } from '@/lib/use-imported-theme-settings'
import { useLiquidTheme } from '@/lib/use-liquid-theme'
import { partsOf, useTemplateDrafts } from '@/lib/use-template-drafts'
import type { TemplateChange } from '@/lib/use-template-manager'
import { useThemeThumbnail } from '@/lib/use-theme-thumbnail'
import type { PreviewDevice } from '../theme-preview'
import { previewUrl, type ThemeItem } from '../theme-types'
import AppsPanel from './apps-panel'
import CanvasDock from './canvas-dock'
import CreateTemplateDialog, { type AlternateKind } from './create-template-dialog'
import CustomizeHotkeys from './customize-hotkeys'
import CustomizeLayout from './customize-layout'
import CustomizeTopBar from './customize-top-bar'
import EditorLoading from './editor-loading'
import EditorVersionsPanel from './editor-versions-panel'
import ImportedThemeProvider from './imported-theme-provider'
import ImportedThemeSettings from './imported-theme-settings'
import LiquidCanvasSection from './liquid-canvas-section'
import PagesPanel from './pages-panel'
import PublishThemeDialog from './publish-theme-dialog'
import ResourcePicker from './resource-picker'
import SectionRemovedToast from './section-removed-toast'
import TemplatePicker, { type TemplateRef, templateLabel } from './template-picker'
import ThemePanel from './theme-panel'

type CustomizeEditorProps = {
  theme: ThemeItem
  /** The storefront origin, for the Preview link. */
  origin: string
  canPublish: boolean
  /** Installed app ids, read on the server so Puck mounts once with the real Apps tab. */
  installedApps: string[]
  initial: { template: TemplateKind; suffix: string; resource: string | null }
  /** The store being edited: the rail's tile and the left panel's heading. */
  store: { id: string | null; name: string; domain: string; logoUrl: string | null }
  /** The signed-in member, for the top bar's avatar. */
  user: { name: string; email: string }
  /** AI is set up (the "AI connected" chip) and the assistant is on for this member (AI tab). */
  ai: { connected: boolean; assistant: boolean }
  /** The store's live theme, named in the publish confirmation; null when there is none. */
  liveName: string | null
}

type Loaded = { ref: TemplateRef; doc: CustomizeDoc; nonce: number }
const copy = customizeContent.bar

/**
 * Online Store › Themes › Customize. Puck is the engine: one document per template
 * (with the header and footer groups as root zones), so the tree, the preview,
 * the inspector and undo all share Puck's state. Edits autosave as drafts of this
 * theme; Save commits them, which for the live theme is what shoppers see.
 */
export default function CustomizeEditor({
  theme,
  origin,
  canPublish,
  installedApps,
  initial,
  store,
  user,
  ai,
  liveName,
}: CustomizeEditorProps) {
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
  const [confirmPublish, setConfirmPublish] = useState(false)
  const [versionsOpen, setVersionsOpen] = useState(false)
  const [creating, setCreating] = useState<'closed' | 'open' | 'busy'>('closed')
  const [creatingKind, setCreatingKind] = useState<AlternateKind | null>(null)
  const [device, setDevice] = useState<PreviewDevice>('desktop')
  const [modePick, setModePick] = useState<'light' | 'dark'>('light')
  const [nonce, setNonce] = useState(0)
  /** The first page could not be loaded (an error, or no answer in `LOAD_TIMEOUT_MS`). */
  const [loadFailed, setLoadFailed] = useState(false)
  const [attempt, setAttempt] = useState(0)
  // `<Puck>` only reads `config` at mount, so the installed apps (Apps tab, "app is off"
  // placeholders) and theme packs come from the server: the editor mounts once, already right.
  const themePacks = useThemePacks()
  const [config] = useState(() => createCustomizeConfig(new Set(installedApps), themePacks))
  const drafts = useTemplateDrafts(record.id, () => toast.error(copy.draftFailed))
  const preview = useCustomizePreview(ref.key, initial.resource)
  // An imported Shopify theme: section fields from each `{% schema %}`; its own Theme settings
  // (`settings_schema.json`), kept by Save, and its head for the canvas with them in place.
  const liquidTheme = useLiquidTheme(record.id)
  const importedSettings = useImportedThemeSettings(record.id, liquidTheme.info)
  // The Themes page's picture of this theme, retaken on Save of the home page.
  const thumbnail = useThemeThumbnail({
    themeId: record.id,
    picture: record.thumbnailUrl ?? null,
    onSavedHome: isDesktopHome(loaded, device) && !switching && !templatesDirty,
  })

  // biome-ignore lint/correctness/useExhaustiveDependencies: `drafts` only holds refs; reloading keys on the theme, template, discard nonce and retry.
  useEffect(() => {
    let active = true
    setLoadFailed(false)
    // Only the first load shows the loading screen; a later switch keeps the page on screen.
    const timer = window.setTimeout(() => active && setLoadFailed(true), LOAD_TIMEOUT_MS)
    const get = (template: TemplateRef['key'] | 'header' | 'footer', suffix = '') =>
      api.themes.templates.get({ themeId: record.id, template, suffix })
    Promise.all([get('header'), get(ref.key, ref.suffix), get('footer')]).then(
      ([header, main, footer]) => {
        if (!active) return
        window.clearTimeout(timer)
        const doc = normalizeDoc(
          composeDoc({ header: header.data, main: main.data, footer: footer.data }),
          config,
        )
        drafts.prime(partsOf(ref, doc))
        setTemplatesDirty(leftoverDrafts([header, main, footer], loaded === null, handleDiscard))
        setLoaded({ ref, doc, nonce })
        setSwitching(false)
      },
      () => {
        window.clearTimeout(timer)
        toast.error(themesContent.failed)
        setSwitching(false)
        if (active) setLoadFailed(true)
      },
    )
    api.themes.templates.list({ themeId: record.id }).then((rows) => active && setAlternates(rows))
    return () => {
      active = false
      window.clearTimeout(timer)
    }
  }, [record.id, ref, nonce, attempt])

  // Drafts live on the server: leaving only loses a write in flight, or unsaved theme settings.
  // biome-ignore lint/correctness/useExhaustiveDependencies: `drafts.pending` reads a ref.
  useEffect(() => {
    const settingsDirty = JSON.stringify(settings) !== JSON.stringify(record.settings)
    const warn = (event: BeforeUnloadEvent) => {
      if (settingsDirty || importedSettings.dirty || drafts.pending()) event.preventDefault()
    }
    window.addEventListener('beforeunload', warn)
    return () => window.removeEventListener('beforeunload', warn)
  }, [settings, record.settings, importedSettings.dirty])

  // Helpers
  /** Which group an imported section sits in (`section.location` in Liquid). */
  const groupOf = (id: unknown) => {
    const inZone = (zone: string) => (loaded?.doc.zones[zone] ?? []).some((s) => s.props.id === id)
    return inZone(HEADER_ZONE) ? 'header-group' : inZone(FOOTER_ZONE) ? 'footer-group' : 'template'
  }

  // Event handlers
  const handleChange = (data: Data) => {
    if (!loaded) return
    const parts = partsOf(loaded.ref, data as unknown as CustomizeDoc)
    // Comparing serialises the whole page; once there are changes, the debounced write
    // compares each row itself, so a keystroke skips it.
    if (!templatesDirty && !drafts.differs(parts)) return
    setTemplatesDirty(true)
    drafts.schedule(parts)
  }

  const handleCreateFor = (kind: AlternateKind) => {
    setCreatingKind(kind)
    setCreating('open')
  }

  const handleTemplate = async (next: TemplateRef) => {
    if (sameRef(next, ref)) return
    setSwitching(true)
    await drafts.flush()
    setRef(next)
  }

  /** Saves the drafts and theme settings; true when it worked. */
  const handleSave = async (): Promise<boolean> => {
    setSaving(true)
    try {
      await drafts.flush()
      await api.themes.templates.commit({ themeId: record.id })
      if (JSON.stringify(settings) !== JSON.stringify(record.settings)) {
        const next = await api.themes.update({ id: record.id, settings })
        setRecord(next)
        setSettings(next.settings)
      }
      await importedSettings.save()
      setTemplatesDirty(false)
      toast.success(copy.saved, {
        description: record.role === 'main' ? copy.savedLive : copy.savedDraft,
      })
      if (isDesktopHome(loaded, device)) thumbnail.refresh()
      return true
    } catch (err) {
      // A connected setting whose source is gone names itself (see dynamic sources).
      toast.error(isSourceError(err) ? err.message : copy.saveFailed, {
        action: { label: copy.retry, onClick: () => void handleSave() },
      })
      return false
    } finally {
      setSaving(false)
    }
  }

  const handleDiscard = async () => {
    setSwitching(true)
    await drafts.flush()
    await api.themes.templates.discard({ themeId: record.id })
    setSettings(record.settings)
    importedSettings.discard()
    setTemplatesDirty(false)
    setNonce((n) => n + 1)
    toast.success(copy.discarded)
  }

  /** A version became the drafts (Version history): load the page again from them. */
  const handleRestored = () => {
    setSwitching(true)
    setNonce((n) => n + 1)
  }

  /** Makes this theme the live one, saving unsaved changes first. */
  const handlePublish = async () => {
    if ((templatesDirty || settingsDirty || importedSettings.dirty) && !(await handleSave())) return
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

  /** The picker renamed, duplicated or deleted an alternate: refresh it, follow the open one. */
  const handleManaged = (change: TemplateChange) => {
    api.themes.templates.list({ themeId: record.id }).then(setAlternates, () => undefined)
    const open = ref.key === change.kind
    if (change.type === 'renamed' && open && ref.suffix === change.from) {
      setRef({ key: change.kind, suffix: change.to })
    } else if (change.type === 'deleted' && open && ref.suffix === change.suffix) {
      setSwitching(true)
      setRef({ key: change.kind, suffix: '' })
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
  const liquidHead = importedSettings.head
  const sourceScope = scopeFor(ref.key, preview.kind, preview.resourceId)
  // Keep showing the previously loaded template (dimmed via `switching`) while the
  // next one fetches, instead of unmounting the whole editor to a blank "Connecting" screen.
  const doc = loaded?.doc ?? null

  const topBar = (
    <CustomizeTopBar
      name={record.name}
      live={record.role === 'main'}
      dirty={templatesDirty || settingsDirty || importedSettings.dirty}
      saving={saving}
      publishing={publishing}
      canPublish={canPublish}
      device={device}
      previewHref={previewUrl(origin, record.previewToken)}
      codeHref={routes.onlineStore.themeCode(record.id)}
      aiConnected={ai.connected}
      user={user}
      onDevice={setDevice}
      onDiscard={handleDiscard}
      onSave={handleSave}
      onPublish={() => setConfirmPublish(true)}
      onVersions={() => setVersionsOpen(true)}
      pickers={
        <>
          <TemplatePicker
            themeId={record.id}
            value={ref}
            alternates={alternates}
            loading={switching}
            onChange={handleTemplate}
            onCreate={handleCreateFor}
            onManaged={handleManaged}
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

  const settingsPanel = liquidInfo ? (
    <ImportedThemeSettings
      themeId={record.id}
      info={liquidInfo}
      values={importedSettings.values}
      onChange={importedSettings.onChange}
    />
  ) : (
    <ThemePanel theme={settings} mode={mode} onChange={setSettings} onMode={setModePick} />
  )
  const appsPanel = <AppsPanel installed={installedApps} theme={settings} onChange={setSettings} />
  const previewResource = preview.kind
    ? {
        kind: preview.kind,
        id: preview.resourceId,
        title: preview.options.find((o) => o.id === preview.resourceId)?.title ?? null,
      }
    : null

  return (
    <>
      <link rel="stylesheet" href={FONT_SAMPLES} precedence="default" />
      {doc ? (
        <Puck
          key={`${loaded?.ref.key}.${loaded?.ref.suffix}.${loaded?.nonce}`}
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
              <LiquidThemeSettingsContext.Provider value={importedSettings.changes}>
                <ImportedThemeProvider info={liquidInfo ?? null} fields={liquidTheme.fields}>
                  <PreviewModeContext.Provider value={mode}>
                    <DynamicSourceContext.Provider value={sourceScope}>
                      <CustomizeHotkeys />
                      <SectionRemovedToast />
                      <CustomizeLayout
                        topBar={topBar}
                        settings={settingsPanel}
                        apps={appsPanel}
                        pages={
                          <PagesPanel
                            themeId={record.id}
                            value={ref}
                            alternates={alternates}
                            onPick={handleTemplate}
                            onCreate={handleCreateFor}
                            onManaged={handleManaged}
                          />
                        }
                        dock={
                          <CanvasDock
                            mode={mode}
                            darkMode={settings.darkMode.enabled}
                            onMode={setModePick}
                          />
                        }
                        device={device}
                        loading={switching}
                        store={store}
                        templateLabel={templateLabel(ref)}
                        template={ref.key}
                        previewResource={previewResource}
                        aiEnabled={ai.assistant}
                        theme={{ name: record.name, live: record.role === 'main' }}
                      />
                    </DynamicSourceContext.Provider>
                  </PreviewModeContext.Provider>
                </ImportedThemeProvider>
              </LiquidThemeSettingsContext.Provider>
            </LiquidHeadContext.Provider>
          </ThemePreviewContext.Provider>
        </Puck>
      ) : (
        <EditorLoading
          storeName={store.name || record.name}
          state={loadFailed ? 'failed' : 'loading'}
          onRetry={() => setAttempt((n) => n + 1)}
        />
      )}
      <EditorVersionsPanel
        open={versionsOpen}
        theme={record}
        origin={origin}
        me={user.name || user.email}
        onOpenChange={setVersionsOpen}
        onRestored={handleRestored}
      />
      <PublishThemeDialog
        open={confirmPublish}
        name={record.name}
        liveName={liveName}
        domain={store.domain}
        dirty={templatesDirty || settingsDirty || importedSettings.dirty}
        onOpenChange={setConfirmPublish}
        onConfirm={handlePublish}
      />
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
