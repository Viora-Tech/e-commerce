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
import ThemeThumbnail from './theme-thumbnail'
import { previewUrl, savedLine, type ThemeItem } from './theme-types'

type CurrentThemeCardProps = {
  theme: ThemeItem
  origin: string
  /** Sections the Add panel offers our own themes; an imported theme counts its own. */
  sectionCount: number
  busy: boolean
  onAction: (action: ThemeAction) => void
}

const ACTIONS = ['duplicate', 'rename', 'versions', 'download'] as const

/**
 * The live theme (Figma "Online store / Themes", Card 309:20554): the home page picture in its
 * well, the name with Live, when and by whom it was saved, what it offers, then Preview,
 * Customize and the kebab.
 */
export default function CurrentThemeCard({
  theme,
  origin,
  sectionCount,
  busy,
  onAction,
}: CurrentThemeCardProps) {
  // Hooks
  const copy = useCopy(themesContent.library)
  const importCopy = useCopy(themeImportContent)

  // Render logic
  const saved = savedLine(copy, formatWhen(theme.updatedAt), theme.updatedBy)
  const count = theme.sectionCount ?? sectionCount

  return (
    <section className="flex flex-col gap-6 rounded-2xl border border-border surface-card px-4 py-4 md:flex-row md:px-[1.375rem] md:py-5">
      <ThemeThumbnail
        name={theme.name}
        origin={origin}
        previewToken={theme.previewToken}
        picture={theme.thumbnailUrl}
      />
      <div className="flex min-w-0 flex-1 flex-col items-start gap-2.5">
        <div className="flex min-w-0 max-w-full flex-wrap items-center gap-2.5">
          <h2 className="min-w-0 truncate font-display text-[1.375rem] leading-7 font-bold tracking-[-0.019em] text-ink-strong">
            {theme.name}
          </h2>
          <StatusChip className="h-5 px-2 font-semibold">{copy.live}</StatusChip>
          {theme.imported ? (
            <StatusChip className="h-5 px-2 font-semibold">{importCopy.badge}</StatusChip>
          ) : null}
          {theme.hasDraft ? (
            <StatusChip tone="attention" className="h-5 px-2 font-semibold">
              <span title={copy.unsavedHelp}>{copy.unsaved}</span>
            </StatusChip>
          ) : null}
        </div>
        <p className="text-body text-muted-foreground">
          {copy.current} · {saved.charAt(0).toLowerCase()}
          {saved.slice(1)}
        </p>
        <p className="text-body text-muted-foreground">
          {count > 0 ? copy.sections(count) : copy.sectionsFallback}
        </p>
        <div className="flex flex-wrap items-center gap-2.5">
          <Button
            variant="outline"
            nativeButton={false}
            render={
              <a href={previewUrl(origin, theme.previewToken)} target="_blank" rel="noreferrer" />
            }
          >
            {copy.preview}
          </Button>
          <Button
            nativeButton={false}
            render={<Link href={routes.onlineStore.themeEditor(theme.id)} />}
          >
            {copy.customize}
          </Button>
          <ThemeActionsMenu
            actions={ACTIONS}
            variant="default"
            customizeHref={routes.onlineStore.themeEditor(theme.id)}
            disabled={busy}
            onAction={onAction}
          />
          {theme.imported ? (
            <Link
              href={routes.onlineStore.themeImport(theme.id)}
              className="text-body text-muted-foreground underline-offset-4 hover:text-foreground hover:underline"
            >
              {importCopy.reportLink}
            </Link>
          ) : null}
        </div>
      </div>
    </section>
  )
}
