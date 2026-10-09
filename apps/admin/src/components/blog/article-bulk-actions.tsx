'use client'

import { Button } from '@commerce/ui/shadcn/button'
import { blogListContent } from '@/data/blog'
import { useCopy } from '@/hooks/use-copy'

type ArticleBulkActionsProps = {
  busy: boolean
  onPublish: () => void
  onUnpublish: () => void
  onDelete: () => void
}

/** Buttons inside the selection bar of the blog post list. */
export default function ArticleBulkActions({
  busy,
  onPublish,
  onUnpublish,
  onDelete,
}: ArticleBulkActionsProps) {
  // Hooks
  const { bulk: copy } = useCopy(blogListContent)

  // Render logic
  return (
    <>
      <Button variant="outline" size="sm" disabled={busy} onClick={onPublish}>
        {copy.publish}
      </Button>
      <Button variant="outline" size="sm" disabled={busy} onClick={onUnpublish}>
        {copy.unpublish}
      </Button>
      <Button variant="outline" size="sm" disabled={busy} onClick={onDelete}>
        {copy.delete}
      </Button>
    </>
  )
}
