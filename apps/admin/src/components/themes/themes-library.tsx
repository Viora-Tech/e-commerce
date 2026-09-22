'use client'

import type { ThemePresetId } from '@commerce/core/theme'
import { Plus } from '@commerce/ui/icons'
import { Button } from '@commerce/ui/shadcn/button'
import { Card, CardDescription, CardHeader, CardTitle } from '@commerce/ui/shadcn/card'
import { useState } from 'react'
import { toast } from 'sonner'
import PageBody from '@/components/layout/page-body'
import PageHeader from '@/components/layout/page-header'
import { themesContent } from '@/data/themes'
import { api } from '@/lib/api-client'
import AddThemeDialog from './add-theme-dialog'
import CurrentThemeCard from './current-theme-card'
import DeleteThemeDialog from './delete-theme-dialog'
import RenameThemeDialog from './rename-theme-dialog'
import type { ThemeAction } from './theme-actions-menu'
import ThemeLibraryRow from './theme-library-row'
import type { ThemeItem } from './theme-types'

type ThemesLibraryProps = {
  initial: ThemeItem[]
  origin: string
  canPublish: boolean
}

const copy = themesContent.library

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
    <PageBody>
      <PageHeader
        title={themesContent.title}
        subtitle={copy.subtitle}
        actions={
          <Button onClick={() => setAdding(true)} disabled={busy}>
            <Plus aria-hidden />
            {copy.add}
          </Button>
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
      <Card className="gap-0 p-0">
        <CardHeader className="border-b border-border px-5 py-4">
          <CardTitle>{copy.libraryHeading}</CardTitle>
          <CardDescription>{copy.libraryBody}</CardDescription>
        </CardHeader>
        {library.length === 0 ? (
          <p className="px-5 py-6 text-body text-muted-foreground">{copy.libraryEmpty}</p>
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
