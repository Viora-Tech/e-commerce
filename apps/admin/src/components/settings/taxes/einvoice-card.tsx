import { Badge } from '@commerce/ui/shadcn/badge'
import { Card, CardContent, CardHeader, CardTitle } from '@commerce/ui/shadcn/card'
import { taxesContent } from '@/data/taxes'

const copy = taxesContent.einvoice

/** E-invoicing (IRN) is not built; this says so plainly rather than hiding it. */
export default function EinvoiceCard() {
  return (
    <Card size="form" id="e-invoice" className="scroll-mt-6">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          {copy.heading}
          <Badge variant="secondary">{copy.badge}</Badge>
        </CardTitle>
      </CardHeader>
      <CardContent>
        <p className="text-body text-muted-foreground">{copy.body}</p>
      </CardContent>
    </Card>
  )
}
