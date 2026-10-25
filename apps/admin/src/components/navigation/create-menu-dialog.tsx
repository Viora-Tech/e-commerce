'use client'

import { slugify } from '@commerce/core/catalog'
import { Field, FieldDescription, FieldGroup, FieldLabel } from '@commerce/ui/shadcn/field'
import { Input } from '@commerce/ui/shadcn/input'
import {
  InputGroup,
  InputGroupAddon,
  InputGroupInput,
  InputGroupText,
} from '@commerce/ui/shadcn/input-group'
import { useRouter } from 'next/navigation'
import { useState } from 'react'
import { toast } from 'sonner'
import FormDialog from '@/components/layout/form-dialog'
import { menusContent } from '@/data/menus'
import { useCopy } from '@/hooks/use-copy'
import { api } from '@/lib/api-client'

type CreateMenuDialogProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
}

export default function CreateMenuDialog({ open, onOpenChange }: CreateMenuDialogProps) {
  // Hooks
  const { create: copy } = useCopy(menusContent)
  const router = useRouter()
  const [title, setTitle] = useState('')
  const [handle, setHandle] = useState('')
  const [busy, setBusy] = useState(false)

  // Event handlers
  const handleCreate = async () => {
    setBusy(true)
    try {
      const m = await api.navigation.save({ title, handle: handle || slugify(title), items: [] })
      if (!m) throw new Error(copy.failed)
      onOpenChange(false)
      router.push(`/content/menus/${m.id}`)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : copy.failed)
    } finally {
      setBusy(false)
    }
  }

  return (
    <FormDialog
      open={open}
      onOpenChange={onOpenChange}
      title={copy.title}
      submitLabel={copy.confirm}
      cancelLabel={copy.cancel}
      busy={busy}
      submitDisabled={!title.trim()}
      onSubmit={handleCreate}
    >
      <FieldGroup>
        <Field>
          <FieldLabel htmlFor="menu-title">{copy.titleLabel}</FieldLabel>
          <Input
            id="menu-title"
            size="lg"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            autoComplete="off"
            autoFocus
          />
        </Field>
        <Field>
          <FieldLabel htmlFor="menu-handle">{copy.handleLabel}</FieldLabel>
          <InputGroup size="lg">
            <InputGroupAddon>
              <InputGroupText>{copy.handlePrefix}</InputGroupText>
            </InputGroupAddon>
            <InputGroupInput
              id="menu-handle"
              value={handle}
              placeholder={slugify(title)}
              onChange={(e) => setHandle(e.target.value)}
              autoComplete="off"
            />
          </InputGroup>
          <FieldDescription>{copy.handleHelp}</FieldDescription>
        </Field>
      </FieldGroup>
    </FormDialog>
  )
}
