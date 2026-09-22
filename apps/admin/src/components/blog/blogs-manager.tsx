'use client'

import { Pencil, SquarePlus, Trash2 } from '@commerce/ui/icons'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@commerce/ui/shadcn/alert-dialog'
import { Button } from '@commerce/ui/shadcn/button'
import { Card, CardContent } from '@commerce/ui/shadcn/card'
import { useState } from 'react'
import { toast } from 'sonner'
import PageBody from '@/components/layout/page-body'
import PageHeader from '@/components/layout/page-header'
import { blogsManageContent as copy } from '@/data/blog'
import { api } from '@/lib/api-client'
import BlogDialog, { type EditableBlog } from './blog-dialog'

type Blogs = Awaited<ReturnType<typeof api.blog.blogs>>
type Blog = Blogs[number]

type BlogsManagerProps = { initial: Blogs }

/** Rename blogs, change handles and comment policy, delete empty ones. */
export default function BlogsManager({ initial }: BlogsManagerProps) {
  // Hooks
  const [blogs, setBlogs] = useState(initial)
  const [editing, setEditing] = useState<EditableBlog | null>(null)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [deleting, setDeleting] = useState<Blog | null>(null)
  const [busy, setBusy] = useState(false)

  // Helpers
  const refresh = async () => setBlogs(await api.blog.blogs())

  // Event handlers
  const handleOpen = (blog: EditableBlog | null) => {
    setEditing(blog)
    setDialogOpen(true)
  }

  const handleDelete = async () => {
    if (!deleting) return
    setBusy(true)
    try {
      await api.blog.deleteBlog({ id: deleting.id })
      toast.success(copy.deleted)
      setDeleting(null)
      await refresh()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : copy.failed)
    } finally {
      setBusy(false)
    }
  }

  // Render logic
  const blocked = (deleting?.articles ?? 0) > 0

  return (
    <PageBody width="narrow" className="gap-4">
      <PageHeader
        title={copy.heading}
        breadcrumbs={[{ label: copy.back, href: '/content/blog-posts' }]}
        actions={
          <Button onClick={() => handleOpen(null)}>
            <SquarePlus strokeWidth={1.6} />
            {copy.add}
          </Button>
        }
      />
      <Card>
        <CardContent className="flex flex-col divide-y divide-line p-0">
          {blogs.map((blog) => (
            <div key={blog.id} className="flex items-center gap-4 px-5 py-4">
              <div className="flex min-w-0 flex-1 flex-col gap-0.5">
                <span className="text-body-strong">{blog.title}</span>
                <span className="truncate text-body text-muted-foreground">
                  /blogs/{blog.handle} · {copy.posts(blog.articles)} ·{' '}
                  {copy.commentPolicy[blog.commentPolicy]}
                </span>
              </div>
              <Button
                variant="ghost"
                size="icon"
                aria-label={`${copy.edit} ${blog.title}`}
                onClick={() => handleOpen(blog)}
              >
                <Pencil />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                aria-label={`${copy.delete} ${blog.title}`}
                onClick={() => setDeleting(blog)}
              >
                <Trash2 />
              </Button>
            </div>
          ))}
        </CardContent>
      </Card>

      <BlogDialog
        open={dialogOpen}
        blog={editing}
        onOpenChange={setDialogOpen}
        onSaved={() => void refresh()}
      />
      <AlertDialog open={deleting !== null} onOpenChange={(open) => !open && setDeleting(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{copy.confirmDelete.title(deleting?.title ?? '')}</AlertDialogTitle>
            <AlertDialogDescription>
              {blocked
                ? copy.confirmDelete.hasPosts(deleting?.articles ?? 0)
                : copy.confirmDelete.body}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={busy}>{copy.confirmDelete.cancel}</AlertDialogCancel>
            <AlertDialogAction
              variant="destructive"
              onClick={handleDelete}
              disabled={busy || blocked}
            >
              {copy.confirmDelete.confirm}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </PageBody>
  )
}
