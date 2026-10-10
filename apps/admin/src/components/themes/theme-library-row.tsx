'use client'

import { Button } from '@commerce/ui/shadcn/button'
import Link from 'next/link'
import StatusChip from '@/components/layout/status-chip'
import { themeImportContent } from '@/data/theme-import'
import { themesContent } from '@/data/themes'
import { useCopy } from '@/hooks/use-copy'
import { formatWhen } from '@/lib/format-date'
import { routes } from '@/lib/routes'
import ThemeActionsMenu, { type ThemeAction } from './theme-actions-menu'
import ThemeSwatch from './theme-swatch'
import { savedLine, type ThemeItem } from './theme-types'

type ThemeLibraryRowProps = {
  theme: ThemeItem
  busy: boolean
  canPublish: boolean
  onPublish: () => void
  onAction: (action: ThemeAction) => void
}

const ACTIONS = ['duplicate', 'rename', 'download', 'delete'] as const

/**
 * One unpublished theme: its home page picture (its colours until Customize takes one), name and
 * chips, when and by whom it was saved, then Publish, Customize and the kebab.
 */
export default function ThemeLibraryRow({
  theme,
  busy,
  canPublish,
  onPublish,
  onAction,
}: ThemeLibraryRowProps) {
  // Hooks
  const importCopy = useCopy(themeImportContent)
  const copy = useCopy(themesContent.library)

  // Render logic
  return (
    <li className="flex flex-wrap items-center gap-x-4 gap-y-3 py-4">
      <span className="flex aspect-[16/10] w-24 shrink-0 overflow-hidden rounded-lg border border-border bg-muted sm:w-28">
        {theme.thumbnailUrl ? (
          // biome-ignore lint/performance/noImgElement: a small stored webp from the store's storage.
          <img
            src={theme.thumbnailUrl}
            alt={copy.thumbnail(theme.name)}
            loading="lazy"
            decoding="async"
            className="size-full object-cover object-top"
          />
        ) : (
          <ThemeSwatch theme={theme.settings} className="size-full rounded-lg border-0 p-2" />
        )}
      </span>
      <div className="flex min-w-0 flex-1 basis-48 flex-col gap-1">
        <span className="flex min-w-0 flex-wrap items-center gap-2">
          <span className="truncate text-body font-semibold text-foreground">{theme.name}</span>
          {theme.imported ? <StatusChip className="h-5 px-2">{importCopy.badge}</StatusChip> : null}
          {theme.hasDraft ? (
            <StatusChip tone="attention" className="h-5 px-2">
              <span title={copy.unsavedHelp}>{copy.unsaved}</span>
            </StatusChip>
          ) : null}
        </span>
        <span className="text-caption font-normal text-muted-foreground">
          {savedLine(copy, formatWhen(theme.updatedAt), theme.updatedBy)}
          {theme.imported ? (
            <>
              {' · '}
              <Link
                href={routes.onlineStore.themeImport(theme.id)}
                className="text-foreground underline-offset-4 hover:underline"
              >
                {importCopy.reportLink}
              </Link>
            </>
          ) : null}
        </span>
      </div>
      <div className="flex items-center gap-2">
        <ThemeActionsMenu actions={ACTIONS} disabled={busy} onAction={onAction} />
        {canPublish ? (
          <Button variant="outline" disabled={busy} onClick={onPublish}>
            {copy.publish}
          </Button>
        ) : null}
        <Button
          variant="outline"
          nativeButton={false}
          render={<Link href={routes.onlineStore.themeEditor(theme.id)} />}
        >
          {copy.customize}
        </Button>
      </div>
    </li>
  )
}
