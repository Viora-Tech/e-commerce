'use client'

import type { ThemePackId } from '@commerce/core/theme'
import { Plus, Upload } from '@commerce/ui/icons'
import { Button } from '@commerce/ui/shadcn/button'
import Link from 'next/link'
import { useState } from 'react'
import { toast } from 'sonner'
import ConfirmDialog from '@/components/layout/confirm-dialog'
import PageHeader from '@/components/layout/page-header'
import ProoflyPageBody from '@/components/layout/proofly-page-body'
import { themesContent } from '@/data/themes'
import { useCopy } from '@/hooks/use-copy'
import { api } from '@/lib/api-client'
import { routes } from '@/lib/routes'
import AddThemeDialog, { type ThemeStart } from './add-theme-dialog'
import AddThemeMenu from './add-theme-menu'
import CurrentThemeCard from './current-theme-card'
import RenameThemeDialog from './rename-theme-dialog'
import type { ThemeAction } from './theme-actions-menu'
import ThemeLibraryRow from './theme-library-row'
import ThemePacksCard from './theme-packs-card'
import type { ThemeItem } from './theme-types'
import ThemeVersionsDialog from './theme-versions-dialog'

type ThemesLibraryProps = {
  initial: ThemeItem[]
  origin: string
  canPublish: boolean
  /** Shows the "Section packs" card below the import callout: owners and administrators. */
  canManagePacks?: boolean
}

/** Live first, then the library by last saved, as the server orders them. */
function order(themes: ThemeItem[]): ThemeItem[] {
  return [...themes].sort((a, b) => {
    if (a.role !== b.role) return a.role === 'main' ? -1 : 1
    return new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
  })
}

function download(theme: ThemeItem): void {
  const body = JSON.stringify(
    { name: theme.name, preset: theme.preset, settings: theme.settings },
    null,
    2,
  )
  const url = URL.createObjectURL(new Blob([body], { type: 'application/json' }))
  const a = document.createElement('a')
  a.href = url
  a.download = `${theme.name.toLowerCase().replace(/[^a-z0-9]+/g, '-') || 'theme'}-settings.json`
  a.click()
  URL.revokeObjectURL(url)
}

/**
 * Online Store › Themes (Figma "Online store / Themes", 682:64096): the live theme with its
 * storefront preview, the theme library, and the Shopify import callout.
 */
const deleteCopy = themesContent.deleteDialog

