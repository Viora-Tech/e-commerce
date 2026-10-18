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

const ACTIONS = ['duplicate', 'rename', 'versions', 'download', 'delete'] as const

/**
 * One unpublished theme (Figma "Theme row", 683:78564): its home page picture, the name with a
 * Preset or Imported tag, when and by whom it was saved, then Publish and the kebab, which holds
 * Customize and the rest.
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
    <li className="flex flex-wrap items-center gap-x-4 gap-y-3 px-4 py-4 md:px-5">
      <span className="flex aspect-[104/68] w-26 shrink-0 overflow-hidden rounded-md border border-border bg-muted">
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
          <ThemeSwatch theme={theme.settings} className="size-full rounded-md border-0 p-2" />
        )}
      </span>
      <div className="flex min-w-0 flex-1 basis-48 flex-col gap-1">
        <span className="flex min-w-0 flex-wrap items-center gap-2">
          <span className="truncate text-body font-medium text-foreground">{theme.name}</span>
          {theme.imported ? (
            <StatusChip tone="info">{importCopy.addPanel.title}</StatusChip>
          ) : (
            <StatusChip>{copy.preset}</StatusChip>
          )}
          {theme.hasDraft ? (
            <StatusChip tone="attention">
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
        {canPublish ? (
          <Button variant="outline" disabled={busy} onClick={onPublish}>
            {copy.publish}
          </Button>
        ) : null}
        <ThemeActionsMenu
          actions={ACTIONS}
          variant="plain"
          customizeHref={routes.onlineStore.themeEditor(theme.id)}
          codeHref={routes.onlineStore.themeCode(theme.id)}
          disabled={busy}
          onAction={onAction}
        />
      </div>
    </li>
  )
}
