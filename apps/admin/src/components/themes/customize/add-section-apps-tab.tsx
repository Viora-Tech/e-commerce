'use client'

import { APP_BLOCK_OWNERS, APPS_CATEGORY } from '@commerce/blocks/puck'
import { Puzzle } from '@commerce/ui/icons'
import Link from 'next/link'
import { customizeContent } from '@/data/customize'
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
 * The Add panel's Apps tab: sections a future plugin SDK registers under Puck
 * config's `categories.apps` (see `APPS_CATEGORY`/`APP_BLOCK_OWNERS` in
 * `@commerce/blocks/puck`), grouped by the app that added them. Empty — and a
 * friendly empty state — until that SDK ships and an app actually registers one.
 */
export default function AppsTab({ query, hovered, onHover, labelOf, onAdd }: AppsTabProps) {
  // Hooks
  const appTypes = useCustomizePuck((s) => s.config.categories?.[APPS_CATEGORY]?.components ?? [])

  // Early returns
  const needle = query.trim().toLowerCase()
  const matched = (appTypes as string[]).filter((t) => labelOf(t).toLowerCase().includes(needle))
  if (matched.length === 0) {
    return (
      <div className="flex flex-col items-center gap-2 px-4 py-8 text-center">
        <Puzzle aria-hidden className="size-8 text-muted-foreground" />
        <p className="text-body-strong">{copy.appsEmpty.title}</p>
        <p className="text-caption text-muted-foreground">{copy.appsEmpty.body}</p>
        <Link href="/apps" className="text-caption text-primary hover:underline">
          {copy.appsEmpty.link}
        </Link>
      </div>
    )
  }

  // Render logic
  const byApp = new Map<string, string[]>()
  for (const type of matched) {
    const app = APP_BLOCK_OWNERS[type]?.appName ?? 'Other'
    byApp.set(app, [...(byApp.get(app) ?? []), type])
  }

  return (
    <>
      {[...byApp.entries()].map(([app, types]) => (
        <div key={app} className="flex flex-col">
          <p className="sticky top-0 bg-popover px-2 pt-2 pb-1 text-caption font-medium text-muted-foreground">
            {app}
          </p>
          {types.map((type, i) => (
            <SectionCard
              key={type}
              type={type}
              label={labelOf(type)}
              description={copy.descriptions[type] ?? ''}
              appIcon={APP_BLOCK_OWNERS[type]?.appIcon}
              hovered={hovered === type}
              onHover={onHover}
              onAdd={() => onAdd(type)}
              index={i}
            />
          ))}
        </div>
      ))}
    </>
  )
}
