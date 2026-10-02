'use client'

import { Badge } from '@commerce/ui/shadcn/badge'
import { Button } from '@commerce/ui/shadcn/button'
import Link from 'next/link'
import { themeImportContent } from '@/data/theme-import'
import { themesContent } from '@/data/themes'
import { useCopy } from '@/hooks/use-copy'
import { formatWhen } from '@/lib/format-date'
import ThemeActionsMenu, { type ThemeAction } from './theme-actions-menu'
import ThemeSwatch from './theme-swatch'
import type { ThemeItem } from './theme-types'

type ThemeLibraryRowProps = {
  theme: ThemeItem
  busy: boolean
  canPublish: boolean
  onPublish: () => void
  onAction: (action: ThemeAction) => void
}

const copy = themesContent.library
const ACTIONS = ['rename', 'duplicate', 'download', 'delete'] as const

/** One unpublished theme: swatch, name, last saved, then Publish, Customize and the kebab. */
export default function ThemeLibraryRow({
  theme,
  busy,
  canPublish,
  onPublish,
  onAction,
}: ThemeLibraryRowProps) {
  // Hooks
  const importCopy = useCopy(themeImportContent)

  // Render logic
  return (
    <li className="flex flex-wrap items-center gap-4 px-5 py-4">
      <ThemeSwatch theme={theme.settings} className="h-14 w-20 shrink-0 rounded-md" />
      <div className="flex min-w-0 flex-1 flex-col gap-0.5">
        <span className="flex min-w-0 items-center gap-2">
          <span className="truncate text-body font-semibold text-foreground">{theme.name}</span>
          {theme.imported ? <Badge variant="secondary">{importCopy.badge}</Badge> : null}
        </span>
        <span className="text-caption text-muted-foreground">
          {copy.lastSaved(formatWhen(theme.updatedAt))}
          {theme.imported ? (
            <>
              {' · '}
              <Link
                href={`/online-store/themes/${theme.id}/import`}
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
          render={<Link href={`/online-store/themes/${theme.id}/editor`} />}
        >
          {copy.customize}
        </Button>
      </div>
    </li>
  )
}
