import { Card, CardContent, CardHeader, CardTitle } from '@commerce/ui/shadcn/card'
import { abandonedDetailContent } from '@/data/abandoned-detail'
import { useCopy, useFormat } from '@/hooks/use-copy'
import type { AbandonedCheckout } from './abandoned-detail-types'

type AbandonedActivityCardProps = {
  checkout: AbandonedCheckout
}

export default function AbandonedActivityCard({ checkout }: AbandonedActivityCardProps) {
  // Hooks
  const content = useCopy(abandonedDetailContent)
  const fmt = useFormat()

  // Render logic
  const copy = content.activity
  const touched = new Date(checkout.updatedAt).getTime()
  const entries = [
    ...(checkout.recovered ? [{ label: copy.recovered, at: checkout.updatedAt }] : []),
    ...(checkout.recoverySentAt ? [{ label: copy.reminded, at: checkout.recoverySentAt }] : []),
    ...(touched - new Date(checkout.createdAt).getTime() > 60_000 && !checkout.recovered
      ? [{ label: copy.lastActive, at: checkout.updatedAt }]
      : []),
    { label: copy.started, at: checkout.createdAt },
  ].sort((a, b) => new Date(b.at).getTime() - new Date(a.at).getTime())

  return (
    <Card>
      <CardHeader>
        <CardTitle>{copy.heading}</CardTitle>
      </CardHeader>
      <CardContent>
        <ul className="flex flex-col divide-y divide-hairline text-body">
          {entries.map((e) => (
            <li key={e.label} className="flex justify-between gap-4 py-2 first:pt-0 last:pb-0">
              <span className="text-foreground">{e.label}</span>
              <span className="text-muted-foreground tabular-nums">{fmt.when(e.at)}</span>
            </li>
          ))}
        </ul>
      </CardContent>
    </Card>
  )
}
