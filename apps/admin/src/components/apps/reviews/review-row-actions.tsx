'use client'

import { CircleCheck, Eye, EyeOff, MoreHorizontal, Trash2 } from '@commerce/ui/icons'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@commerce/ui/shadcn/dropdown-menu'
import Link from 'next/link'
import { useState } from 'react'
import { toast } from 'sonner'
import { reviewsContent } from '@/data/reviews'
import { useCopy } from '@/hooks/use-copy'
import { api } from '@/lib/api-client'
import DeleteReviewsDialog from './delete-reviews-dialog'

type ReviewRowActionsProps = {
  id: string
  status: 'pending' | 'published' | 'hidden'
  onChanged: () => void
}

const KEBAB =
  'flex size-7 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring'

/**
 * The menu at the end of a review row. The row opens the review on click, so every event
 * the cell owns stops here; the menu and the delete dialog are portalled out of the row.
 */
export default function ReviewRowActions({ id, status, onChanged }: ReviewRowActionsProps) {
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

  return (
    // biome-ignore lint/a11y/noStaticElementInteractions: only stops the row's own click; the controls inside are buttons.
    // biome-ignore lint/a11y/useKeyWithClickEvents: same, keyboard events stop at the trigger.
    <span className="flex items-center justify-end" onClick={(event) => event.stopPropagation()}>
      <DropdownMenu>
        <DropdownMenuTrigger
          aria-label={copy.row.menu}
          className={KEBAB}
          onClick={(event) => event.stopPropagation()}
          onKeyDown={(event) => event.stopPropagation()}
        >
          <MoreHorizontal className="size-5" aria-hidden="true" />
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-52">
          <DropdownMenuItem render={<Link href={`/apps/reviews/reviews/${id}`} />}>
            <Eye />
            {copy.row.open}
          </DropdownMenuItem>
          {status !== 'published' ? (
            <DropdownMenuItem onClick={() => handleStatus('published')}>
              <CircleCheck />
              {copy.row.approve}
            </DropdownMenuItem>
          ) : null}
          {status !== 'hidden' ? (
            <DropdownMenuItem onClick={() => handleStatus('hidden')}>
              <EyeOff />
              {copy.row.hide}
            </DropdownMenuItem>
          ) : null}
          <DropdownMenuSeparator />
          <DropdownMenuItem variant="destructive" onClick={() => setDeleting(true)}>
            <Trash2 />
            {copy.row.delete}
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
      <DeleteReviewsDialog
        ids={[id]}
        open={deleting}
        onOpenChange={setDeleting}
        onDeleted={onChanged}
      />
    </span>
  )
}
