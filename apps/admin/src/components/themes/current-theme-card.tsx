'use client'

import { Eye, Palette } from '@commerce/ui/icons'
import { Button } from '@commerce/ui/shadcn/button'
import Link from 'next/link'
import StatusChip from '@/components/layout/status-chip'
import { themeImportContent } from '@/data/theme-import'
import { themesContent } from '@/data/themes'
import { useCopy } from '@/hooks/use-copy'
import { formatWhen } from '@/lib/format-date'
import { routes } from '@/lib/routes'
import ThemeActionsMenu, { type ThemeAction } from './theme-actions-menu'
import ThemePreviewStage from './theme-preview-stage'
import { previewUrl, savedLine, type ThemeItem } from './theme-types'

type CurrentThemeCardProps = {
  theme: ThemeItem
  origin: string
  busy: boolean
  onAction: (action: ThemeAction) => void
}

const ACTIONS = ['duplicate', 'rename', 'versions', 'download'] as const

/**
 * The live theme (Figma "Online store / Themes", Current theme 683:78385): the storefront on
 * desktop and phone across the card, then a footer bar with the name, Live and any unsaved
 * edits, when and by whom it was saved, and the kebab, Preview and Customize.
 */
export default function CurrentThemeCard({ theme, origin, busy, onAction }: CurrentThemeCardProps) {
  // Hooks
  const copy = useCopy(themesContent.library)
  const importCopy = useCopy(themeImportContent)

  // Render logic
  return (
    <section className="overflow-hidden rounded-2xl border border-border surface-card">
      <ThemePreviewStage
        name={theme.name}
        origin={origin}
        previewToken={theme.previewToken}
        picture={theme.thumbnailUrl}
      />
      <div className="flex flex-wrap items-center justify-between gap-4 px-4 py-4 md:px-6 md:py-5">
        <div className="flex min-w-0 flex-col gap-1">
          <div className="flex min-w-0 flex-wrap items-center gap-2.5">
            <h2 className="min-w-0 truncate text-[1.25rem] leading-7 font-semibold text-ink-strong">
              {theme.name}
            </h2>
            <StatusChip tone="success">{copy.live}</StatusChip>
            {theme.imported ? <StatusChip tone="info">{importCopy.badge}</StatusChip> : null}
            {theme.hasDraft ? (
              <StatusChip tone="attention">
                <span title={copy.unsavedHelp}>{copy.unsaved}</span>
              </StatusChip>
            ) : null}
          </div>
          <p className="text-body text-muted-foreground">
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
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <ThemeActionsMenu
            actions={ACTIONS}
            codeHref={routes.onlineStore.themeCode(theme.id)}
            disabled={busy}
            onAction={onAction}
          />
          <Button
            variant="outline"
            nativeButton={false}
            render={
              <a href={previewUrl(origin, theme.previewToken)} target="_blank" rel="noreferrer" />
            }
          >
            <Eye aria-hidden="true" />
            {copy.preview}
          </Button>
          <Button
            nativeButton={false}
            render={<Link href={routes.onlineStore.themeEditor(theme.id)} />}
          >
            <Palette aria-hidden="true" />
            {copy.customize}
          </Button>
        </div>
      </div>
    </section>
  )
}
