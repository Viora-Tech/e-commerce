'use client'

import { ExternalLink } from '@commerce/ui/icons'
import { Button } from '@commerce/ui/shadcn/button'
import { Card } from '@commerce/ui/shadcn/card'
import Link from 'next/link'
import StatusChip from '@/components/layout/status-chip'
import { themesContent } from '@/data/themes'
import { useCopy } from '@/hooks/use-copy'
import { formatWhen } from '@/lib/format-date'
import { routes } from '@/lib/routes'
import ThemeActionsMenu, { type ThemeAction } from './theme-actions-menu'
import ThemeThumbnail from './theme-thumbnail'
import { previewUrl, type ThemeItem } from './theme-types'

type CurrentThemeCardProps = {
  theme: ThemeItem
  origin: string
  busy: boolean
  onAction: (action: ThemeAction) => void
}

const ACTIONS = ['rename', 'duplicate', 'download'] as const

/** The live theme: a scaled storefront thumbnail, Preview, Customize and the kebab. */
export default function CurrentThemeCard({ theme, origin, busy, onAction }: CurrentThemeCardProps) {
  // Hooks
  const copy = useCopy(themesContent.library)

  // Render logic
  const saved = copy.lastSaved(formatWhen(theme.updatedAt))

  return (
    <Card gap="none" inset="none">
      <div className="grid gap-6 p-5 md:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)]">
        <ThemeThumbnail name={theme.name} origin={origin} previewToken={theme.previewToken} />
        <div className="flex min-w-0 flex-col gap-4">
          <div className="flex flex-col gap-2">
            <div className="flex items-center gap-2">
              <h2 className="truncate text-lg font-semibold text-ink-strong">{theme.name}</h2>
              <StatusChip>{copy.live}</StatusChip>
            </div>
            <p className="text-caption text-muted-foreground">
              {copy.current} · {saved.charAt(0).toLowerCase()}
              {saved.slice(1)}
            </p>
          </div>
          <div className="mt-auto flex flex-wrap items-center gap-2">
            <Button
              variant="outline"
              nativeButton={false}
              render={
                <a href={previewUrl(origin, theme.previewToken)} target="_blank" rel="noreferrer" />
              }
            >
              <ExternalLink aria-hidden />
              {copy.preview}
            </Button>
            <Button
              nativeButton={false}
              render={<Link href={routes.onlineStore.themeEditor(theme.id)} />}
            >
              {copy.customize}
            </Button>
            <ThemeActionsMenu actions={ACTIONS} disabled={busy} onAction={onAction} />
          </div>
        </div>
      </div>
    </Card>
  )
}
