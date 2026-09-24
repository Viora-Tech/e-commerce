'use client'

import { ALTERNATE_KINDS, TEMPLATE_SUFFIX } from '@commerce/core/theme'
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
import { Spinner } from '@commerce/ui/shadcn/spinner'
import { useState } from 'react'
import { customizeContent } from '@/data/customize'
import type { TemplateRef } from './template-picker'

export type AlternateKind = (typeof ALTERNATE_KINDS)[number]

type CreateTemplateDialogProps = {
  /** The template on screen; its kind is preselected and it is the copy source. */
  current: TemplateRef
  /** Preselects a kind, e.g. when "Create template" was clicked inside a specific group. */
  initialKind?: AlternateKind | null
  busy: boolean
  onCancel: () => void
  onCreate: (kind: AlternateKind, suffix: string, basedOn: string) => void
}

const copy = customizeContent.createDialog
const names = customizeContent.templates.names

const isAlternateKind = (key: string): key is AlternateKind =>
  (ALTERNATE_KINDS as readonly string[]).includes(key)

/** Creates an alternate template (`product.preorder`) as a copy of an existing one. */
export default function CreateTemplateDialog({
  current,
  initialKind,
  busy,
  onCancel,
  onCreate,
}: CreateTemplateDialogProps) {
  // Hooks
  const [kind, setKind] = useState<AlternateKind>(
    initialKind ?? (isAlternateKind(current.key) ? current.key : 'product'),
  )
  const [name, setName] = useState('')

  // Event handlers
  const handleKind = (next: unknown) => {
    if (typeof next === 'string' && isAlternateKind(next)) setKind(next)
  }

  // Render logic
  const suffix = name.trim().toLowerCase()
  const valid = suffix.length > 0 && TEMPLATE_SUFFIX.test(suffix)
  const basedOn = current.key === kind ? current.suffix : ''
  const items = ALTERNATE_KINDS.map((k) => ({ value: k, label: names[k] }))

  return (
    <Dialog open onOpenChange={(open) => !open && onCancel()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{copy.title}</DialogTitle>
          <DialogDescription>{copy.body}</DialogDescription>
        </DialogHeader>
        <Field>
          <FieldLabel>{copy.kind}</FieldLabel>
          <Select items={items} value={kind} onValueChange={handleKind}>
            <SelectTrigger className="w-full" aria-label={copy.kind}>
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
        <Field>
          <FieldLabel htmlFor="template-name">{copy.name}</FieldLabel>
          <Input
            id="template-name"
            value={name}
            maxLength={40}
            onChange={(e) => setName(e.target.value)}
            autoComplete="off"
            autoFocus
          />
          <FieldDescription>{copy.nameHelp}</FieldDescription>
        </Field>
        <DialogFooter>
          <Button type="button" variant="outline" onClick={onCancel}>
            {copy.cancel}
          </Button>
          <Button
            type="button"
            disabled={!valid || busy}
            onClick={() => onCreate(kind, suffix, basedOn)}
          >
            {busy ? <Spinner /> : null}
            {copy.confirm}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
