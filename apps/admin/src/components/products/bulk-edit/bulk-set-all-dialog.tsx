'use client'

import { CheckIcon } from '@commerce/ui/icons'
import { Button } from '@commerce/ui/shadcn/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@commerce/ui/shadcn/dialog'
import { Field, FieldDescription, FieldLabel } from '@commerce/ui/shadcn/field'
import { Input } from '@commerce/ui/shadcn/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@commerce/ui/shadcn/select'
import { useState } from 'react'
import { bulkEditContent } from '@/data/bulk-edit'
import { useCopy } from '@/hooks/use-copy'
import { STATUSES } from './bulk-edit-model'
import {
  isMoneyAction,
  isPercentAction,
  needsValue,
  parseChangeValue,
  SET_ALL_ACTIONS,
  SET_ALL_KEYS,
  type SetAllAction,
  type SetAllChange,
  type SetAllKey,
} from './bulk-edit-set-all'

type BulkSetAllDialogProps = {
  open: boolean
  /** Variants in the sheet. */
  total: number
  /** Variants behind the ticked rows; 0 offers only "every row". */
  selectedCount: number
  onOpenChange: (open: boolean) => void
  /** `onlySelected`: change the ticked rows only. */
  onApply: (change: SetAllChange, onlySelected: boolean) => void
}

type Option = { value: string; label: string }

type PickFieldProps = {
  label: string
  items: Option[]
  value: string
  onChange: (next: unknown) => void
}

/**
 * "Change for all" on the products sheet (#985, #1000): pick a column, what to do to it and the
 * value, for every row or only the ticked ones. Prices move by an amount or a percentage. Save
 * still sends it.
 */
export default function BulkSetAllDialog({
  open,
  total,
  selectedCount,
  onOpenChange,
  onApply,
}: BulkSetAllDialogProps) {
  // Hooks
  const copy = useCopy(bulkEditContent)
  const [key, setKey] = useState<SetAllKey>('price')
  const [action, setAction] = useState<SetAllAction>(SET_ALL_ACTIONS.price[0])
  const [value, setValue] = useState('')
  const [scope, setScope] = useState<'all' | 'selected'>('all')

  // Helpers
  const valid = () => {
    if (key === 'status') return (STATUSES as readonly string[]).includes(value)
    if (!needsValue(action)) return true
    if (isMoneyAction(action)) return parseChangeValue(action, value) !== null
    return value.trim().length > 0
  }

  // Event handlers
  const handleKey = (next: unknown) => {
    const k = String(next) as SetAllKey
    setKey(k)
    setAction(SET_ALL_ACTIONS[k][0])
    setValue(k === 'status' ? STATUSES[0] : '')
  }

  const handleAction = (next: unknown) => setAction(String(next) as SetAllAction)

  const handleApply = () => {
    if (!valid()) return
    onApply({ key, action, value }, scope === 'selected' && selectedCount > 0)
    setValue(key === 'status' ? value : '')
  }

  // Render logic
  const keyItems: Option[] = SET_ALL_KEYS.map((k) => ({ value: k, label: copy.setAll.keys[k] }))
  const actionItems: Option[] = (SET_ALL_ACTIONS[key] as readonly SetAllAction[]).map((a) => ({
    value: a,
    label: copy.setAll.actions[a],
  }))
  const statusItems: Option[] = STATUSES.map((s) => ({ value: s, label: copy.statuses[s] }))
  const scopeItems: Option[] = [
    { value: 'all', label: copy.setAll.scopeAll(total) },
    ...(selectedCount > 0
      ? [{ value: 'selected', label: copy.setAll.scopeSelected(selectedCount) }]
      : []),
  ]
  const percent = isPercentAction(action)
  const money = isMoneyAction(action)
  const placeholder = percent
    ? copy.setAll.percentPlaceholder
    : money
      ? copy.setAll.amountPlaceholder
      : key === 'tags'
        ? copy.setAll.tagsPlaceholder
        : ''
  const typed = key !== 'status' && action !== 'clearAmount'

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{copy.setAll.title}</DialogTitle>
          <DialogDescription>{copy.setAll.description}</DialogDescription>
        </DialogHeader>
        <PickField
          label={copy.setAll.column}
          items={keyItems}
          value={key}
          onChange={handleKey}
        />
        {actionItems.length > 1 ? (
          <PickField
            label={copy.setAll.action}
            items={actionItems}
            value={action}
            onChange={handleAction}
          />
        ) : null}
        {key === 'status' ? (
          <PickField
            label={copy.setAll.value}
            items={statusItems}
            value={value}
            onChange={(next) => setValue(String(next))}
          />
        ) : null}
        {typed ? (
          <Field>
            <FieldLabel htmlFor="bulk-set-all-value">
              {percent ? copy.setAll.percent : money ? copy.setAll.amount : copy.setAll.value}
            </FieldLabel>
            <Input
              id="bulk-set-all-value"
              value={value}
              inputMode={money ? 'decimal' : undefined}
              placeholder={placeholder}
              autoComplete="off"
              onChange={(e) => setValue(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') handleApply()
              }}
            />
            {money ? <FieldDescription>{copy.setAll.moneyHelp}</FieldDescription> : null}
            {key === 'tags' ? <FieldDescription>{copy.setAll.tagsHelp}</FieldDescription> : null}
            {action === 'setText' ? (
              <FieldDescription>{copy.setAll.blankClears}</FieldDescription>
            ) : null}
          </Field>
        ) : null}
        <PickField
          label={copy.setAll.scope}
          items={scopeItems}
          value={selectedCount > 0 ? scope : 'all'}
          onChange={(next) => setScope(next === 'selected' ? 'selected' : 'all')}
        />
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            {copy.setAll.cancel}
          </Button>
          <Button onClick={handleApply} disabled={!valid()}>
            <CheckIcon aria-hidden="true" />
            {copy.setAll.apply}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

/** One labelled select of the dialog. */
function PickField({ label, items, value, onChange }: PickFieldProps) {
  return (
    <Field>
      <FieldLabel>{label}</FieldLabel>
      <Select items={items} value={value} onValueChange={onChange}>
        <SelectTrigger className="w-full">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {items.map((i) => (
            <SelectItem key={i.value} value={i.value}>
              {i.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </Field>
  )
}
