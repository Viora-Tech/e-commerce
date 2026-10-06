'use client'

import { ExternalLink, Pencil } from '@commerce/ui/icons'
import { Badge } from '@commerce/ui/shadcn/badge'
import { Button } from '@commerce/ui/shadcn/button'
import { Card } from '@commerce/ui/shadcn/card'
import Link from 'next/link'
import { themesContent } from '@/data/themes'
import { formatWhen } from '@/lib/format-date'
import ThemeActionsMenu, { type ThemeAction } from './theme-actions-menu'
import ThemeThumbnail from './theme-thumbnail'
import { previewUrl, type ThemeItem } from './theme-types'

type CurrentThemeCardProps = {
  theme: ThemeItem
  origin: string
  busy: boolean
  onAction: (action: ThemeAction) => void
}

const copy = themesContent.library
const ACTIONS = ['rename', 'duplicate', 'download'] as const

/** The live theme: a scaled storefront thumbnail, Customize, Preview and the kebab. */
export default function CurrentThemeCard({ theme, origin, busy, onAction }: CurrentThemeCardProps) {
  // Render logic
  return (
    <Card gap="none" inset="none">
      <div className="grid gap-5 p-5 md:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)]">
        <ThemeThumbnail name={theme.name} origin={origin} previewToken={theme.previewToken} />
        <div className="flex min-w-0 flex-col gap-4">
          <div className="flex flex-col gap-1">
            <span className="text-caption text-muted-foreground">{copy.current}</span>
            <div className="flex items-center gap-2">
              <h2 className="truncate text-lg font-semibold text-foreground">{theme.name}</h2>
              <Badge variant="success">{copy.live}</Badge>
            </div>
            <p className="text-caption text-muted-foreground">
              {copy.lastSaved(formatWhen(theme.updatedAt))}
            </p>
          </div>
          <div className="mt-auto flex flex-wrap items-center gap-2">
            <ThemeActionsMenu actions={ACTIONS} disabled={busy} onAction={onAction} />
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
              render={<Link href={`/online-store/themes/${theme.id}/editor`} />}
            >
              <Pencil aria-hidden />
              {copy.customize}
            </Button>
          </div>
        </div>
      </div>
    </Card>
  )
}
