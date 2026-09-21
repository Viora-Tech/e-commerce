'use client'

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
import { onlineStoreContent } from '@/data/online-store'
import { api } from '@/lib/api-client'

type CreatePageDialogProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
}

const copy = onlineStoreContent.pages.create

const slugify = (title: string) =>
  title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')

export function CreatePageDialog({ open, onOpenChange }: CreatePageDialogProps) {
  const router = useRouter()
  const [title, setTitle] = useState('')
  const [handle, setHandle] = useState('')
  const [busy, setBusy] = useState(false)

  async function create() {
    setBusy(true)
    try {
      const p = await api.pages.create({
        title,
        handle: handle || slugify(title),
        data: { root: { props: { title } }, content: [], zones: {} },
      })
      if (!p) throw new Error(copy.failed)
      onOpenChange(false)
      router.push(`/online-store/pages/${p.id}`)
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
            <FieldLabel htmlFor="page-title">{copy.titleLabel}</FieldLabel>
            <Input
              id="page-title"
              size="lg"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              autoComplete="off"
              autoFocus
            />
          </Field>
          <Field>
            <FieldLabel htmlFor="page-handle">{copy.handleLabel}</FieldLabel>
            <InputGroup size="lg">
              <InputGroupAddon>
                <InputGroupText>{copy.handlePrefix}</InputGroupText>
              </InputGroupAddon>
              <InputGroupInput
                id="page-handle"
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
          <Button type="button" onClick={create} disabled={!title.trim() || busy}>
            {busy ? <Spinner /> : null}
            {copy.confirm}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
