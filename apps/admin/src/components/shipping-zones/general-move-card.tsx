'use client'

import { Plus } from '@commerce/ui/icons'
import { Button } from '@commerce/ui/shadcn/button'
import { useRouter } from 'next/navigation'
import { useState } from 'react'
import { toast } from 'sonner'
import DataCard from '@/components/layout/data-card'
import SelectProductsDialog, {
  type PickedProducts,
} from '@/components/products/select-products-dialog'
import { shippingRatesContent } from '@/data/shipping-rates'
import { useCopy } from '@/hooks/use-copy'
import { api } from '@/lib/api-client'

type GeneralMoveCardProps = {
  canManage: boolean
  onError: (message: string) => void
}

/**
 * General's "Move products here": General holds every product not placed in another profile,
 * so it has no product list of its own. Picking products here takes them out of the custom
 * profile that holds them, and they ship at General's prices.
 */
export default function GeneralMoveCard({ canManage, onError }: GeneralMoveCardProps) {
  // Hooks
  const { profile: copy } = useCopy(shippingRatesContent)
  const router = useRouter()
  const [picking, setPicking] = useState(false)
  const [busy, setBusy] = useState(false)

  // Event handlers
  const handlePicked = async (picked: PickedProducts) => {
    const productIds = picked.map((p) => p.product.id)
    if (productIds.length === 0) return
    setBusy(true)
    try {
      const { moved } = await api.shipping.profiles.moveToGeneral({ productIds })
      toast.success(copy.moveHere.moved(moved))
      router.refresh()
    } catch (err) {
      onError(err instanceof Error ? err.message : copy.toasts.failed)
    } finally {
      setBusy(false)
    }
  }

  // Render logic
  return (
    <DataCard
      title={copy.moveHere.heading}
      subtitle={copy.moveHere.meta}
      action={
        canManage ? (
          <Button variant="outline" onClick={() => setPicking(true)} disabled={busy}>
            <Plus />
            {copy.moveHere.action}
          </Button>
        ) : null
      }
    >
      <SelectProductsDialog
        open={picking}
        onOpenChange={setPicking}
        onConfirm={(picked) => void handlePicked(picked)}
      />
    </DataCard>
  )
}
