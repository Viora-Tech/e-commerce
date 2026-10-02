import { IMPORT_RESOURCES, type LeftBehind } from '@commerce/plugin-shopify-import/client'
import DataCard from '@/components/layout/data-card'
import { shopifyImportContent } from '@/data/shopify-import'
import { useCopy } from '@/hooks/use-copy'
import type { RunDetail } from './types'

type RunLeftCardProps = { run: RunDetail }

type Copy = typeof shopifyImportContent

/** One plain sentence for a reason; the owner type reads as words ("customers"). */
function sentence(copy: Copy, l: LeftBehind): string {
  const detail =
    l.reason === 'metafield_owner'
      ? (copy.left.owners[l.detail ?? ''] ?? (l.detail ?? '').toLowerCase())
      : (l.detail ?? '')
  return copy.left.reasons[l.reason](l.count, detail)
}

/**
 * What the import could not bring over (or brought over changed), grouped by
 * type and summed by reason, so the merchant sees "40 extra field values on
 * customers" once instead of forty rows in the problems list.
 */
export default function RunLeftCard({ run }: RunLeftCardProps) {
  // Hooks
  const copy = useCopy(shopifyImportContent)

  // Early returns
  const groups = IMPORT_RESOURCES.flatMap((resource) => {
    const left = run.progress[resource]?.left ?? []
    return left.length ? [{ resource, left }] : []
  })
  if (groups.length === 0) return null

  return (
    <DataCard title={copy.left.heading}>
      <div className="flex flex-col gap-4">
        <p className="text-body text-muted-foreground">{copy.left.intro}</p>
        <dl className="flex flex-col gap-3">
          {groups.map(({ resource, left }) => (
            <div
              key={resource}
              className="grid gap-1 border-t border-border pt-3 first:border-t-0 first:pt-0 sm:grid-cols-[12rem_1fr] sm:gap-4"
            >
              <dt className="font-medium text-ink-strong">{copy.resources[resource]}</dt>
              <dd>
                <ul className="flex flex-col gap-1.5 text-body text-ink-strong">
                  {left.map((l) => (
                    <li key={`${l.reason}-${l.detail ?? ''}`}>{sentence(copy, l)}</li>
                  ))}
                </ul>
              </dd>
            </div>
          ))}
        </dl>
      </div>
    </DataCard>
  )
}
