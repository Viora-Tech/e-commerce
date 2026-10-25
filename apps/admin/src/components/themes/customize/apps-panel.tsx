'use client'

import { appStoreUrl } from '@commerce/config/site'
import { resolveAppEmbeds, type Theme } from '@commerce/core/theme'
import { ChevronRight, Puzzle } from '@commerce/ui/icons'
import { cn } from '@commerce/ui/lib/utils'
import { Input } from '@commerce/ui/shadcn/input'
import { Switch } from '@commerce/ui/shadcn/switch'
import { AutoField, type Field } from '@puckeditor/core'
import { useState } from 'react'
import { customizeContent } from '@/data/customize'
import { useCopy } from '@/hooks/use-copy'
import { editorAppEmbedSources } from '@/lib/customize-app-embeds'
import {
  CHROME_BODY,
  CHROME_FOCUS,
  CHROME_GROUP_LABEL,
  CHROME_LABEL,
  CHROME_META,
} from '@/lib/customize-chrome'
import { FIELD_INPUT } from '@/lib/customize-field-styles'

type AppsPanelProps = {
  /** The apps this store has installed; only their embeds are listed. */
  installed: string[]
  theme: Theme
  onChange: (next: Theme) => void
}

/** Field definitions carry their own label; the panel draws it above the control. */
type LabelledField = Field & { label?: string }

/**
 * The App embeds rail panel (Shopify's "App embeds"): every site-wide widget the installed apps
 * offer, each with a switch and, opened, its settings. Both save into `theme.appEmbeds` with the
 * other theme settings, so they ship on Save like the rest of the theme.
 */
export default function AppsPanel({ installed, theme, onChange }: AppsPanelProps) {
  // Hooks
  const copy = useCopy(customizeContent.appEmbeds)
  const [query, setQuery] = useState('')
  const [open, setOpen] = useState<string | null>(null)

  // Event handlers
  const handleSet = (type: string, enabled: boolean, settings: Record<string, unknown>) =>
    onChange({ ...theme, appEmbeds: { ...theme.appEmbeds, [type]: { enabled, settings } } })

  // Render logic
  const embeds = resolveAppEmbeds(editorAppEmbedSources(new Set(installed)), theme.appEmbeds)
  const needle = query.trim().toLowerCase()
  const matched = embeds.filter((e) =>
    `${e.embed.label} ${e.appName}`.toLowerCase().includes(needle),
  )

  // Early returns
  if (embeds.length === 0) {
    return (
      <div className="flex flex-col items-center gap-2 px-4 py-10 text-center">
        <span className="flex size-8 items-center justify-center rounded-lg bg-chart-2/14 text-chart-2">
          <Puzzle aria-hidden weight="regular" className="size-4" />
        </span>
        <p className="text-[0.8125rem] font-medium text-foreground">{copy.emptyTitle}</p>
        <p className="text-xs text-muted-foreground">{copy.emptyBody}</p>
        <a
          href={appStoreUrl()}
          target="_blank"
          rel="noopener noreferrer"
          className={cn(
            'rounded-sm text-xs font-medium text-primary hover:underline',
            CHROME_FOCUS,
          )}
        >
          {copy.browse}
        </a>
      </div>
    )
  }

  // Render logic
  return (
    <div className="flex flex-col gap-4 px-4 pb-4">
      <p className={cn(CHROME_BODY, 'text-muted-foreground')}>{copy.intro}</p>
      <Input
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder={copy.search}
        aria-label={copy.search}
        className={FIELD_INPUT}
      />
      {matched.length === 0 ? (
        <p className="py-6 text-center text-[0.8125rem] text-muted-foreground">{copy.noMatch}</p>
      ) : (
        <ul className="flex flex-col gap-2">
          {matched.map((e) => {
            const type = e.embed.type
            const expanded = open === type
            const fields = Object.entries(e.embed.fields) as [string, LabelledField][]
            return (
              <li key={type} className="rounded-xl border border-border bg-card">
                <div className="flex items-center gap-2 p-3">
                  <button
                    type="button"
                    onClick={() => setOpen(expanded ? null : type)}
                    aria-expanded={expanded}
                    aria-label={expanded ? copy.hideSettings : copy.settings}
                    className={cn(
                      'flex min-w-0 flex-1 items-center gap-2 rounded-md text-left',
                      CHROME_FOCUS,
                    )}
                  >
                    <ChevronRight
                      aria-hidden
                      className={cn(
                        'size-3.5 shrink-0 text-muted-foreground transition-transform duration-150 ease-out motion-reduce:transition-none',
                        expanded && 'rotate-90',
                      )}
                    />
                    <span className="flex min-w-0 flex-col">
                      <span className={cn(CHROME_LABEL, 'truncate text-foreground')}>
                        {e.embed.label}
                      </span>
                      <span className={cn(CHROME_META, 'truncate')}>{e.appName}</span>
                    </span>
                  </button>
                  <Switch
                    checked={e.enabled}
                    onCheckedChange={(on) => handleSet(type, on, e.props)}
                    aria-label={copy.toggle(e.embed.label)}
                  />
                </div>
                <div
                  className={cn(
                    'grid transition-[grid-template-rows] duration-200 ease-out motion-reduce:transition-none',
                    expanded ? 'grid-rows-[1fr]' : 'grid-rows-[0fr]',
                  )}
                >
                  <div inert={!expanded} className="min-h-0 overflow-hidden">
                    <div className="flex flex-col gap-3 border-t border-border p-3">
                      {e.embed.description ? (
                        <p className={cn(CHROME_BODY, 'text-muted-foreground')}>
                          {e.embed.description}
                        </p>
                      ) : null}
                      {fields.length === 0 ? (
                        <p className="text-xs text-muted-foreground">{copy.noSettings}</p>
                      ) : (
                        fields.map(([key, field]) => (
                          <div key={key} className="flex flex-col gap-1.5">
                            {field.label ? (
                              <span className={CHROME_GROUP_LABEL}>{field.label}</span>
                            ) : null}
                            <AutoField
                              field={field}
                              value={e.props[key]}
                              onChange={(value) =>
                                handleSet(type, e.enabled, { ...e.props, [key]: value })
                              }
                            />
                          </div>
                        ))
                      )}
                    </div>
                  </div>
                </div>
              </li>
            )
          })}
        </ul>
      )}
      <p className="rounded-lg bg-muted p-2.5 text-xs leading-[1.0625rem] text-muted-foreground">
        {copy.hint}
      </p>
    </div>
  )
}
