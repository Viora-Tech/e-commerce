'use client'

import type { NavigationSettings } from '@commerce/core/navigation'
import { Button } from '@commerce/ui/shadcn/button'
import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@commerce/ui/shadcn/card'
import { useState } from 'react'
import { storefrontContent as copy } from '@/data/menus'
import StorefrontNavigationSheet, { type MenuOption } from './storefront-navigation-sheet'

type StorefrontNavigationSummaryProps = {
  menus: MenuOption[]
  settings: NavigationSettings
  onSaved: (settings: NavigationSettings) => void
}

/** The title for a handle, or `null` when nothing is assigned. */
function titleFor(menus: MenuOption[], handle: string | null): string | null {
  return menus.find((m) => m.handle === handle)?.title ?? null
}

export default function StorefrontNavigationSummary({
  menus,
  settings,
  onSaved,
}: StorefrontNavigationSummaryProps) {
  // Hooks
  const [editing, setEditing] = useState(false)

  // Early returns
  if (menus.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>{copy.heading}</CardTitle>
          <CardDescription>{copy.noMenus}</CardDescription>
        </CardHeader>
      </Card>
    )
  }

  // Render logic
  const headerTitle = titleFor(menus, settings.main)
  const footerTitles = settings.footer.map((handle) => titleFor(menus, handle)).filter(Boolean)

  return (
    <Card>
      <CardHeader>
        <CardTitle>{copy.heading}</CardTitle>
        <CardDescription>{copy.description}</CardDescription>
        <CardAction>
          <Button type="button" variant="outline" size="sm" onClick={() => setEditing(true)}>
            {copy.edit}
          </Button>
        </CardAction>
      </CardHeader>
      <CardContent className="flex flex-col gap-2.5 text-body">
        <div className="flex flex-col gap-0.5">
          <span className="text-caption text-muted-foreground">{copy.summaryHeaderLabel}</span>
          <span className="text-ink-strong">{headerTitle ?? copy.summaryNone}</span>
        </div>
        <div className="flex flex-col gap-0.5">
          <span className="text-caption text-muted-foreground">{copy.summaryFooterLabel}</span>
          <span className="text-ink-strong">
            {footerTitles.length > 0 ? footerTitles.join(', ') : copy.summaryNone}
          </span>
        </div>
      </CardContent>
      <StorefrontNavigationSheet
        open={editing}
        onOpenChange={setEditing}
        menus={menus}
        settings={settings}
        onSaved={onSaved}
      />
    </Card>
  )
}
