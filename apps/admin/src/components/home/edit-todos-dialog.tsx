'use client'

import { HOME_TODOS, type HomeTodo } from '@commerce/core/home-todos'
import { SlidersHorizontal } from '@commerce/ui/icons'
import { Button } from '@commerce/ui/shadcn/button'
import { Checkbox } from '@commerce/ui/shadcn/checkbox'
import { Dialog, DialogDescription, DialogTitle } from '@commerce/ui/shadcn/dialog'
import { Field, FieldGroup, FieldLabel } from '@commerce/ui/shadcn/field'
import { useRouter } from 'next/navigation'
import { useState } from 'react'
import { toast } from 'sonner'
import DialogContent from '@/components/layout/dialog-content'
import DialogFooter from '@/components/layout/dialog-footer'
import DialogHeader from '@/components/layout/dialog-header'
import { homePageContent } from '@/data/home'
import { useCopy } from '@/hooks/use-copy'
import { api } from '@/lib/api-client'

type EditTodosDialogProps = {
  /** The to-dos this store hides now. */
  hidden: HomeTodo[]
}

/**
 * "Edit to-dos" on Home: one checkbox per counted to-do, saved for the whole store
 * (`dashboard.setTodos`). A ticked to-do still only shows while its count is above zero.
 */
export default function EditTodosDialog({ hidden }: EditTodosDialogProps) {
  // Hooks
  const copy = useCopy(homePageContent)
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [draft, setDraft] = useState<HomeTodo[]>(hidden)
  const [saving, setSaving] = useState(false)

  // Event handlers
  const handleOpenChange = (next: boolean) => {
    if (next) setDraft(hidden)
    setOpen(next)
  }

  const handleToggle = (todo: HomeTodo, shown: boolean) => {
    setDraft(shown ? draft.filter((t) => t !== todo) : [...draft, todo])
  }

  const handleSave = async () => {
    setSaving(true)
    try {
      await api.dashboard.setTodos({ hidden: draft })
      toast.success(copy.todo.saved)
      setOpen(false)
      router.refresh()
    } catch {
      toast.error(copy.todo.saveFailed)
    } finally {
      setSaving(false)
    }
  }

  // Render logic
  const c = copy.todo

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <Button variant="outline" size="sm" onClick={() => handleOpenChange(true)}>
        <SlidersHorizontal aria-hidden="true" />
        {c.edit}
      </Button>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{c.editTitle}</DialogTitle>
          <DialogDescription>{c.editBody}</DialogDescription>
        </DialogHeader>
        <FieldGroup className="gap-3">
          {HOME_TODOS.map((todo) => (
            <Field key={todo} orientation="horizontal">
              <Checkbox
                id={`home-todo-${todo}`}
                checked={!draft.includes(todo)}
                onCheckedChange={(v) => handleToggle(todo, v === true)}
              />
              <FieldLabel htmlFor={`home-todo-${todo}`}>{c.names[todo]}</FieldLabel>
            </Field>
          ))}
        </FieldGroup>
        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => handleOpenChange(false)}>
            {c.cancel}
          </Button>
          <Button type="button" onClick={handleSave} disabled={saving}>
            {c.save}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
