'use client'

import { ChevronLeftIcon } from '@commerce/ui/icons'
import { Input } from '@commerce/ui/shadcn/input'
import { appendNode, findNode, removeNode, replaceNode } from '@commerce/ui/sortable/tree'
import Link from 'next/link'
import { useState } from 'react'
import { toast } from 'sonner'
import PageBody from '@/components/layout/page-body'
import SaveBar from '@/components/layout/save-bar'
import { type MenuItem, menusContent } from '@/data/menus'
import { api } from '@/lib/api-client'
import MenuItemDialog from './menu-item-dialog'
import MenuTree from './menu-tree'

type MenuEditorProps = {
  menu: { id: string; title: string; handle: string; items: MenuItem[] }
}

type Draft = { title: string; items: MenuItem[] }

const copy = menusContent

const snapshot = (draft: Draft) => JSON.stringify(draft)

/** One menu: its title and its nested items, saved together from the save bar. */
export default function MenuEditor({ menu }: MenuEditorProps) {
  // Hooks
  const [draft, setDraft] = useState<Draft>({ title: menu.title, items: menu.items })
  const [saved, setSaved] = useState(() => snapshot({ title: menu.title, items: menu.items }))
  const [saving, setSaving] = useState(false)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editing, setEditing] = useState<MenuItem | null>(null)
  const [addParent, setAddParent] = useState<string | null>(null)

  // Event handlers
  const handleSave = async () => {
    setSaving(true)
    try {
      const row = await api.navigation.save({
        id: menu.id,
        title: draft.title.trim() || menu.title,
        handle: menu.handle,
        items: draft.items,
      })
      const next = { title: row?.title ?? draft.title, items: row?.items ?? draft.items }
      setDraft(next)
      setSaved(snapshot(next))
      toast.success(copy.editor.saved)
    } catch {
      toast.error(copy.editor.failed)
    } finally {
      setSaving(false)
    }
  }

  const handleDiscard = () => setDraft(JSON.parse(saved) as Draft)

  const handleItemsChange = (items: MenuItem[]) => setDraft((prev) => ({ ...prev, items }))

  const handleAdd = (parentId: string | null) => {
    setEditing(null)
    setAddParent(parentId)
    setDialogOpen(true)
  }

  const handleEdit = (item: MenuItem) => {
    setEditing(item)
    setAddParent(null)
    setDialogOpen(true)
  }

  const handleRemove = (id: string) => {
    setDraft((prev) => ({ ...prev, items: removeNode(prev.items, id) }))
  }

  const handleSaveItem = (item: MenuItem) => {
    setDraft((prev) => ({
      ...prev,
      items: findNode(prev.items, item.id)
        ? replaceNode(prev.items, item)
        : appendNode(prev.items, item, addParent),
    }))
    setDialogOpen(false)
    setEditing(null)
  }

  const handleDialogOpenChange = (open: boolean) => {
    setDialogOpen(open)
    if (!open) setEditing(null)
  }

  // Render logic
  const dirty = snapshot(draft) !== saved

  return (
    <PageBody>
      <SaveBar
        open={dirty}
        message={copy.editor.unsaved}
        saveLabel={copy.editor.save}
        discardLabel={copy.editor.discard}
        onSave={handleSave}
        onDiscard={handleDiscard}
        saving={saving}
      />
      <div className="flex min-w-0 items-center gap-3">
        <Link
          href="/content/menus"
          className="flex shrink-0 items-center gap-1 text-body text-muted-foreground hover:text-foreground"
        >
          <ChevronLeftIcon className="size-4" />
          {copy.editor.back}
        </Link>
        <Input
          size="lg"
          value={draft.title}
          onChange={(e) => setDraft((prev) => ({ ...prev, title: e.target.value }))}
          aria-label={copy.create.titleLabel}
          className="w-72"
        />
      </div>

      <div className="overflow-hidden rounded-lg border border-line bg-card shadow-card">
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-line px-4 py-3">
          <h2 className="text-card-title text-ink-strong">{copy.editor.itemsHeading}</h2>
          <p className="text-caption text-muted-foreground">{copy.editor.hint}</p>
        </div>
        {draft.items.length === 0 ? (
          <p className="px-4 pt-8 pb-4 text-center text-body text-muted-foreground">
            {copy.editor.empty}
          </p>
        ) : null}
        <MenuTree
          items={draft.items}
          onChange={handleItemsChange}
          onEdit={handleEdit}
          onRemove={handleRemove}
          onAdd={handleAdd}
        />
      </div>

      <MenuItemDialog
        open={dialogOpen}
        initial={editing}
        onSave={handleSaveItem}
        onOpenChange={handleDialogOpenChange}
      />
    </PageBody>
  )
}
