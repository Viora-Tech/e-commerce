'use client'

import { AppWindow, ExternalLink, Eye, EyeOff, Trash2 } from '@commerce/ui/icons'
import { useState } from 'react'
import { toast } from 'sonner'
import ConfirmDialog from '@/components/layout/confirm-dialog'
import RowMenu from '@/components/table/row-menu'
import { pagesListContent } from '@/data/content'
import { useCopy } from '@/hooks/use-copy'
import { api } from '@/lib/api-client'
import { routes } from '@/lib/routes'

type PageRowMenuProps = {
  page: { id: string; title: string; handle: string; publishedAt: Date | string | null }
  /** Where the page lives on the store, e.g. `/pages/about`. */
  path: string
  storefrontOrigin: string
  /** The list re-reads its rows after a change here. */
  onChanged: () => void
}

/**
 * The ⋯ menu on a page row: open, show or hide on the store, view it live and delete. The
 * home page cannot be deleted from here, since the store would lose its front page.
 */
export default function PageRowMenu({ page, path, storefrontOrigin, onChanged }: PageRowMenuProps) {
  // Hooks
  const list = useCopy(pagesListContent)
  const [deleting, setDeleting] = useState(false)

  // Event handlers
  const handleVisible = async (visible: boolean) => {
    try {
      await api.pages.update({ id: page.id, visible })
      toast.success(visible ? list.row.shown : list.row.hidden)
      onChanged()
    } catch (err) {
      toast.error(err instanceof Error && err.message ? err.message : list.row.failed)
    }
  }

  const handleDelete = async () => {
    try {
      await api.pages.delete({ id: page.id })
      toast.success(list.row.deleted)
      onChanged()
    } catch (err) {
      toast.error(err instanceof Error && err.message ? err.message : list.row.failed)
      throw err
    }
  }

  // Render logic
  const live = Boolean(page.publishedAt)

  return (
    <>
      <RowMenu
        items={[
          { label: list.open, icon: AppWindow, href: routes.onlineStore.page(page.id) },
          live
            ? { label: list.row.hide, icon: EyeOff, onSelect: () => handleVisible(false) }
            : { label: list.row.show, icon: Eye, onSelect: () => handleVisible(true) },
          {
            label: list.row.view,
            icon: ExternalLink,
            hidden: !live,
            href: `${storefrontOrigin}${path}`,
            newTab: true,
          },
          {
            label: list.row.delete,
            icon: Trash2,
            destructive: true,
            hidden: page.handle === 'home',
            onSelect: () => setDeleting(true),
          },
        ]}
      />
      <ConfirmDialog
        tone="destructive"
        open={deleting}
        onOpenChange={setDeleting}
        title={list.row.deleteTitle(page.title)}
        body={list.row.deleteBody}
        confirmLabel={list.row.deleteConfirm}
        cancelLabel={list.row.cancel}
        stopPropagation
        onConfirm={handleDelete}
      />
    </>
  )
}
