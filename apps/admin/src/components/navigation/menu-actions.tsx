'use client'

import { Pencil, Trash2 } from '@commerce/ui/icons'
import { useRouter } from 'next/navigation'
import { useState } from 'react'
import { toast } from 'sonner'
import NameDialog from '@/components/fields/name-dialog'
import RowMenu from '@/components/table/row-menu'
import { type MenuListItem, menusContent } from '@/data/menus'
import { useCopy } from '@/hooks/use-copy'
import { api } from '@/lib/api-client'
import DeleteMenuDialog from './delete-menu-dialog'

type MenuActionsProps = { menu: MenuListItem }

/**
 * The kebab on one menu row. The cell sits inside a row that navigates on click,
 * so every event it owns stops at the cell; the menu popup is portalled out of
 * the row, and the dialogs render above the table.
 */
export default function MenuActions({ menu }: MenuActionsProps) {
  // Hooks
  const { actions: copy, rename: renameCopy } = useCopy(menusContent)
  const router = useRouter()
  const [renaming, setRenaming] = useState(false)
  const [removing, setRemoving] = useState(false)
  const [busy, setBusy] = useState(false)

  // Event handlers
  /* There is no rename procedure, so the row is read back first and saved whole: the handle
     and the items travel through untouched. */
  const handleRename = async (title: string) => {
    setBusy(true)
    try {
      const current = await api.navigation.get({ id: menu.id })
      if (!current) throw new Error(renameCopy.failed)
      await api.navigation.save({
        id: menu.id,
        title,
        handle: current.handle,
        items: current.items,
      })
      toast.success(renameCopy.saved)
      setRenaming(false)
      router.refresh()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : renameCopy.failed)
    } finally {
      setBusy(false)
    }
  }

  // Render logic
  return (
    <span className="flex items-center justify-end">
      <RowMenu
        items={[
          { label: copy.rename, icon: Pencil, onSelect: () => setRenaming(true) },
          {
            label: copy.delete,
            icon: Trash2,
            destructive: true,
            onSelect: () => setRemoving(true),
          },
        ]}
      />
      {renaming ? (
        <NameDialog
          title={renameCopy.title}
          label={renameCopy.label}
          initialName={menu.title}
          submitLabel={busy ? renameCopy.saving : renameCopy.confirm}
          cancelLabel={renameCopy.cancel}
          busy={busy}
          stopPropagation
          onCancel={() => setRenaming(false)}
          onSubmit={handleRename}
        />
      ) : null}
      {removing ? <DeleteMenuDialog menu={menu} onClose={() => setRemoving(false)} /> : null}
    </span>
  )
}
