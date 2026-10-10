'use client'

import { Trash2 } from '@commerce/ui/icons'
import { Button } from '@commerce/ui/shadcn/button'
import { Card, CardContent, CardHeader, CardTitle } from '@commerce/ui/shadcn/card'
import { Field, FieldDescription, FieldLabel } from '@commerce/ui/shadcn/field'
import { Input } from '@commerce/ui/shadcn/input'
import { appendNode, findNode, removeNode, replaceNode } from '@commerce/ui/sortable/tree'
import { useRouter } from 'next/navigation'
import { useState } from 'react'
import { toast } from 'sonner'
import ProoflyDetailPage from '@/components/layout/proofly-detail-page'
import ProoflyPageHeader from '@/components/layout/proofly-page-header'
import SaveBar from '@/components/layout/save-bar'
import { type MenuItem, menusContent } from '@/data/menus'
import { useCopy } from '@/hooks/use-copy'
import { api } from '@/lib/api-client'
import { routes } from '@/lib/routes'
import DeleteMenuDialog from './delete-menu-dialog'
import LinkCheckBanner from './link-check-banner'
import { useLinkProblems } from './link-problems'
import MenuItemDialog from './menu-item-dialog'
import MenuTree from './menu-tree'
import type { MenuPlacement } from './placements'

type MenuEditorProps = {
  menu: { id: string; title: string; handle: string; items: MenuItem[] }
  /** Where the storefront renders this menu, for the summary line. */
  placements: MenuPlacement[]
}

type Draft = { title: string; items: MenuItem[] }

const snapshot = (draft: Draft) => JSON.stringify(draft)

/** Every link in the menu, nested ones included. */
const countLinks = (items: MenuItem[]): number =>
  items.reduce((n, item) => n + 1 + countLinks(item.children ?? []), 0)

/** One menu: its items on the left, name, handle and a preview on the right; saved from the save bar. */
export default function MenuEditor({ menu, placements }: MenuEditorProps) {
  // Hooks
  const copy = useCopy(menusContent)
  const router = useRouter()
  const [draft, setDraft] = useState<Draft>({ title: menu.title, items: menu.items })
  const [saved, setSaved] = useState(() => snapshot({ title: menu.title, items: menu.items }))
  const [saving, setSaving] = useState(false)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editing, setEditing] = useState<MenuItem | null>(null)
  const [addParent, setAddParent] = useState<string | null>(null)
  const [removing, setRemoving] = useState(false)
  const problems = useLinkProblems(draft.items)

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
  const where = copy.usedInJoin(placements.map((p) => copy.where[p]))

  return (
    <ProoflyDetailPage
      header={
        <ProoflyPageHeader
          title={draft.title.trim() || menu.title}
          summary={copy.editor.summary(countLinks(draft.items), where)}
          back={{ label: copy.editor.back, href: routes.content.menus() }}
          actions={
            <Button type="button" variant="outline" onClick={() => setRemoving(true)}>
              <Trash2 aria-hidden="true" />
              {copy.editor.deleteMenu}
            </Button>
          }
        />
      }
      main={
        <div className="overflow-hidden rounded-2xl border surface-card">
          <div className="flex flex-col gap-0.5 border-b border-line px-5 py-4">
            <h2 className="text-card-title text-ink-strong">{copy.editor.itemsHeading}</h2>
            <p className="text-caption text-muted-foreground">{copy.editor.hint}</p>
          </div>
          <LinkCheckBanner count={problems.size} />
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
            problems={problems}
          />
        </div>
      }
      side={
        <>
          <Card size="form">
            <CardHeader>
              <CardTitle>{copy.editor.previewHeading}</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex min-h-14 flex-wrap items-center gap-x-5 gap-y-1 rounded-lg bg-muted px-4 py-3 text-caption text-ink-strong">
                {draft.items.length === 0 ? (
                  <span className="text-muted-foreground">{copy.editor.previewEmpty}</span>
                ) : (
                  draft.items.map((item) => <span key={item.id}>{item.title}</span>)
                )}
              </div>
            </CardContent>
          </Card>
          <Card size="form">
            <CardHeader>
              <CardTitle>{copy.editor.detailsHeading}</CardTitle>
            </CardHeader>
            <CardContent className="flex flex-col gap-4">
              <Field>
                <FieldLabel htmlFor="menu-title">{copy.create.titleLabel}</FieldLabel>
                <Input
                  id="menu-title"
                  value={draft.title}
                  onChange={(e) => setDraft((prev) => ({ ...prev, title: e.target.value }))}
                />
              </Field>
              <Field>
                <FieldLabel htmlFor="menu-handle">{copy.editor.handleLabel}</FieldLabel>
                <Input id="menu-handle" value={menu.handle} readOnly />
                <FieldDescription>{copy.editor.handleHelp}</FieldDescription>
              </Field>
            </CardContent>
          </Card>
        </>
      }
    >
      <SaveBar
        open={dirty}
        message={copy.editor.unsaved}
        saveLabel={copy.editor.save}
        discardLabel={copy.editor.discard}
        onSave={handleSave}
        onDiscard={handleDiscard}
        saving={saving}
      />
      <MenuItemDialog
        open={dialogOpen}
        initial={editing}
        onSave={handleSaveItem}
        onOpenChange={handleDialogOpenChange}
      />
      {removing ? (
        <DeleteMenuDialog
          menu={{
            id: menu.id,
            title: menu.title,
            handle: menu.handle,
            itemCount: countLinks(menu.items),
            updatedAt: new Date(),
          }}
          onClose={() => setRemoving(false)}
          onDeleted={() => router.push(routes.content.menus())}
        />
      ) : null}
    </ProoflyDetailPage>
  )
}
