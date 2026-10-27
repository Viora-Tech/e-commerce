'use client'

import {
  isValueSetting,
  type ShopifySetting,
  schemaText,
  settingDefaults,
} from '@commerce/core/theme-import'
import { ChevronDown } from '@commerce/ui/icons'
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@commerce/ui/shadcn/collapsible'
import { themeImportContent } from '@/data/theme-import'
import { useCopy } from '@/hooks/use-copy'
import { swatchHex } from '@/lib/imported-theme-settings'
import FieldFrame from './field-frame'
import ImportedSettingField from './imported-setting-field'

type ImportedColourSchemesProps = {
  /** The `color_scheme_group` setting: its `definition` is what every scheme sets. */
  setting: ShopifySetting
  /** `{ "scheme-1": { settings: { background: "#FFFFFF", … } } }`. */
  value: unknown
  locale: Record<string, unknown>
  onChange: (value: Record<string, unknown>) => void
}

type Scheme = { settings?: Record<string, unknown> } & Record<string, unknown>

/** How many of a scheme's colours its row shows as chips. */
const CHIPS = 4

const schemesOf = (value: unknown) =>
  (value && typeof value === 'object' ? value : {}) as Record<string, Scheme>

/** `scheme-1` → `Scheme 1`. */
const schemeName = (id: string) => id.replace(/[-_]+/g, ' ').replace(/^\w/, (c) => c.toUpperCase())

/**
 * A theme's colour schemes (Shopify's `color_scheme_group`, Dawn's "Colors"): one row per
 * scheme with its first colours as chips, opening to every colour the scheme sets.
 */
export default function ImportedColourSchemes({
  setting,
  value,
  locale,
  onChange,
}: ImportedColourSchemesProps) {
  // Hooks
  const { editor: copy } = useCopy(themeImportContent)

  // Event handlers
  const handleSet = (id: string, key: string, next: unknown) => {
    const schemes = schemesOf(value)
    const scheme = schemes[id] ?? {}
    onChange({
      ...schemes,
      [id]: { ...scheme, settings: { ...(scheme.settings ?? {}), [key]: next } },
    })
  }

  // Render logic
  const schemes = schemesOf(value)
  const definition = setting.definition ?? []
  const defaults = settingDefaults(definition)
  const label = schemaText(setting.label, locale)

  return (
    <FieldFrame label={label || copy.schemes(Object.keys(schemes).length)}>
      <div className="flex flex-col gap-2">
        {Object.entries(schemes).map(([id, scheme]) => {
          const current = { ...defaults, ...(scheme.settings ?? {}) }
          const chips = definition
            .filter((s) => s.type === 'color' && isValueSetting(s))
            .slice(0, CHIPS)
            .map((s) => swatchHex(current[s.id ?? '']))
          return (
            <Collapsible key={id} className="rounded-lg border border-border">
              <CollapsibleTrigger
                aria-label={copy.scheme(schemeName(id))}
                className="group flex h-9 w-full items-center gap-2 rounded-lg px-2.5 text-left text-xs font-medium text-foreground transition-colors duration-150 hover:bg-muted/60 focus-visible:ring-2 focus-visible:ring-ring/70 focus-visible:outline-none focus-visible:ring-inset motion-reduce:transition-none"
              >
                <span className="flex -space-x-1">
                  {chips.map((hex, i) => (
                    <span
                      // biome-ignore lint/suspicious/noArrayIndexKey: a scheme's chips are its first colours, in schema order.
                      key={i}
                      className="size-4 rounded-full border border-border"
                      style={{ backgroundColor: hex ?? 'transparent' }}
                    />
                  ))}
                </span>
                <span className="flex-1 truncate">{schemeName(id)}</span>
                <ChevronDown
                  aria-hidden
                  className="size-3.5 text-muted-foreground transition-transform group-data-[panel-open]:rotate-180"
                />
              </CollapsibleTrigger>
              <CollapsibleContent>
                <div className="flex flex-col gap-3 border-t border-border p-2.5">
                  {definition.map((s, i) => (
                    <ImportedSettingField
                      key={s.id ?? `${s.type}-${i}`}
                      setting={s}
                      value={s.id ? current[s.id] : undefined}
                      locale={locale}
                      colorSchemes={[]}
                      onChange={(next) => s.id && handleSet(id, s.id, next)}
                    />
                  ))}
                </div>
              </CollapsibleContent>
            </Collapsible>
          )
        })}
      </div>
    </FieldFrame>
  )
}
