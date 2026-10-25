'use client'

import { CheckIcon, Save } from '@commerce/ui/icons'
import { Button } from '@commerce/ui/shadcn/button'
import { productFormContent } from '@/data/product-form'
import { useCopy } from '@/hooks/use-copy'

type ProductPageActionsProps = {
  busy: boolean
  /** An already live product: the key button saves instead of publishing (Figma 283:14681). */
  live?: boolean
  onPublish: () => void
  onSaveDraft: () => void
}

/** A product's save buttons under the side column (Figma 631:7713): save to draft, and the one
 *  key button, publish (or save, once live). */
export default function ProductPageActions({
  busy,
  live = false,
  onPublish,
  onSaveDraft,
}: ProductPageActionsProps) {
  // Hooks
  const copy = useCopy(productFormContent)

  // Render logic
  return (
    <>
      <Button variant="outline" onClick={onSaveDraft} disabled={busy}>
        <Save aria-hidden="true" />
        {copy.saveDraft}
      </Button>
      <Button onClick={onPublish} loading={busy}>
        <CheckIcon aria-hidden="true" />
        {live ? copy.saveChanges : copy.publish}
      </Button>
    </>
  )
}