export default function ThemesLibrary({
  initial,
  origin,
  canPublish,
  canManagePacks = false,
}: ThemesLibraryProps) {
  // Hooks
  const [themes, setThemes] = useState(initial)
  const [busy, setBusy] = useState(false)
  /** The Add theme dialog, open on a preset or on "Start from scratch"; null when closed. */
  const [adding, setAdding] = useState<'preset' | 'blank' | null>(null)
  const { title } = useCopy(themesContent)
  const copy = useCopy(themesContent.library)
  const [renaming, setRenaming] = useState<ThemeItem | null>(null)
  const [deleting, setDeleting] = useState<ThemeItem | null>(null)
  const [versioning, setVersioning] = useState<ThemeItem | null>(null)

  // Helpers
  const run = async (work: () => Promise<void>) => {
    setBusy(true)
    try {
      await work()
    } catch (err) {
      toast.error(err instanceof Error && err.message ? err.message : copy.failed)
    } finally {
      setBusy(false)
    }
  }
  const upsert = (next: ThemeItem) =>
    setThemes((list) => order([next, ...list.filter((t) => t.id !== next.id)]))

  // Event handlers
  const handleAdd = ({ start, name }: { start: ThemeStart; name: string }) =>
    run(async () => {
      const created =
        start === 'blank'
          ? await api.themes.createBlank({ name })
          : await api.themes.create({ preset: start, name })
      upsert(created)
      setAdding(null)
      toast.success(copy.duplicated(created.name))
    })

  const handlePacks = (themeId: string, packs: ThemePackId[]) =>
    setThemes((list) => list.map((t) => (t.id === themeId ? { ...t, packs } : t)))

  const handleRename = (id: string, name: string) =>
    run(async () => {
      upsert(await api.themes.rename({ id, name }))
      setRenaming(null)
      toast.success(copy.renamed)
    })

  const handlePublish = (theme: ThemeItem) =>
    run(async () => {
      const live = await api.themes.publish({ id: theme.id })
      setThemes((list) =>
        order(list.map((t) => (t.id === live.id ? live : { ...t, role: 'unpublished' as const }))),
      )
      toast.success(copy.published(live.name))
    })

  /** A version became the theme's drafts: refresh so its "Unsaved changes" chip shows. */
  const handleRestored = () => {
    api.themes.list().then(
      (next) => setThemes(order(next)),
      () => undefined,
    )
  }

  const handleDelete = (id: string) =>
    run(async () => {
      await api.themes.delete({ id })
      setThemes((list) => list.filter((t) => t.id !== id))
      setDeleting(null)
      toast.success(copy.deleted)
    })

  const handleConfirmDelete = () => {
    if (deleting) void handleDelete(deleting.id)
  }

  const handleAction = (theme: ThemeItem, action: ThemeAction) => {
    if (action === 'rename') setRenaming(theme)
    else if (action === 'delete') setDeleting(theme)
    else if (action === 'download') download(theme)
    else if (action === 'versions') setVersioning(theme)
    else
      run(async () => {
        const copied = await api.themes.duplicate({ id: theme.id })
        upsert(copied)
        toast.success(copy.duplicated(copied.name))
      })
  }

  // Render logic
  const live = themes.find((t) => t.role === 'main')
  const library = themes.filter((t) => t.role !== 'main')

  return (
    <ProoflyPageBody>
      <PageHeader
        title={title}
        summary={copy.subtitle}
        actions={
          <AddThemeMenu
            disabled={busy}
            onAddPreset={() => setAdding('preset')}
            onStartBlank={() => setAdding('blank')}
            onDuplicateLive={live ? () => handleAction(live, 'duplicate') : undefined}
          />
        }
      />
      {live ? (
        <CurrentThemeCard
          theme={live}
          origin={origin}
          busy={busy}
          onAction={(action) => handleAction(live, action)}
        />
      ) : null}
      <section className="overflow-hidden rounded-2xl border border-border surface-card">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border px-4 py-4 md:px-5">
          <div className="flex min-w-0 flex-col gap-0.5">
            <h2 className="text-card-title">{copy.libraryHeading}</h2>
            <p className="text-[0.8125rem] leading-[1.1875rem] text-muted-foreground">
              {copy.libraryBody}
            </p>
          </div>
          <AddThemeMenu
            disabled={busy}
            onAddPreset={() => setAdding('preset')}
            onStartBlank={() => setAdding('blank')}
            onDuplicateLive={live ? () => handleAction(live, 'duplicate') : undefined}
          />
        </div>
        {library.length === 0 ? (
          <div className="flex flex-col items-center gap-2.5 py-9 text-center">
            <p className="text-[0.9375rem] leading-[1.375rem] font-semibold text-foreground">
              {copy.emptyTitle}
            </p>
            <p className="text-body text-muted-foreground">{copy.emptyBody}</p>
            <div className="flex flex-wrap justify-center gap-2.5">
              {live ? (
                <Button
                  variant="outline"
                  disabled={busy}
                  onClick={() => handleAction(live, 'duplicate')}
                >
                  {copy.duplicateCurrent}
                </Button>
              ) : null}
              <Button variant="outline" disabled={busy} onClick={() => setAdding('preset')}>
                <Plus aria-hidden />
                {copy.addFromPreset}
              </Button>
            </div>
          </div>
        ) : (
          <ul className="divide-y divide-border">
            {library.map((t) => (
              <ThemeLibraryRow
                key={t.id}
                theme={t}
                busy={busy}
                canPublish={canPublish}
                onPublish={() => handlePublish(t)}
                onAction={(action) => handleAction(t, action)}
              />
            ))}
          </ul>
        )}
      </section>
      <section className="flex flex-wrap items-center gap-4 rounded-2xl border border-border surface-card px-4 py-4 md:px-5">
        <span className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-muted text-foreground">
          <Upload aria-hidden="true" className="size-[1.125rem]" />
        </span>
        <div className="flex min-w-0 flex-1 basis-64 flex-col gap-0.5">
          <p className="text-body font-medium text-foreground">{copy.importHeading}</p>
          <p className="text-[0.8125rem] leading-[1.1875rem] text-muted-foreground">
            {copy.importBody}
          </p>
        </div>
        <Button
          variant="outline"
          nativeButton={false}
          render={<Link href={routes.onlineStore.themeImportNew()} />}
        >
          <Upload aria-hidden="true" />
          {copy.importAction}
        </Button>
      </section>
      {canManagePacks ? <ThemePacksCard themes={themes} onSaved={handlePacks} /> : null}
      <AddThemeDialog
        // Remounted per opening, so "Start from scratch" opens with the blank choice picked.
        key={adding ?? 'closed'}
        open={adding !== null}
        busy={busy}
        initialStart={adding === 'blank' ? 'blank' : undefined}
        onOpenChange={(open) => !open && setAdding(null)}
        onAdd={handleAdd}
      />
      {renaming ? (
        <RenameThemeDialog
          key={renaming.id}
          theme={renaming}
          busy={busy}
          onCancel={() => setRenaming(null)}
          onRename={handleRename}
        />
      ) : null}
      {versioning ? (
        <ThemeVersionsDialog
          key={versioning.id}
          theme={versioning}
          origin={origin}
          onClose={() => setVersioning(null)}
          onRestored={handleRestored}
        />
      ) : null}
      <ConfirmDialog
        open={deleting !== null}
        onOpenChange={(open) => !open && setDeleting(null)}
        title={deleteCopy.title(deleting?.name ?? '')}
        body={deleteCopy.body}
        confirmLabel={deleteCopy.confirm}
        cancelLabel={deleteCopy.cancel}
        onConfirm={handleConfirmDelete}
      />
    </ProoflyPageBody>
  )
}
