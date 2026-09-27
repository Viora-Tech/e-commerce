'use client'

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@commerce/ui/shadcn/alert-dialog'
import { productsListContent } from '@/data/products'
import { useCopy } from '@/hooks/use-copy'

type DeleteProductDialogProps = {
  product: { id: string; title: string } | null
  onCancel: () => void
  onConfirm: () => void
}

/** Guard behind the table's delete glyph; ordered products are archived, not removed. */
export default function DeleteProductDialog({
  product,
  onCancel,
  onConfirm,
}: DeleteProductDialogProps) {
  // Hooks
  const {
    bulk: { confirmDelete: copy },
  } = useCopy(productsListContent)

  // Render logic
  return (
    <AlertDialog open={product !== null} onOpenChange={(open) => !open && onCancel()}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{copy.title(1)}</AlertDialogTitle>
          <AlertDialogDescription>
            {product ? `${product.title}. ${copy.body}` : copy.body}
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>{copy.cancel}</AlertDialogCancel>
          <AlertDialogAction variant="destructive" onClick={onConfirm}>
            {copy.confirm}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}
