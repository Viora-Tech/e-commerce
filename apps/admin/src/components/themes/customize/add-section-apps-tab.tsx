'use client'

import { APPS_CATEGORY } from '@commerce/blocks/puck'
import { Puzzle } from '@commerce/ui/icons'
import Link from 'next/link'
import { customizeContent } from '@/data/customize'
import { CHROME_GROUP_LABEL } from '@/lib/customize-chrome'
import { useCustomizePuck } from '@/lib/customize-puck'
import SectionCard from './section-card'

type AppsTabProps = {
  query: string
  hovered: string | null
  onHover: (type: string | null) => void
  labelOf: (type: string) => string
  onAdd: (type: string) => void
}

const copy = customizeContent.addSection

/**
 * The Add panel's Apps tab: blocks an installed app registers via
 * `storefront.blocks` (see `APPS_CATEGORY` and `buildAppBlocks` in
 * `@commerce/blocks/puck`), grouped by the app that added them. Both the list
 * and the owner names come live off the Puck config, so uninstalling an app
 * drops its blocks here without a page reload.
 */
export default function AppsTab({ query, hovered, onHover, labelOf, onAdd }: AppsTabProps) {
  // Hooks
  const appTypes = useCustomizePuck((s) => s.config.categories?.[APPS_CATEGORY]?.components ?? [])
  const owners = useCustomizePuck(
    (s) =>
      (s.config as { appBlockOwners?: Record<string, { appName: string; appIcon?: string }> })
        .appBlockOwners ?? {},
  )

  // Early returns
  const needle = query.trim().toLowerCase()
  const matched = (appTypes as string[]).filter((t) => labelOf(t).toLowerCase().includes(needle))
  if (matched.length === 0) {
    return (
      <div className="flex flex-col items-center gap-2 px-4 py-8 text-center">
        <span className="flex size-8 items-center justify-center rounded-lg bg-chart-2/14 text-chart-2">
          <Puzzle aria-hidden weight="regular" className="size-4" />
        </span>
        <p className="text-[0.8125rem] font-medium text-foreground">{copy.appsEmpty.title}</p>
        <p className="text-xs text-muted-foreground">{copy.appsEmpty.body}</p>
        <Link
          href="/apps"
          className="rounded-sm text-xs font-medium text-primary hover:underline focus-visible:ring-2 focus-visible:ring-ring/70 focus-visible:outline-none"
        >
          {copy.appsEmpty.link}
        </Link>
      </div>
    )
  }

  // Render logic
  const byApp = new Map<string, string[]>()
  for (const type of matched) {
    const app = owners[type]?.appName ?? 'Other'
    byApp.set(app, [...(byApp.get(app) ?? []), type])
  }

  return (
    <>
      {[...byApp.entries()].map(([app, types]) => (
        <div key={app} className="flex flex-col">
          <p
            className={`sticky top-0 z-10 bg-[var(--add-surface,var(--popover))] px-2 pt-3 pb-1 ${CHROME_GROUP_LABEL}`}
          >
            {app}
          </p>
          {types.map((type) => (
            <SectionCard
              key={type}
              type={type}
              label={labelOf(type)}
              description={copy.descriptions[type] ?? ''}
              appIcon={owners[type]?.appIcon}
              hovered={hovered === type}
              onHover={onHover}
              onAdd={() => onAdd(type)}
            />
          ))}
        </div>
      ))}
    </>
  )
}
