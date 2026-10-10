'use client'

import type { ThemePresetId } from '@commerce/core/theme'
import { Plus, Upload } from '@commerce/ui/icons'
import { Button } from '@commerce/ui/shadcn/button'
import { Card, CardDescription, CardHeader, CardTitle } from '@commerce/ui/shadcn/card'
import Link from 'next/link'
import { useState } from 'react'
import { toast } from 'sonner'
import PageBody from '@/components/layout/page-body'
import PageHeader from '@/components/layout/page-header'
import { themeImportContent } from '@/data/theme-import'
import { themesContent } from '@/data/themes'
import { useCopy } from '@/hooks/use-copy'
import { api } from '@/lib/api-client'
import { routes } from '@/lib/routes'
import AddThemeDialog from './add-theme-dialog'
import CurrentThemeCard from './current-theme-card'
import DeleteThemeDialog from './delete-theme-dialog'
import OnlineStoreTabs from './online-store-tabs'
import RenameThemeDialog from './rename-theme-dialog'
import type { ThemeAction } from './theme-actions-menu'
import ThemeLibraryRow from './theme-library-row'
import type { ThemeItem } from './theme-types'

type ThemesLibraryProps = {
  initial: ThemeItem[]
  origin: string
  canPublish: boolean
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

/** Online Store › Themes: the live theme up top, the theme library below, Shopify style. */
export default function ThemesLibrary({ initial, origin, canPublish }: ThemesLibraryProps) {
  // Hooks
  const [themes, setThemes] = useState(initial)
  const [busy, setBusy] = useState(false)
  const [adding, setAdding] = useState(false)
  const importCopy = useCopy(themeImportContent)
  const { title } = useCopy(themesContent)
  const copy = useCopy(themesContent.library)
  const [renaming, setRenaming] = useState<ThemeItem | null>(null)
  const [deleting, setDeleting] = useState<ThemeItem | null>(null)

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
  const handleAdd = (input: { preset: ThemePresetId; name: string }) =>
    run(async () => {
      const created = await api.themes.create(input)
      upsert(created)
      setAdding(false)
      toast.success(copy.duplicated(created.name))
    })

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

  const handleDelete = (id: string) =>
    run(async () => {
      await api.themes.delete({ id })
      setThemes((list) => list.filter((t) => t.id !== id))
      setDeleting(null)
      toast.success(copy.deleted)
    })

  const handleAction = (theme: ThemeItem, action: ThemeAction) => {
    if (action === 'rename') setRenaming(theme)
    else if (action === 'delete') setDeleting(theme)
    else if (action === 'download') download(theme)
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
    <PageBody className="max-w-[81.5rem] gap-6 md:px-8 md:py-8">
      <PageHeader
        title={title}
        subtitle={copy.subtitle}
        actions={
          <>
            <Button
              variant="outline"
              disabled={busy}
              nativeButton={false}
              render={<Link href={routes.onlineStore.themeImportNew()} />}
            >
              <Upload aria-hidden />
              {importCopy.button}
            </Button>
            <Button onClick={() => setAdding(true)} disabled={busy}>
              <Plus aria-hidden />
              {copy.add}
            </Button>
          </>
        }
      />
      <OnlineStoreTabs active="themes" />
      {live ? (
        <CurrentThemeCard
          theme={live}
          origin={origin}
          busy={busy}
          onAction={(action) => handleAction(live, action)}
        />
      ) : null}
      <Card gap="none" inset="none">
        <CardHeader className="border-b border-border px-5 py-4">
          <CardTitle>{copy.libraryHeading}</CardTitle>
          <CardDescription>{copy.libraryBody}</CardDescription>
        </CardHeader>
        {library.length === 0 ? (
          <div className="flex flex-col items-center gap-1 px-5 py-10 text-center">
            <p className="text-body font-semibold text-foreground">{copy.emptyTitle}</p>
            <p className="text-body text-muted-foreground">{copy.emptyBody}</p>
            <div className="mt-3 flex flex-wrap justify-center gap-2">
              {live ? (
                <Button
                  variant="outline"
                  disabled={busy}
                  onClick={() => handleAction(live, 'duplicate')}
                >
                  {copy.duplicateCurrent}
                </Button>
              ) : null}
              <Button variant="outline" disabled={busy} onClick={() => setAdding(true)}>
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
      </Card>
      <AddThemeDialog open={adding} busy={busy} onOpenChange={setAdding} onAdd={handleAdd} />
      {renaming ? (
        <RenameThemeDialog
          key={renaming.id}
          theme={renaming}
          busy={busy}
          onCancel={() => setRenaming(null)}
          onRename={handleRename}
        />
      ) : null}
      <DeleteThemeDialog
        theme={deleting}
        onCancel={() => setDeleting(null)}
        onConfirm={handleDelete}
      />
    </PageBody>
  )
}
