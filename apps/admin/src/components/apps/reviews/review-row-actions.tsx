'use client'

import { CircleCheck, Eye, EyeOff, StarIcon, Trash2 } from '@commerce/ui/icons'
import { useState } from 'react'
import { toast } from 'sonner'
import ActionMenu from '@/components/layout/action-menu'
import { reviewsContent } from '@/data/reviews'
import { useCopy } from '@/hooks/use-copy'
import { api } from '@/lib/api-client'
import { routes } from '@/lib/routes'
import DeleteReviewsDialog from './delete-reviews-dialog'

type ReviewRowActionsProps = {
  id: string
  status: 'pending' | 'published' | 'hidden'
  featured: boolean
  onChanged: () => void
}

/**
 * The menu at the end of a review row. The row opens the review on click, so every event
 * the cell owns stops here; the menu and the delete dialog are portalled out of the row.
 */
export default function ReviewRowActions({
  id,
  status,
  featured,
  onChanged,
}: ReviewRowActionsProps) {
  // Hooks
  const { list: copy } = useCopy(reviewsContent)
  const [deleting, setDeleting] = useState(false)

  // Event handlers
  const handleStatus = async (next: 'published' | 'hidden') => {
    try {
      await api.reviews.setStatus({ ids: [id], status: next })
      toast.success(next === 'published' ? copy.bulk.approved(1) : copy.bulk.hidden(1))
      onChanged()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : copy.failed)
    }
  }

  const handleFeatured = async (next: boolean) => {
    try {
      await api.reviews.setFeatured({ id, featured: next })
      toast.success(next ? copy.row.featured : copy.row.unfeatured)
      onChanged()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : copy.failed)
    }
  }

  return (
    // biome-ignore lint/a11y/noStaticElementInteractions: only stops the row's own click; the controls inside are buttons.
    // biome-ignore lint/a11y/useKeyWithClickEvents: same, keyboard events stop at the trigger.
    <span className="flex items-center justify-end" onClick={(event) => event.stopPropagation()}>
      <ActionMenu
        label={copy.row.menu}
        contentClassName="w-52"
        items={[
          { label: copy.row.open, icon: Eye, href: routes.apps.page('reviews', 'reviews', id) },
          {
            label: copy.row.approve,
            icon: CircleCheck,
            hidden: status === 'published',
            onSelect: () => handleStatus('published'),
          },
          {
            label: copy.row.hide,
            icon: EyeOff,
            hidden: status === 'hidden',
            onSelect: () => handleStatus('hidden'),
          },
          {
            label: featured ? copy.row.unfeature : copy.row.feature,
            icon: StarIcon,
            onSelect: () => handleFeatured(!featured),
          },
          {
            label: copy.row.delete,
            icon: Trash2,
            destructive: true,
            onSelect: () => setDeleting(true),
          },
        ]}
      />
      <DeleteReviewsDialog
        ids={[id]}
        open={deleting}
        onOpenChange={setDeleting}
        onDeleted={onChanged}
      />
    </span>
  )
}
