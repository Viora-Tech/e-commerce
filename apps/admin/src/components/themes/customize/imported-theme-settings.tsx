'use client'

import { themeSettingsGroups } from '@commerce/core/theme-import'
import {
  BadgePercent,
  Braces,
  ChevronRight,
  FieldText,
  Globe,
  type IconComponent,
  Images,
  LayoutGrid,
  Package,
  Palette,
  Search,
  Settings,
  ShoppingCart,
  SocialMedia,
} from '@commerce/ui/icons'
import Link from 'next/link'
import { useState } from 'react'
import { customizeContent } from '@/data/customize'
import { themeImportContent } from '@/data/theme-import'
import { useCopy } from '@/hooks/use-copy'
import { CHROME_FOCUS } from '@/lib/customize-chrome'
import {
  type ImportedGroupIcon,
  importedGroupIcon,
  importedGroupSummary,
} from '@/lib/imported-theme-settings'
import { routes } from '@/lib/routes'
import type { LiquidEditorInfo } from '@/lib/use-liquid-theme'
import ImportedSettingsGroup from './imported-settings-group'
import PanelTitle from './panel-title'

type ImportedThemeSettingsProps = {
  themeId: string
  /** The theme's schemas and labels (`themes.import.editor`). */
  info: LiquidEditorInfo
  /** Saved values with unsaved edits over them, by setting id. */
  values: Record<string, unknown>
  onChange: (values: Record<string, unknown>) => void
}

const ICONS: Record<ImportedGroupIcon, IconComponent> = {
  brand: Globe,
  colours: Palette,
  typography: FieldText,
  layout: LayoutGrid,
  cart: ShoppingCart,
  social: SocialMedia,
  search: Search,
  products: Package,
  media: Images,
  code: Braces,
  prices: BadgePercent,
  other: Settings,
}

const ROW = `flex w-full items-center gap-3 rounded-lg px-2 py-2 text-left transition-colors hover:bg-muted/60 ${CHROME_FOCUS}`
const ROW_TITLE = 'truncate text-[0.8125rem] leading-[1.1875rem] font-medium text-foreground'
const ROW_SUMMARY = 'truncate text-xs leading-[1.0625rem] text-muted-foreground'

/**
 * The Theme settings panel for a theme imported from Shopify, Shopify style: one row per group
 * of the theme's own `settings_schema.json` (Logo, Colors, Typography, Cart…) with what it is
 * set to now; a row opens its settings in place. Edits preview on the canvas and are kept by
 * the top bar's Save, with the page's other changes.
 */
export default function ImportedThemeSettings({
  themeId,
  info,
  values,
  onChange,
}: ImportedThemeSettingsProps) {
  // Hooks
  const { editor: copy } = useCopy(themeImportContent)
  const panels = useCopy(customizeContent.panels)
  const rows = useCopy(customizeContent.themePanel)
  const [open, setOpen] = useState<string | null>(null)

  // Early returns
  const groups = themeSettingsGroups(info.settingsSchema, info.schemaLocale)
  const group = groups.find((g) => g.key === open)
  if (group) {
    return (
      <ImportedSettingsGroup
        group={group}
        values={values}
        locale={info.schemaLocale}
        colorSchemes={info.colorSchemes}
        onChange={onChange}
        onBack={() => setOpen(null)}
      />
    )
  }

  // Render logic
  const summaryCopy = { empty: copy.summaryEmpty, schemes: copy.schemes }

  return (
    <>
      <PanelTitle title={panels.theme} />
      <div className="-mt-3 flex flex-col gap-4 px-4 pb-4">
        <p className="text-xs leading-[1.0625rem] text-muted-foreground">
          {groups.length ? copy.settingsIntro : copy.noSettings}
        </p>
        {groups.length ? (
          <ul className="-mx-2 flex flex-col border-t border-border pt-2">
            {groups.map((g) => {
              const Icon = ICONS[importedGroupIcon(g.name)]
              return (
                <li key={g.key}>
                  <button
                    type="button"
                    onClick={() => setOpen(g.key)}
                    aria-label={rows.open(g.name)}
                    className={ROW}
                  >
                    <Icon aria-hidden className="size-4 shrink-0 text-muted-foreground" />
                    <span className="flex min-w-0 flex-1 flex-col">
                      <span className={ROW_TITLE}>{g.name}</span>
                      <span className={ROW_SUMMARY}>
                        {importedGroupSummary(g, values, info.schemaLocale, summaryCopy)}
                      </span>
                    </span>
                    <ChevronRight aria-hidden className="size-3.5 shrink-0 text-muted-foreground" />
                  </button>
                </li>
              )
            })}
          </ul>
        ) : null}
        <Link
          href={routes.onlineStore.themeImport(themeId)}
          className={`self-start text-xs leading-[1.0625rem] text-muted-foreground underline underline-offset-4 hover:text-foreground ${CHROME_FOCUS}`}
        >
          {copy.report}
        </Link>
      </div>
    </>
  )
}
