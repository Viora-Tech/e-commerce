'use client'

import { Input } from '@commerce/ui/shadcn/input'
import { useRouter } from 'next/navigation'
import { useState } from 'react'
import { toast } from 'sonner'
import { purchaseOrderFormContent } from '@/data/inventory'
import { useCopy } from '@/hooks/use-copy'
import { api } from '@/lib/api-client'

type LineWeightInputProps = {
  /** The saved order; null while creating, when the weight can't be saved yet. */
  purchaseOrderId: string | null
  variantId: string
  /** The product's weight per unit now, in grams. */
  grams: number | null
}

const toText = (grams: number | null) => (grams === null ? '' : String(grams))

/**
 * Weight per unit, in grams, on a purchase order line (#1054). It saves onto the product itself
 * when the field loses focus, so a packing list's weights fill products that have none and the
 * freight split by weight updates. It is not part of the order form, so it never makes the order
 * look unsaved.
 */
export default function LineWeightInput({
  purchaseOrderId,
  variantId,
  grams,
}: LineWeightInputProps) {
  // Hooks
  const { lines: copy } = useCopy(purchaseOrderFormContent)
  const router = useRouter()
  const [text, setText] = useState(() => toText(grams))
  const [savedGrams, setSavedGrams] = useState(grams)

  // Event handlers
  const handleBlur = async () => {
    if (!purchaseOrderId) return
    const trimmed = text.trim()
    const next = trimmed === '' ? null : Number(trimmed)
    if (next !== null && (!Number.isInteger(next) || next < 0)) {
      toast.error(copy.weightInvalid)
      setText(toText(savedGrams))
      return
    }
    if (next === savedGrams) return
    try {
      await api.purchaseOrders.setLineWeight({ id: purchaseOrderId, variantId, weightGrams: next })
      setSavedGrams(next)
      toast.success(copy.weightSaved)
      router.refresh()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : copy.weightFailed)
      setText(toText(savedGrams))
    }
  }

  return (
    <Input
      aria-label={copy.weight}
      title={purchaseOrderId ? copy.weightHint : copy.weightSaveFirst}
      value={text}
      inputMode="numeric"
      placeholder={copy.weightPlaceholder}
      disabled={!purchaseOrderId}
      className="text-right tabular-nums"
      onChange={(e) => setText(e.target.value)}
      onBlur={() => void handleBlur()}
    />
  )
}
