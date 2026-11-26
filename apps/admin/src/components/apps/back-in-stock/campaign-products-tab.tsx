'use client'

import { FieldError } from '@commerce/ui/shadcn/field'
import { RadioGroup, RadioGroupItem } from '@commerce/ui/shadcn/radio-group'
import { itemTabs, loadPicked } from '@/components/discounts/pick-sources'
import DataCard from '@/components/layout/data-card'
import PickedField from '@/components/pickers/picked-field'
import { backInStockContent } from '@/data/back-in-stock'
import { discountFormContent } from '@/data/discounts'
import { useCopy, useLocale } from '@/hooks/use-copy'
import type { CampaignForm, CampaignTabProps } from './campaign-types'

/**
 * Campaign › Products: where the Notify me button shows (every product, chosen collections or
 * chosen products), picked through the same Browse dialog Discounts uses, and the pre-order
 * note (a pre-order variant is always buyable, so it never shows Notify me).
 */
export default function CampaignProductsTab({ form, patch }: CampaignTabProps) {
  // Hooks
  const { campaign: copy } = useCopy(backInStockContent)
  const { value: pick } = useCopy(discountFormContent)
  const locale = useLocale()

  // Helpers
  const picker = (kind: 'products' | 'collections') => (
    <div className="pl-6">
      <PickedField
        kind={kind}
        ids={kind === 'products' ? form.productIds : form.collectionIds}
        tabs={itemTabs(pick, locale).filter((t) => t.key === kind)}
        title={kind === 'products' ? copy.pickProducts : copy.pickCollections}
        search={kind === 'products' ? pick.productSearch : pick.collectionSearch}
        labels={pick}
        loadPicked={(_, missing) => loadPicked(kind, missing, pick, locale)}
        onChange={(next) =>
          patch(kind === 'products' ? { productIds: next.ids } : { collectionIds: next.ids })
        }
      />
    </div>
  )

  const option = (value: CampaignForm['showOn'], label: string, help?: string) => (
    <label htmlFor={`bis-show-${value}`} className="flex flex-col gap-0.5 text-body">
      <span className="flex items-center gap-2">
        <RadioGroupItem id={`bis-show-${value}`} value={value} />
        {label}
      </span>
      {help ? <span className="pl-6 text-caption text-muted-foreground">{help}</span> : null}
    </label>
  )

  // Render logic
  const empty =
    (form.showOn === 'products' && form.productIds.length === 0) ||
    (form.showOn === 'collections' && form.collectionIds.length === 0)
  return (
    <>
      <DataCard title={copy.showOn} bodyClassName="flex flex-col gap-3">
        <RadioGroup
          value={form.showOn}
          onValueChange={(v) => patch({ showOn: v as CampaignForm['showOn'] })}
        >
          {option('all', copy.showAll, copy.showAllHelp)}
          {option('collections', copy.showCollections, copy.showCollectionsHelp)}
          {form.showOn === 'collections' ? picker('collections') : null}
          {option('products', copy.showProducts)}
          {form.showOn === 'products' ? picker('products') : null}
        </RadioGroup>
        {empty ? <FieldError>{copy.pickNone}</FieldError> : null}
      </DataCard>
      <DataCard title={copy.preorderCard} bodyClassName="flex flex-col gap-2">
        <p className="text-body text-muted-foreground">{copy.preorderBody}</p>
      </DataCard>
    </>
  )
}
