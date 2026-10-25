'use client'

import { VALUELESS_ITEM_TYPES } from '@commerce/core/navigation'
import { Plus, Save } from '@commerce/ui/icons'
import { cn } from '@commerce/ui/lib/utils'
import { Button } from '@commerce/ui/shadcn/button'
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@commerce/ui/shadcn/dialog'
import { Field, FieldGroup, FieldLabel } from '@commerce/ui/shadcn/field'
import { Input } from '@commerce/ui/shadcn/input'
import { useEffect, useState } from 'react'
import { toast } from 'sonner'
import {
  type MenuItem,
  menusContent,
  NAVIGATION_ITEM_TYPES,
  type NavigationItemType,
} from '@/data/menus'
import { useCopy } from '@/hooks/use-copy'
import DestinationPicker from './destination-picker'

type MenuItemDialogProps = {
  open: boolean
  /** null to add a new item, otherwise the item being edited. */
  initial: MenuItem | null
  onSave: (item: MenuItem) => void
  onOpenChange: (open: boolean) => void
}

const newItemId = () => crypto.randomUUID()

/** Home, search and all collections link to a fixed page: no destination to pick. */
const isValueless = (type: NavigationItemType) => VALUELESS_ITEM_TYPES.includes(type)

export default function MenuItemDialog({
  open,
  initial,
  onSave,
  onOpenChange,
}: MenuItemDialogProps) {
  // Hooks
  const { item: copy } = useCopy(menusContent)
  const [title, setTitle] = useState('')
  const [type, setType] = useState<NavigationItemType>('home')
  const [value, setValue] = useState('')

  useEffect(() => {
    if (!open) return
    setTitle(initial?.title ?? '')
    setType(initial?.type ?? 'home')
    setValue(initial?.value ?? '')
  }, [open, initial])

  // Event handlers
  const handleType = (next: NavigationItemType) => {
    // A handle picked for one kind means nothing for another.
    if (next !== type) setValue('')
    setType(next)
  }

  const handlePick = (v: string, t: string) => {
    setValue(v)
    if (!title.trim()) setTitle(t)
  }

  const handleSave = () => {
    if (!title.trim()) {
      toast.error(copy.missingTitle)
      return
    }
    if (!isValueless(type) && !value.trim()) {
      toast.error(copy.missingValue)
      return
    }
    onSave({
      id: initial?.id ?? newItemId(),
      title: title.trim(),
      type,
      value: isValueless(type) ? undefined : value.trim(),
    })
    onOpenChange(false)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{initial ? copy.update : copy.title}</DialogTitle>
        </DialogHeader>
        <FieldGroup>
          <Field>
            <FieldLabel htmlFor="menu-item-title">{copy.titleLabel}</FieldLabel>
            <Input
              id="menu-item-title"
              size="lg"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder={copy.titlePlaceholder}
              autoComplete="off"
              autoFocus
            />
          </Field>
          <Field>
            <FieldLabel>{copy.destinationLabel}</FieldLabel>
            <div className="flex flex-wrap gap-2">
              {NAVIGATION_ITEM_TYPES.map((t) => (
                <button
                  key={t}
                  type="button"
                  onClick={() => handleType(t)}
                  aria-pressed={type === t}
                  className={cn(
                    'rounded-full border px-3 py-1 text-body',
                    type === t
                      ? 'border-primary bg-primary-soft text-ink-strong'
                      : 'border-line text-muted-foreground hover:bg-muted',
                  )}
                >
                  {copy.types[t]}
                </button>
              ))}
            </div>
          </Field>
          {type === 'url' ? (
            <Field>
              <FieldLabel htmlFor="menu-item-url">{copy.types.url}</FieldLabel>
              <Input
                id="menu-item-url"
                size="lg"
                value={value}
                onChange={(e) => setValue(e.target.value)}
                placeholder={copy.urlPlaceholder}
                autoComplete="off"
              />
            </Field>
          ) : type === 'home' || type === 'search' || type === 'collections' ? null : (
            <DestinationPicker type={type} selectedValue={value} onSelect={handlePick} />
          )}
        </FieldGroup>
        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
            {copy.cancel}
          </Button>
          <Button type="button" onClick={handleSave}>
            {initial ? <Save aria-hidden="true" /> : <Plus aria-hidden="true" />}
            {initial ? copy.update : copy.add}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
