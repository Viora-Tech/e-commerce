import { Card, CardContent, CardHeader, CardTitle } from '@commerce/ui/shadcn/card'
import { abandonedDetailContent } from '@/data/abandoned-detail'
import { useCopy } from '@/hooks/use-copy'
import type { AbandonedCheckout } from './abandoned-detail-types'

type AbandonedCustomerCardProps = {
  checkout: AbandonedCheckout
}

export default function AbandonedCustomerCard({ checkout }: AbandonedCustomerCardProps) {
  // Hooks
  const copy = useCopy(abandonedDetailContent).customer

  // Render logic
  const rows = [
    { label: copy.name, value: checkout.customerName },
    { label: copy.email, value: checkout.email },
    { label: copy.phone, value: checkout.phone },
    { label: copy.source, value: checkout.source },
  ]

  return (
    <Card>
      <CardHeader>
        <CardTitle>{copy.heading}</CardTitle>
      </CardHeader>
      <CardContent>
        <dl className="flex flex-col gap-2.5 text-body">
          {rows.map((row) => (
            <div key={row.label} className="flex justify-between gap-4">
              <dt className="text-muted-foreground">{row.label}</dt>
              <dd className="min-w-0 truncate text-end text-foreground">
                {row.value || copy.none}
              </dd>
            </div>
          ))}
        </dl>
      </CardContent>
    </Card>
  )
}
