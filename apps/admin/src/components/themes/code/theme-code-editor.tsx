'use client'

import { NEW_FILE_KINDS_FOR } from '@commerce/core/theme-code'
import { RotateCcw } from '@commerce/ui/icons'
import { Button } from '@commerce/ui/shadcn/button'
import { useRouter } from 'next/navigation'
import { useEffect, useRef, useState } from 'react'
import { toast } from 'sonner'
import ConfirmDialog from '@/components/layout/confirm-dialog'
import { themeCodeContent } from '@/data/theme-code'
import { isDirty, useCodeBuffers } from '@/hooks/use-code-buffers'
import { useCopy } from '@/hooks/use-copy'
import { api } from '@/lib/api-client'
import { routes } from '@/lib/routes'
import {
  codeFileName,
  libraryTypeOf,
  openFileProblems,
  sectionTypeSlug,
  unpublishedNames,
} from '@/lib/theme-code'
import { previewUrl } from '../theme-types'
import CodeAddFileDialog from './code-add-file-dialog'
import CodeFileTree from './code-file-tree'
import CodeSearch from './code-search'
import CodeTabs from './code-tabs'
import CodeTopBar from './code-top-bar'
import CodeVersionPanel, { type PickedVersion } from './code-version-panel'
import CodeWorkspace from './code-workspace'

type ThemeCodeEditorProps = {
  theme: { id: string; name: string; role: string; previewToken: string }
  origin: string
  /** The member editing, for "Now" in the version list. */
  me: string
  /** A file to open first (`?file=`), e.g. from an imported section's "Open in Edit code". */
  initialFile: string | null
}

/**
 * Online store › Themes › Edit code (Figma "Theme editor · 5 · Edit code"): files on the left,
 * open files as tabs, the code with its problems, and the open file's versions on the right.
 * Saves go file by file and are checked here and on the server first.
 */
