'use client'

import {
  ArrowUpDown,
  ChevronDown,
  Columns,
  Eye,
  FieldGroup,
  FieldText,
  type IconComponent,
  LayoutGrid,
  Palette,
  Settings,
  SlidersHorizontal,
} from '@commerce/ui/icons'
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@commerce/ui/shadcn/collapsible'
import type { Field } from '@puckeditor/core'
import { customizeContent } from '@/data/customize'
import type { FieldLike } from '@/lib/customize-field-shape'
import { settingsGroupSummary } from '@/lib/customize-settings-summary'
import SettingsGroupBody from './settings-group-body'

type SectionSettingsGroupsProps = {
  field: FieldLike
  value: Record<string, unknown>
  onChange: (value: unknown) => void
  /** Heading over the groups; the section settings' own by default. */
  title?: string | undefined
  hint?: string | undefined
}

type GroupField = { label?: string; objectFields?: Record<string, Field> }

const GROUP_ICONS: Record<string, IconComponent> = {
  layout: LayoutGrid,
  spacing: ArrowUpDown,
  style: Palette,
  advanced: Settings,
  // The per-element style panel of custom-section blocks.
  size: Columns,
  typography: FieldText,
  colour: Palette,
  corners: FieldGroup,
  visibility: Eye,
}

const copy = customizeContent.settingsGroups

/**
 * The Layout / Spacing / Style / Advanced settings every section shares,
 * set apart from the section's own fields by a full-width divider and a
 * heading, each group one row with its current values summarised on the
 * right — Webflow's style panel, where a closed group still tells you what's
 * in it.
 */
export default function SectionSettingsGroups({
  field,
  value,
  onChange,
  title = copy.title,
  hint = copy.hint,
}: SectionSettingsGroupsProps) {
  // Event handlers
  const handleChange = (group: string, key: string, next: unknown) => {
    const current = (value[group] ?? {}) as Record<string, unknown>
    onChange({ ...value, [group]: { ...current, [key]: next } })
  }
  const handlePatch = (group: string, patch: Record<string, unknown>) => {
    const current = (value[group] ?? {}) as Record<string, unknown>
    onChange({ ...value, [group]: { ...current, ...patch } })
  }

  // Render logic
  const groups = Object.entries((field.objectFields ?? {}) as Record<string, GroupField>)

  return (
    <section className="-mx-4 mt-2 flex flex-col border-t border-border">
      <header className="flex flex-col gap-0.5 px-4 pt-4 pb-2">
        <h3 className="text-[0.8125rem] leading-5 font-semibold tracking-tight text-foreground">
          {title}
        </h3>
        <p className="text-[0.6875rem] leading-4 text-muted-foreground">{hint}</p>
      </header>
      <div className="flex flex-col px-2 pb-2">
        {groups.map(([key, group]) => {
          const Icon = GROUP_ICONS[key] ?? SlidersHorizontal
          const groupValue = (value[key] ?? {}) as Record<string, unknown>
          const subFields = group.objectFields ?? {}
          const summary = settingsGroupSummary(
            key,
            subFields as Parameters<typeof settingsGroupSummary>[1],
            groupValue,
          )
          return (
            <Collapsible key={key} className="rounded-lg data-[open]:bg-muted/40">
              <CollapsibleTrigger className="group flex h-8 w-full items-center gap-2 rounded-lg px-2 text-left transition-colors duration-150 hover:bg-muted/60 focus-visible:ring-2 focus-visible:ring-ring/70 focus-visible:outline-none focus-visible:ring-inset motion-reduce:transition-none">
                <span className="flex size-5 shrink-0 items-center justify-center rounded-md bg-muted text-muted-foreground group-data-[panel-open]:bg-card group-data-[panel-open]:text-foreground">
                  <Icon aria-hidden weight="regular" className="size-3.5" />
                </span>
                <span className="text-[0.8125rem] font-medium text-foreground">
                  {group.label ?? key}
                </span>
                <span className="min-w-0 flex-1 truncate text-right text-xs text-muted-foreground tabular-nums">
                  {summary}
                </span>
                <ChevronDown
                  aria-hidden
                  className="size-3.5 shrink-0 text-muted-foreground transition-transform group-data-[panel-open]:rotate-180"
                />
              </CollapsibleTrigger>
              <CollapsibleContent>
                <div className="px-2 pt-2 pb-3">
                  <SettingsGroupBody
                    group={key}
                    fields={subFields}
                    value={groupValue}
                    onChange={(subKey, next) => handleChange(key, subKey, next)}
                    onPatch={(patch) => handlePatch(key, patch)}
                  />
                </div>
              </CollapsibleContent>
            </Collapsible>
          )
        })}
      </div>
    </section>
  )
}
