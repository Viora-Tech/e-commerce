'use client'

import type { NavigationSettings } from '@commerce/core/navigation'
import { Plus, Save, Trash2 } from '@commerce/ui/icons'
import { Button } from '@commerce/ui/shadcn/button'
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@commerce/ui/shadcn/dialog'
import {
  Field,
  FieldDescription,
  FieldGroup,
  FieldLabel,
  FieldLegend,
  FieldSet,
} from '@commerce/ui/shadcn/field'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@commerce/ui/shadcn/select'
import { Spinner } from '@commerce/ui/shadcn/spinner'
import { SortableList } from '@commerce/ui/sortable'
import { useEffect, useState } from 'react'
import { toast } from 'sonner'
import { reorderLabels } from '@/data/common'
import { storefrontContent } from '@/data/menus'
import { useCopy } from '@/hooks/use-copy'
import { useRowIds } from '@/hooks/use-row-ids'
import { api } from '@/lib/api-client'

/** A menu as far as this dialog cares: what it is called, and the handle a pointer stores. */
export type MenuOption = { handle: string; title: string }

type StorefrontNavigationDialogProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  menus: MenuOption[]
  settings: NavigationSettings
  onSaved: (settings: NavigationSettings) => void
}

/** Stands in for "no header menu". Underscores cannot appear in a handle, so no menu collides. */
const NONE = '__none__'

/**
 * A handle already spoken for is not offered again: the same links in the header and in a
 * footer column read as a mistake rather than as intent, and the pointer has no way to say
 * which the merchant meant.
 */
function optionsFor(menus: MenuOption[], taken: readonly (string | null)[]): MenuOption[] {
  return menus.filter((m) => !taken.includes(m.handle))
}

export default function StorefrontNavigationDialog({
  open,
  onOpenChange,
  menus,
  settings,
  onSaved,
}: StorefrontNavigationDialogProps) {
  // Hooks
  const copy = useCopy(storefrontContent)
  const sortLabels = useCopy(reorderLabels)
  const [main, setMain] = useState(settings.main)
  const [footer, setFooter] = useState(settings.footer)
  const rowIds = useRowIds(footer.length)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (!open) return
    setMain(settings.main)
    setFooter(settings.footer)
  }, [open, settings])

  // Helpers
  const titleOf = (handle: string | undefined) =>
    menus.find((m) => m.handle === handle)?.title ?? handle ?? ''
  const persist = async () => {
    setSaving(true)
    try {
      const saved = await api.navigation.updateSettings({ main, footer })
      onSaved(saved)
      toast.success(copy.saved)
      onOpenChange(false)
    } catch {
      toast.error(copy.failed)
    } finally {
      setSaving(false)
    }
  }

  // Event handlers
  const handleMainChange = (value: string) => setMain(value === NONE ? null : value)

  const handleColumnChange = (index: number, value: string) => {
    setFooter((prev) => prev.map((handle, i) => (i === index ? value : handle)))
  }

  const handleColumnReorder = (next: { id: string; index: number }[]) => {
    rowIds.reorder(next.map((r) => r.id))
    setFooter(next.flatMap((r) => footer[r.index] ?? []))
  }

  const handleColumnAdd = () => {
    const unused = optionsFor(menus, [...footer, main])[0]
    if (unused) setFooter((prev) => [...prev, unused.handle])
  }

  const handleColumnRemove = (index: number) => {
    rowIds.remove(index)
    setFooter((prev) => prev.filter((_, i) => i !== index))
  }

  const handleSave = () => persist()

  // Render logic
  const headerChoices = optionsFor(menus, footer)
  const columnChoices = footer.map((_, index) =>
    optionsFor(menus, [...footer.filter((_, j) => j !== index), main]),
  )
  const spare = optionsFor(menus, [...footer, main]).length > 0
  const columns = footer.map((_, index) => ({ id: rowIds.ids[index] ?? String(index), index }))

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex max-h-[calc(100dvh-2rem)] flex-col gap-0 p-0 sm:max-w-md">
        <DialogHeader className="gap-0.5 p-4 pr-12">
          <DialogTitle>{copy.editTitle}</DialogTitle>
          <DialogDescription>{copy.editDescription}</DialogDescription>
        </DialogHeader>
        <div className="flex flex-1 flex-col gap-5 overflow-y-auto px-4 pb-4">
          <Field>
            <FieldLabel htmlFor="header-menu">{copy.headerLabel}</FieldLabel>
            <Select value={main ?? NONE} onValueChange={(v) => handleMainChange(String(v))}>
              <SelectTrigger id="header-menu" className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={NONE}>{copy.none}</SelectItem>
                {headerChoices.map((m) => (
                  <SelectItem key={m.handle} value={m.handle}>
                    {m.title}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <FieldDescription>{copy.headerHelp}</FieldDescription>
          </Field>

          <FieldSet>
            <FieldLegend variant="label">{copy.footerLabel}</FieldLegend>
            <FieldGroup>
              {footer.length > 0 ? (
                <SortableList
                  items={columns}
                  onReorder={handleColumnReorder}
                  getTitle={({ index }) => titleOf(footer[index])}
                  labels={sortLabels}
                  className="flex flex-col gap-1"
                  itemClassName="rounded-md"
                  renderItem={({ index }, { handle }) => {
                    const menu = footer[index]
                    if (menu === undefined) return null
                    return (
                      <div className="flex items-center gap-1 py-0.5">
                        {handle}
                        <Select
                          value={menu}
                          onValueChange={(v) => handleColumnChange(index, String(v))}
                        >
                          <SelectTrigger
                            className="w-full"
                            aria-label={`${copy.footerLabel} ${index + 1}`}
                          >
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {(columnChoices[index] ?? []).map((m) => (
                              <SelectItem key={m.handle} value={m.handle}>
                                {m.title}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="shrink-0"
                          onClick={() => handleColumnRemove(index)}
                          aria-label={copy.removeColumn}
                        >
                          <Trash2 className="size-4" />
                        </Button>
                      </div>
                    )
                  }}
                />
              ) : null}
              <div>
                <Button type="button" variant="outline" onClick={handleColumnAdd} disabled={!spare}>
                  <Plus />
                  {copy.addColumn}
                </Button>
              </div>
              <FieldDescription>{copy.footerHelp}</FieldDescription>
            </FieldGroup>
          </FieldSet>
        </div>
        <DialogFooter className="m-0 flex-row justify-end gap-2">
          <DialogClose render={<Button variant="outline" />}>{copy.cancel}</DialogClose>
          <Button type="button" onClick={handleSave} disabled={saving}>
            {saving ? <Spinner /> : <Save aria-hidden="true" />}
            {copy.save}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
