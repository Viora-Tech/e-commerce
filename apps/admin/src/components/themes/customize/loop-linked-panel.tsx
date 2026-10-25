'use client'

import { type LoopSpec, loopKey, parseLoopSource } from '@commerce/core/dynamic-sources'
import { DynamicSource } from '@commerce/ui/icons'
import { Button } from '@commerce/ui/shadcn/button'
import { useEffect, useState } from 'react'
import { dynamicSourcesContent } from '@/data/dynamic-sources'
import { CHROME_META } from '@/lib/customize-chrome'
import { type LoopCatalog, loadLoopCatalog, loadLoopRows } from '@/lib/customize-loops'

type LoopLinkedPanelProps = {
  spec: LoopSpec
  /** Item field labels, to say what each row shows. */
  labels: Record<string, string>
  readOnly?: boolean | undefined
  onChange: () => void
  onUnlink: () => void
}

const copy = dynamicSourcesContent.loops

/** The source's name as the merchant knows it: the content type's name, or the collection's title. */
function sourceLabel(source: string, catalog: LoopCatalog | null): string {
  const parsed = parseLoopSource(source)
  if (!parsed) return copy.unknown
  if (parsed.scope === 'metaobject') {
    return catalog?.types.find((t) => t.type === parsed.type)?.name ?? parsed.type
  }
  const title = catalog?.collections.find((c) => c.handle === parsed.handle)?.title
  return copy.collectionProducts(title ?? parsed.handle)
}

/**
 * A repeatable field while it is filled from store data: where the rows come from, how many
 * there are right now, what each row shows, and Change / Unlink. The rows themselves are not
 * edited here; they change where the content lives.
 */
export default function LoopLinkedPanel({
  spec,
  labels,
  readOnly,
  onChange,
  onUnlink,
}: LoopLinkedPanelProps) {
  // Hooks
  const [catalog, setCatalog] = useState<LoopCatalog | null>(null)
  const [count, setCount] = useState<number | null>(null)

  useEffect(() => {
    let active = true
    loadLoopCatalog().then(
      (next) => active && setCatalog(next),
      () => undefined,
    )
    return () => {
      active = false
    }
  }, [])

  // biome-ignore lint/correctness/useExhaustiveDependencies: the key stands for the source and limit.
  useEffect(() => {
    let active = true
    loadLoopRows([spec]).then((rows) => active && setCount(rows[loopKey(spec)]?.length ?? 0))
    return () => {
      active = false
    }
  }, [loopKey(spec)])

  // Render logic
  const shows = Object.entries(spec.map ?? {})
    .filter(([, m]) => m.from)
    .map(([field]) => labels[field] ?? field)
    .join(', ')

  return (
    <div className="flex flex-col gap-2 rounded-lg border border-primary/30 bg-primary/5 p-3">
      <div className="flex items-start gap-2">
        <DynamicSource aria-hidden className="mt-0.5 size-4 shrink-0 text-primary" />
        <div className="flex min-w-0 flex-col">
          <span className={CHROME_META}>{copy.linked}</span>
          <span className="truncate text-[0.8125rem] font-medium text-foreground">
            {sourceLabel(spec.source, catalog)}
          </span>
          <span className="text-xs text-muted-foreground">
            {count === null ? copy.loading : count > 0 ? copy.rows(count) : copy.none}
            {shows ? ` · ${shows}` : ''}
          </span>
        </div>
      </div>
      {readOnly ? null : (
        <div className="flex flex-wrap items-center gap-2">
          <Button type="button" variant="outline" size="sm" onClick={onChange}>
            {copy.change}
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={onUnlink}
            title={copy.unlinkHelp}
          >
            {copy.unlink}
          </Button>
        </div>
      )}
    </div>
  )
}
