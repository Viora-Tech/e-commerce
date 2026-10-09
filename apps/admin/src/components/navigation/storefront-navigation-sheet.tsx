'use client'

import type { NavigationSettings } from '@commerce/core/navigation'
import { ArrowDown, ArrowUp, Plus, Trash2 } from '@commerce/ui/icons'
import { Button } from '@commerce/ui/shadcn/button'
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
import {
  Sheet,
  SheetClose,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from '@commerce/ui/shadcn/sheet'
import { Spinner } from '@commerce/ui/shadcn/spinner'
import { useEffect, useState } from 'react'
import { toast } from 'sonner'
import { storefrontContent } from '@/data/menus'
import { useCopy } from '@/hooks/use-copy'
import { api } from '@/lib/api-client'

/** A menu as far as this sheet cares: what it is called, and the handle a pointer stores. */
export type MenuOption = { handle: string; title: string }

type StorefrontNavigationSheetProps = {
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

export default function StorefrontNavigationSheet({
  open,
  onOpenChange,
  menus,
  settings,
  onSaved,
}: StorefrontNavigationSheetProps) {
  // Hooks
  const copy = useCopy(storefrontContent)
  const [main, setMain] = useState(settings.main)
  const [footer, setFooter] = useState(settings.footer)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (!open) return
    setMain(settings.main)
    setFooter(settings.footer)
  }, [open, settings])

  // Helpers
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

  const handleColumnMove = (index: number, dir: -1 | 1) => {
    const target = index + dir
    if (target < 0 || target >= footer.length) return
    setFooter((prev) => {
      const next = [...prev]
      const [moved] = next.splice(index, 1)
      if (moved) next.splice(target, 0, moved)
      return next
    })
  }

  const handleColumnAdd = () => {
    const unused = optionsFor(menus, [...footer, main])[0]
    if (unused) setFooter((prev) => [...prev, unused.handle])
  }

  const handleColumnRemove = (index: number) => {
    setFooter((prev) => prev.filter((_, i) => i !== index))
  }

  const handleSave = () => persist()

  // Render logic
  const headerChoices = optionsFor(menus, footer)
  const columnChoices = footer.map((_, index) =>
    optionsFor(menus, [...footer.filter((_, j) => j !== index), main]),
  )
  const spare = optionsFor(menus, [...footer, main]).length > 0

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="flex w-full flex-col gap-0 sm:max-w-md">
        <SheetHeader>
          <SheetTitle>{copy.editTitle}</SheetTitle>
          <SheetDescription>{copy.editDescription}</SheetDescription>
        </SheetHeader>
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
                <ul className="flex flex-col gap-2">
                  {footer.map((handle, index) => (
                    // biome-ignore lint/suspicious/noArrayIndexKey: a row is a position, and its handle changes as the merchant picks.
                    <li key={index} className="flex items-center gap-2">
                      <Select
                        value={handle}
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
                      <div className="flex shrink-0 items-center gap-1">
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handleColumnMove(index, -1)}
                          disabled={index === 0}
                          aria-label={copy.moveUp}
                        >
                          <ArrowUp className="size-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handleColumnMove(index, 1)}
                          disabled={index === footer.length - 1}
                          aria-label={copy.moveDown}
                        >
                          <ArrowDown className="size-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handleColumnRemove(index)}
                          aria-label={copy.removeColumn}
                        >
                          <Trash2 className="size-4" />
                        </Button>
                      </div>
                    </li>
                  ))}
                </ul>
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
        <SheetFooter className="flex-row justify-end gap-2">
          <SheetClose render={<Button variant="outline" />}>{copy.cancel}</SheetClose>
          <Button type="button" onClick={handleSave} disabled={saving}>
            {saving ? <Spinner /> : null}
            {copy.save}
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  )
}
