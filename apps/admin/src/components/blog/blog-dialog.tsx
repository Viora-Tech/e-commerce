'use client'

import { type CommentPolicy, CommentPolicySchema } from '@commerce/core/blog'
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
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@commerce/ui/shadcn/select'
import { useEffect, useState } from 'react'
import { toast } from 'sonner'
import TemplateSelectField from '@/components/themes/template-select-field'
import { blogsManageContent } from '@/data/blog'
import { useCopy } from '@/hooks/use-copy'
import { api } from '@/lib/api-client'

export type EditableBlog = {
  id: string
  title: string
  handle: string
  commentPolicy: CommentPolicy
  templateSuffix: string | null
}

type BlogDialogProps = {
  open: boolean
  /** `null` creates a new blog. */
  blog: EditableBlog | null
  onOpenChange: (open: boolean) => void
  onSaved: (blog: { id: string; title: string }) => void
}

const POLICIES = CommentPolicySchema.options

/** Create or edit a blog: title, handle and comment policy. */
export default function BlogDialog({ open, blog, onOpenChange, onSaved }: BlogDialogProps) {
  // Hooks
  const copy = useCopy(blogsManageContent)
  const [title, setTitle] = useState('')
  const [handle, setHandle] = useState('')
  const [policy, setPolicy] = useState<CommentPolicy>('disabled')
  const [template, setTemplate] = useState('')
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    if (!open) return
    setTitle(blog?.title ?? '')
    setHandle(blog?.handle ?? '')
    setPolicy(blog?.commentPolicy ?? 'disabled')
    setTemplate(blog?.templateSuffix ?? '')
  }, [open, blog])

  // Event handlers
  const handleSave = async () => {
    const write = {
      title: title.trim(),
      commentPolicy: policy,
      templateSuffix: template || null,
      ...(handle.trim() ? { handle: handle.trim() } : {}),
    }
    if (!write.title) return
    setBusy(true)
    try {
      if (blog) {
        await api.blog.updateBlog({ id: blog.id, write })
        toast.success(copy.saved)
        onSaved({ id: blog.id, title: write.title })
      } else {
        const { id } = await api.blog.createBlog(write)
        toast.success(copy.created)
        onSaved({ id, title: write.title })
      }
      onOpenChange(false)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : copy.failed)
    } finally {
      setBusy(false)
    }
  }

  // Render logic
  const policyItems = Object.fromEntries(POLICIES.map((p) => [p, copy.commentPolicy[p]]))

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{blog ? copy.dialog.editTitle : copy.dialog.createTitle}</DialogTitle>
        </DialogHeader>
        <FieldGroup>
          <Field>
            <FieldLabel htmlFor="blog-title">{copy.dialog.title}</FieldLabel>
            <Input
              id="blog-title"
              size="lg"
              value={title}
              placeholder={copy.dialog.titlePlaceholder}
              onChange={(e) => setTitle(e.target.value)}
            />
          </Field>
          <Field>
            <FieldLabel htmlFor="blog-handle">{copy.dialog.handle}</FieldLabel>
            <Input
              id="blog-handle"
              size="lg"
              value={handle}
              onChange={(e) => setHandle(e.target.value)}
              autoComplete="off"
            />
            <FieldDescription>{copy.dialog.handleHelp}</FieldDescription>
          </Field>
          <Field>
            <FieldLabel htmlFor="blog-comments">{copy.dialog.comments}</FieldLabel>
            <Select
              items={policyItems}
              value={policy}
              onValueChange={(v) => setPolicy(String(v) as CommentPolicy)}
            >
              <SelectTrigger id="blog-comments" className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {POLICIES.map((p) => (
                  <SelectItem key={p} value={p}>
                    {copy.commentPolicy[p]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
          <TemplateSelectField
            id="blog-template"
            kind="blog"
            label={copy.dialog.template}
            value={template}
            onChange={setTemplate}
          />
        </FieldGroup>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={busy}>
            {copy.dialog.cancel}
          </Button>
          <Button onClick={handleSave} disabled={busy || !title.trim()}>
            {busy ? copy.dialog.saving : copy.dialog.save}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
