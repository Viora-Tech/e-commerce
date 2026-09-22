'use client'

import { ArrowDown, ArrowUp, ChevronLeftIcon, Pencil, Plus, Trash2 } from '@commerce/ui/icons'
import { Button } from '@commerce/ui/shadcn/button'
import { Input } from '@commerce/ui/shadcn/input'
import { Spinner } from '@commerce/ui/shadcn/spinner'
import Link from 'next/link'
import { useState } from 'react'
import { toast } from 'sonner'
import PageBody from '@/components/layout/page-body'
import { destinationPath, type MenuItem, menusContent } from '@/data/menus'
import { api } from '@/lib/api-client'
import MenuItemDialog from './menu-item-dialog'

type MenuEditorProps = {
  menu: { id: string; title: string; handle: string; items: MenuItem[] }
}

const copy = menusContent

export default function MenuEditor({ menu }: MenuEditorProps) {
  // Hooks
  const [title, setTitle] = useState(menu.title)
  const [items, setItems] = useState<MenuItem[]>(menu.items)
  const [saving, setSaving] = useState(false)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editing, setEditing] = useState<MenuItem | null>(null)

  // Helpers
  const move = (index: number, dir: -1 | 1) => {
    const target = index + dir
    if (target < 0 || target >= items.length) return
    const next = [...items]
    const [moved] = next.splice(index, 1)
    if (moved) next.splice(target, 0, moved)
    setItems(next)
  }

  const persist = async (nextItems: MenuItem[], nextTitle: string) => {
    setSaving(true)
    try {
      await api.navigation.save({
        id: menu.id,
        title: nextTitle,
        handle: menu.handle,
        items: nextItems,
      })
      toast.success(copy.editor.saved)
    } catch {
      toast.error(copy.editor.failed)
    } finally {
      setSaving(false)
    }
  }

  // Event handlers
  const handleSave = () => persist(items, title)

  const handleSaveItem = (item: MenuItem) => {
    setItems((prev) => {
      const exists = prev.some((i) => i.id === item.id)
      return exists ? prev.map((i) => (i.id === item.id ? item : i)) : [...prev, item]
    })
    setDialogOpen(false)
    setEditing(null)
  }

  const handleAddItem = () => {
    setEditing(null)
    setDialogOpen(true)
  }

  const handleEditItem = (item: MenuItem) => {
    setEditing(item)
    setDialogOpen(true)
  }

  const handleRemoveItem = (id: string) => {
    setItems((prev) => prev.filter((i) => i.id !== id))
  }

  const handleDialogOpenChange = (open: boolean) => {
    setDialogOpen(open)
    if (!open) setEditing(null)
  }

  return (
    <PageBody>
      <div className="flex items-center justify-between gap-3">
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
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            aria-label={copy.create.titleLabel}
            className="w-72"
          />
        </div>
        <div className="flex shrink-0 items-center gap-3">
          <Button variant="outline" size="lg" onClick={handleAddItem}>
            <Plus />
            {copy.editor.addItem}
          </Button>
          <Button size="lg" onClick={handleSave} disabled={saving}>
            {saving ? <Spinner /> : null}
            {copy.editor.save}
          </Button>
        </div>
      </div>

      <div className="overflow-hidden rounded-lg border border-line bg-card">
        <div className="flex items-center justify-between gap-3 border-b border-line px-4 py-3">
          <h2 className="text-card-title text-ink-strong">{copy.editor.itemsHeading}</h2>
          <p className="text-caption text-muted-foreground">{copy.editor.hint}</p>
        </div>
        {items.length === 0 ? (
          <p className="px-4 py-10 text-center text-body text-muted-foreground">
            {copy.editor.empty}
          </p>
        ) : (
          <ul>
            {items.map((item, index) => (
              <li
                key={item.id}
                className="flex items-center gap-3 border-b border-line px-4 py-3 last:border-b-0"
              >
                <div className="min-w-0 flex-1">
                  <p className="truncate text-body font-medium text-foreground">{item.title}</p>
                  <p className="truncate text-caption text-muted-foreground">
                    {copy.item.types[item.type]} · {destinationPath(item.type, item.value)}
                  </p>
                </div>
                <div className="flex shrink-0 items-center gap-1">
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => move(index, -1)}
                    disabled={index === 0}
                    aria-label={copy.item.moveUp}
                  >
                    <ArrowUp className="size-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => move(index, 1)}
                    disabled={index === items.length - 1}
                    aria-label={copy.item.moveDown}
                  >
                    <ArrowDown className="size-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => handleEditItem(item)}
                    aria-label={copy.item.edit}
                  >
                    <Pencil className="size-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => handleRemoveItem(item.id)}
                    aria-label={copy.item.remove}
                  >
                    <Trash2 className="size-4" />
                  </Button>
                </div>
              </li>
            ))}
          </ul>
        )}
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
