'use client'

import { slugify } from '@commerce/core/catalog'
import { Button } from '@commerce/ui/shadcn/button'
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@commerce/ui/shadcn/dialog'
import { Field, FieldDescription, FieldGroup, FieldLabel } from '@commerce/ui/shadcn/field'
import { Input } from '@commerce/ui/shadcn/input'
import {
  InputGroup,
  InputGroupAddon,
  InputGroupInput,
  InputGroupText,
} from '@commerce/ui/shadcn/input-group'
import { Spinner } from '@commerce/ui/shadcn/spinner'
import { useRouter } from 'next/navigation'
import { useState } from 'react'
import { toast } from 'sonner'
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
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{copy.title}</DialogTitle>
        </DialogHeader>
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
        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
            {copy.cancel}
          </Button>
          <Button type="button" onClick={handleCreate} disabled={!title.trim() || busy}>
            {busy ? <Spinner /> : null}
            {copy.confirm}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
