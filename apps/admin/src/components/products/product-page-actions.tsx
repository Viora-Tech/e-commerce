'use client'

import { Plus } from '@commerce/ui/icons'
import { Button } from '@commerce/ui/shadcn/button'
import Link from 'next/link'
import { productFormContent } from '@/data/products'
import { useCopy } from '@/hooks/use-copy'
import { routes } from '@/lib/routes'

type ProductPageActionsProps = {
  busy: boolean
  onPublish: () => void
  onSaveDraft: () => void
}

/** Header actions of a product: start another, save to draft, and the one key button, publish. */
export default function ProductPageActions({
  busy,
  onPublish,
  onSaveDraft,
}: ProductPageActionsProps) {
  // Hooks
  const copy = useCopy(productFormContent)

  // Render logic
  return (
    <>
      <Button
        variant="outline"
        size="icon"
        aria-label={copy.addAnother}
        render={<Link href={routes.products.new()} />}
        nativeButton={false}
      >
        <Plus aria-hidden />
      </Button>
      <Button variant="outline" onClick={onSaveDraft} disabled={busy}>
        {copy.saveDraft}
      </Button>
      <Button onClick={onPublish} loading={busy}>
        {copy.publish}
      </Button>
    </>
  )
}
