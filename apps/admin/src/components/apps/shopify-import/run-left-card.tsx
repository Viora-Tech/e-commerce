import { IMPORT_RESOURCES } from '@commerce/plugin-shopify-import/client'
import DataCard from '@/components/layout/data-card'
import ScrollSection from '@/components/layout/scroll-section'
import { shopifyImportContent } from '@/data/shopify-import'
import { useCopy } from '@/hooks/use-copy'
import RunLeftGroup from './run-left-group'
import type { RunDetail } from './types'

type RunLeftCardProps = { run: RunDetail }

/**
 * What the import could not bring over (or brought over changed), grouped by
 * type and summed by reason, so the merchant sees "40 extra field values on
 * customers" once instead of forty rows in the problems list.
 */
export default function RunLeftCard({ run }: RunLeftCardProps) {
  // Hooks
  const copy = useCopy(shopifyImportContent.left)

  // Early returns
  const groups = IMPORT_RESOURCES.flatMap((resource) => {
    const left = run.progress[resource]?.left ?? []
    return left.length ? [{ resource, left }] : []
  })
  if (groups.length === 0) return null

  return (
    <DataCard title={copy.heading}>
      <div className="flex flex-col gap-4">
        <p className="text-body text-muted-foreground">{copy.intro}</p>
        <ScrollSection id="shopify-import-left" label={copy.heading} count={groups.length}>
          <ul className="flex flex-col gap-2">
            {groups.map(({ resource, left }, i) => (
              <RunLeftGroup key={resource} resource={resource} left={left} defaultOpen={i < 2} />
            ))}
          </ul>
        </ScrollSection>
      </div>
    </DataCard>
  )
}
