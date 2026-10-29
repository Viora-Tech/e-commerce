import type { PlatformIntegration } from '@commerce/core'
import StatusChip from '@/components/layout/status-chip'
import { platformContent } from '@/data/platform'
import { getCopy } from '@/lib/copy-server'

type IntegrationListProps = {
  label: string
  items: PlatformIntegration[]
}

/** One integration group on the console's store page: each provider on, set up but off, or off. */
export default async function IntegrationList({ label, items }: IntegrationListProps) {
  const copy = await getCopy(platformContent)
  // Render logic
  const t = copy.store

  return (
    <div className="flex flex-col gap-2">
      <span className="text-eyebrow text-muted-foreground">{label}</span>
      {items.length === 0 ? (
        <span className="text-body text-muted-foreground">{t.none}</span>
      ) : (
        <div className="flex flex-wrap gap-1.5">
          {items.map((i) => (
            <StatusChip
              key={i.id}
              tone={i.enabled ? 'success' : i.configured ? 'attention' : 'neutral'}
            >
              {i.id} · {i.enabled ? t.on : i.configured ? t.savedOff : t.off}
            </StatusChip>
          ))}
        </div>
      )}
    </div>
  )
}
