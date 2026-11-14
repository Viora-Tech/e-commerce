'use client'

import { displayStatus } from '@commerce/core/blog'
import { AppWindow, ExternalLink, Trash2 } from '@commerce/ui/icons'
import { useState } from 'react'
import { toast } from 'sonner'
import ConfirmDialog from '@/components/layout/confirm-dialog'
import RowMenu from '@/components/table/row-menu'
import { blogListContent } from '@/data/blog'
import { useCopy } from '@/hooks/use-copy'
import { api } from '@/lib/api-client'
import { routes } from '@/lib/routes'
import type { ArticleRow } from './article-columns'

type ArticleRowMenuProps = {
  article: ArticleRow
  storefrontOrigin: string
  /** The list re-reads its rows and counts after a change here. */
  onChanged: () => void | Promise<void>
}

/**
 * The ⋯ menu on a blog post row: open, publish or unpublish, view the live post and delete,
 * through the same ids[] endpoints as the selection bar.
 */
export default function ArticleRowMenu({
  article,
  storefrontOrigin,
  onChanged,
}: ArticleRowMenuProps) {
  // Hooks
  const copy = useCopy(blogListContent)
  const [deleting, setDeleting] = useState(false)

  // Helpers
  const run = async (action: () => Promise<unknown>, message: string) => {
    try {
      await action()
      toast.success(message)
      await onChanged()
    } catch (err) {
      toast.error(err instanceof Error && err.message ? err.message : copy.bulk.failed)
      throw err
    }
  }

  // Event handlers
  const handlePublish = () =>
    run(() => api.blog.publish({ ids: [article.id] }), copy.bulk.published(1)).catch(() => {})
  const handleUnpublish = () =>
    run(() => api.blog.unpublish({ ids: [article.id] }), copy.bulk.unpublished(1)).catch(() => {})
  const handleDelete = () => run(() => api.blog.delete({ ids: [article.id] }), copy.bulk.deleted(1))

  // Render logic
  const live = displayStatus(article.status, article.publishedAt) === 'published'

  return (
    <>
      <RowMenu
        items={[
          { label: copy.row.open, icon: AppWindow, href: routes.content.blogPost(article.id) },
          { label: copy.row.publish, hidden: live, onSelect: handlePublish },
          {
            label: copy.row.unpublish,
            hidden: article.status === 'draft',
            onSelect: handleUnpublish,
          },
          {
            label: copy.row.view,
            icon: ExternalLink,
            hidden: !live,
            href: `${storefrontOrigin}/blogs/${article.blogHandle}/${article.handle}`,
            newTab: true,
          },
          {
            label: copy.row.delete,
            icon: Trash2,
            destructive: true,
            onSelect: () => setDeleting(true),
          },
        ]}
      />
      <ConfirmDialog
        tone="destructive"
        open={deleting}
        onOpenChange={setDeleting}
        title={copy.row.deleteTitle(article.title)}
        body={copy.bulk.confirmDelete.body}
        confirmLabel={copy.bulk.confirmDelete.confirm}
        cancelLabel={copy.bulk.confirmDelete.cancel}
        stopPropagation
        onConfirm={handleDelete}
      />
    </>
  )
}