export default function ThemeCodeEditor({ theme, origin, me, initialFile }: ThemeCodeEditorProps) {
  // Hooks
  const copy = useCopy(themeCodeContent)
  const router = useRouter()
  const code = useCodeBuffers(theme.id)
  const searchRef = useRef<HTMLInputElement>(null)
  const [tabs, setTabs] = useState<string[]>([])
  const [active, setActive] = useState<string | null>(null)
  const [versionsOpen, setVersionsOpen] = useState(false)
  const [picked, setPicked] = useState<PickedVersion | null>(null)
  const [addOpen, setAddOpen] = useState(false)
  const [leaving, setLeaving] = useState(false)
  const [confirming, setConfirming] = useState<'publish' | 'discard' | null>(null)

  useEffect(() => {
    if (!code.list || tabs.length) return
    const first =
      (initialFile && code.list.files.some((f) => f.path === initialFile) ? initialFile : null) ??
      code.list.files.find((f) => f.editable && f.path.startsWith('sections/'))?.path ??
      code.list.files.find((f) => f.editable)?.path
    if (first) {
      setTabs([first])
      setActive(first)
      void code.open(first)
    }
  }, [code.list, tabs.length, initialFile, code.open])

  // Closing the tab or reloading with unsaved files asks first, as leaving with Back does.
  useEffect(() => {
    if (!Object.values(code.buffers).some(isDirty)) return
    const warn = (e: BeforeUnloadEvent) => e.preventDefault()
    window.addEventListener('beforeunload', warn)
    return () => window.removeEventListener('beforeunload', warn)
  }, [code.buffers])

  // ⌘S saves the open file, ⌘P searches files, ⌘N adds one (Figma notes 699:93894, 699:94934).
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (!(e.metaKey || e.ctrlKey) || e.shiftKey || e.altKey) return
      const key = e.key.toLowerCase()
      if (key === 's') {
        e.preventDefault()
        void handleSave()
      } else if (key === 'p') {
        e.preventDefault()
        searchRef.current?.focus()
      } else if (key === 'n' && code.list) {
        e.preventDefault()
        setAddOpen(true)
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  })

  // Event handlers
  const handleOpen = (path: string) => {
    setTabs((prev) => (prev.includes(path) ? prev : [...prev, path]))
    setActive(path)
    setPicked(null)
    if (!libraryTypeOf(path)) void code.open(path)
  }

  const handleClose = (path: string) => {
    const next = tabs.filter((t) => t !== path)
    setTabs(next)
    if (active === path) setActive(next.at(-1) ?? null)
    // An unsaved file keeps its edits until the editor closes; a clean one is dropped.
    if (!dirtyPaths.has(path)) code.close(path)
  }

  const handleSave = async () => {
    if (!active || !dirtyPaths.has(active) || activeProblems.length) return
    await code.save(active)
  }

  const handleBack = () => {
    if (dirtyPaths.size) setLeaving(true)
    else router.push(routes.onlineStore.themes())
  }

  const handleRestoreFile = () => {
    if (!active || !picked) return
    code.edit(active, picked.body)
    setPicked(null)
    toast.success(copy.history.restored)
  }

  const handleRestoreTheme = async (batchId: string) => {
    try {
      const { restored } = await api.themes.versions.restore({ themeId: theme.id, batchId })
      setPicked(null)
      await code.reloadOpen()
      toast.success(copy.history.themeRestored(restored))
    } catch (err) {
      toast.error(err instanceof Error ? err.message : copy.history.restoreFailed)
    }
  }

  const handleCreated = (path: string) => {
    void code.loadList()
    handleOpen(path)
  }

  // Early returns
  if (code.listFailed) {
    return (
      <div className="flex h-dvh flex-col items-center justify-center gap-3 bg-background">
        <p className="text-body text-muted-foreground">{copy.filesFailed}</p>
        <Button variant="outline" onClick={() => void code.loadList()}>
          <RotateCcw aria-hidden="true" />
          {copy.retry}
        </Button>
      </div>
    )
  }

  // Render logic
  const dirtyPaths = new Set(
    Object.entries(code.buffers)
      .filter(([, b]) => isDirty(b))
      .map(([p]) => p),
  )
  const activeBuffer = active ? code.buffers[active] : undefined
  const problems = openFileProblems(code.list?.kind ?? 'native', code.buffers)
  const activeProblems = active ? (problems.get(active) ?? []) : []

  const kind = code.list?.kind ?? 'native'
  const unpublished = unpublishedNames(code.list?.files ?? [])
  const publishNames = unpublished.more
    ? copy.drafts.moreFiles(unpublished.names, unpublished.more)
    : unpublished.names
  const library = Object.keys(code.list?.libraryUse ?? {}).sort()
  const realPaths = (code.list?.files ?? []).map((f) => f.path)
  const broken = new Set([...problems.entries()].filter(([, p]) => p.length).map(([path]) => path))
  const activeType = active ? libraryTypeOf(active) : null
  const tabItems = tabs.map((path) => {
    const type = libraryTypeOf(path)
    return {
      path,
      label: type ? sectionTypeSlug(type) : codeFileName(path),
      locked: type !== null,
      dirty: dirtyPaths.has(path),
    }
  })
  const tabAction =
    active && activeProblems.length ? (
      <Button size="sm" variant="secondary" disabled>
        {copy.fixToSave(activeProblems.length)}
      </Button>
    ) : active && dirtyPaths.has(active) ? (
      <Button size="sm" variant="secondary" onClick={() => void handleSave()}>
        {copy.saveShortcut}
      </Button>
    ) : null

  return (
    <div className="flex h-dvh flex-col bg-background text-foreground">
      <CodeTopBar
        themeName={theme.name}
        imported={kind === 'imported'}
        search={<CodeSearch ref={searchRef} paths={realPaths} onOpen={handleOpen} />}
        dirty={active ? dirtyPaths.has(active) : false}
        problems={activeProblems.length}
        saving={code.saving}
        canUndo={(activeBuffer?.past.length ?? 0) > 0}
        canSave={!!active && dirtyPaths.has(active) && !activeProblems.length}
        versionsOpen={versionsOpen}
        previewHref={previewUrl(origin, theme.previewToken)}
        drafts={code.list?.drafts ?? 0}
        publishing={code.publishing}
        onPublish={() => setConfirming('publish')}
        onDiscard={() => setConfirming('discard')}
        onBack={handleBack}
        onUndo={() => active && code.undo(active)}
        onVersions={() => setVersionsOpen((v) => !v)}
        onSave={() => void handleSave()}
      />
      <div className="flex min-h-0 flex-1">
        <CodeFileTree
          files={code.list?.files ?? []}
          library={kind === 'native' ? library : []}
          active={active}
          dirty={dirtyPaths}
          broken={broken}
          justPublished={code.justPublished}
          canAdd={!!code.list}
          onOpen={handleOpen}
          onAdd={() => setAddOpen(true)}
        />
        <main className="flex min-w-0 flex-1 flex-col">
          <CodeTabs
            tabs={tabItems}
            active={active}
            onSelect={handleOpen}
            onClose={handleClose}
            action={tabAction}
          />
          <CodeWorkspace
            key={active ?? 'none'}
            themeId={theme.id}
            path={active}
            libraryType={activeType}
            libraryUse={code.list?.libraryUse ?? {}}
            buffer={activeBuffer}
            loadFailed={active ? code.failed.has(active) : false}
            problems={activeProblems}
            picked={picked}
            onRetry={() => active && void code.open(active, true)}
            onEdit={(text) => active && code.edit(active, text)}
          />
        </main>
        {versionsOpen && active && !activeType ? (
          <CodeVersionPanel
            themeId={theme.id}
            path={active}
            live={theme.role === 'main'}
            me={me}
            picked={picked?.version.id ?? null}
            canRestoreTheme={kind === 'native'}
            noHistory={kind === 'native' && active.startsWith('config/')}
            onPick={setPicked}
            onRestoreFile={handleRestoreFile}
            onRestoreTheme={handleRestoreTheme}
          />
        ) : null}
      </div>
      <CodeAddFileDialog
        open={addOpen}
        themeId={theme.id}
        kinds={NEW_FILE_KINDS_FOR[kind]}
        onOpenChange={setAddOpen}
        onCreated={handleCreated}
      />
      <ConfirmDialog
        open={leaving}
        onOpenChange={setLeaving}
        title={copy.leave.title}
        body={copy.leave.body}
        confirmLabel={copy.leave.confirm}
        cancelLabel={copy.leave.cancel}
        onConfirm={() => router.push(routes.onlineStore.themes())}
      />
      <ConfirmDialog
        open={confirming !== null}
        onOpenChange={(open) => !open && setConfirming(null)}
        title={
          confirming === 'discard'
            ? copy.drafts.discardDialog.title
            : copy.drafts.publishDialog.title
        }
        body={
          confirming === 'discard'
            ? copy.drafts.discardDialog.body
            : `${copy.drafts.publishDialog.body(code.list?.drafts ?? 0)} ${copy.drafts.publishDialog.files(publishNames)}`
        }
        confirmLabel={
          confirming === 'discard'
            ? copy.drafts.discardDialog.confirm
            : copy.drafts.publishDialog.confirm
        }
        cancelLabel={
          confirming === 'discard'
            ? copy.drafts.discardDialog.cancel
            : copy.drafts.publishDialog.cancel
        }
        tone={confirming === 'discard' ? 'destructive' : 'default'}
        onConfirm={() => void (confirming === 'discard' ? code.discard() : code.publish())}
      />
    </div>
  )
}
