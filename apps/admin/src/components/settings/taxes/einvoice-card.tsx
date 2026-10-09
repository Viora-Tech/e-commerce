import { Badge } from '@commerce/ui/shadcn/badge'
import SettingsCard from '@/components/settings/settings-card'
import { taxesContent } from '@/data/taxes'

const copy = taxesContent.einvoice

/** E-invoicing (IRN) is not built; this says so plainly rather than hiding it. */
export default function EinvoiceCard() {
  return (
    <SettingsCard id="e-invoice" title={copy.heading}>
      <div className="flex flex-col items-start gap-2">
        <Badge variant="secondary">{copy.badge}</Badge>
        <p className="text-body text-muted-foreground">{copy.body}</p>
      </div>
    </SettingsCard>
  )
}
