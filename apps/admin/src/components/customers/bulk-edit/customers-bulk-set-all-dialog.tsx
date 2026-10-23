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
import { customersBulkEditContent } from '@/data/customers-bulk-edit'
import { useCopy } from '@/hooks/use-copy'
import {
  needsValue,
  SET_ALL_ACTIONS,
  type SetAllAction,
  type SetAllChange,
  type SetAllKey,
} from './customers-bulk-set-all'

type CustomersBulkSetAllDialogProps = {
  open: boolean
  /** Rows in the sheet, for the title. */
  count: number
  /** Columns on screen that can change for all; never empty (tags and note are always shown). */
  keys: SetAllKey[]
  onOpenChange: (open: boolean) => void
  onApply: (change: SetAllChange) => void
}

/** "Change for all": pick a column, what to do to it, and the value; Save still sends it. */
export default function CustomersBulkSetAllDialog({
  open,
  count,
  keys,
  onOpenChange,
  onApply,
}: CustomersBulkSetAllDialogProps) {
  // Hooks
  const copy = useCopy(customersBulkEditContent)
  const [key, setKey] = useState<SetAllKey>(keys[0] ?? 'tags')
  const [action, setAction] = useState<SetAllAction>(SET_ALL_ACTIONS[keys[0] ?? 'tags'][0])
  const [value, setValue] = useState('')

  // Event handlers
  const handleKey = (next: unknown) => {
    const k = String(next) as SetAllKey
    setKey(k)
    setAction(SET_ALL_ACTIONS[k][0])
    setValue('')
  }

  const handleAction = (next: unknown) => setAction(String(next) as SetAllAction)

  const handleApply = () => {
    onApply({ key, action, value })
    setValue('')
  }

  // Render logic
  const typed = needsValue(action)
  const valid = !typed || value.trim().length > 0
  const keyItems = keys.map((k) => ({ value: k, label: copy.columns[k] }))
  const actionItems = SET_ALL_ACTIONS[key].map((a) => ({
    value: a,
    label: copy.setAll.actions[a],
  }))
  const placeholder = key === 'tags' ? copy.setAll.tagsPlaceholder : copy.setAll.notePlaceholder

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{copy.setAll.title(count)}</DialogTitle>
          <DialogDescription>{copy.setAll.description}</DialogDescription>
        </DialogHeader>
        <Field>
          <FieldLabel>{copy.setAll.column}</FieldLabel>
          <Select items={keyItems} value={key} onValueChange={handleKey}>
            <SelectTrigger className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {keyItems.map((i) => (
                <SelectItem key={i.value} value={i.value}>
                  {i.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Field>
        <Field>
          <FieldLabel>{copy.setAll.action}</FieldLabel>
          <Select items={actionItems} value={action} onValueChange={handleAction}>
            <SelectTrigger className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {actionItems.map((i) => (
                <SelectItem key={i.value} value={i.value}>
                  {i.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {action === 'subscribe' ? (
            <FieldDescription>{copy.setAll.consentWarning}</FieldDescription>
          ) : null}
        </Field>
        {typed ? (
          <Field>
            <FieldLabel htmlFor="set-all-value">{copy.setAll.value}</FieldLabel>
            <Input
              id="set-all-value"
              value={value}
              placeholder={placeholder}
              autoComplete="off"
              onChange={(e) => setValue(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && valid) handleApply()
              }}
            />
            {key === 'tags' ? <FieldDescription>{copy.setAll.tagsHelp}</FieldDescription> : null}
          </Field>
        ) : null}
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            {copy.setAll.cancel}
          </Button>
          <Button onClick={handleApply} disabled={!valid}>
            <CheckIcon aria-hidden="true" />
            {copy.setAll.apply}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
