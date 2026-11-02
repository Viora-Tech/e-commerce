'use client'

import {
  EMAIL_STARTER_CATEGORIES,
  type EmailBrand,
  type EmailStarterCategory,
  starterMjml,
} from '@commerce/core/marketing'
import { Loader2Icon, Pencil, Save, Trash2 } from '@commerce/ui/icons'
import { Button } from '@commerce/ui/shadcn/button'
import { Dialog, DialogDescription, DialogTitle } from '@commerce/ui/shadcn/dialog'
import { Field, FieldLabel } from '@commerce/ui/shadcn/field'
import { Input } from '@commerce/ui/shadcn/input'
import { Tabs, TabsList, TabsTrigger } from '@commerce/ui/shadcn/tabs'
import type { Editor } from 'grapesjs'
import { useEffect, useState } from 'react'
import { toast } from 'sonner'
import ConfirmDialog from '@/components/layout/confirm-dialog'
import DialogContent from '@/components/layout/dialog-content'
import DialogHeader from '@/components/layout/dialog-header'
import { emailBuilderContent } from '@/data/email-builder'
import { useCopy } from '@/hooks/use-copy'
import { api } from '@/lib/api-client'
import { loadDesign, readDesign } from './grapes-config'

type BuilderTemplatesDialogProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  /** The live editor; read when the merchant saves or loads, never during render. */
  getEditor: () => Editor | null
  brand: EmailBrand | null
}

type Row = Awaited<ReturnType<typeof api.marketing.emailTemplates.list>>[number]
type Starter = Awaited<ReturnType<typeof api.marketing.emailTemplates.starters>>[number]
/** What the merchant asked to put on the canvas, held until they confirm the replace. */
type Pending = { kind: 'starter'; mjml: string } | { kind: 'saved'; row: Row } | { kind: 'blank' }

/** A 600px email drawn at card size: a sandboxed, non-interactive thumbnail. */
function Thumb({ html, title }: { html: string; title: string }) {
  return (
    <div className="pointer-events-none relative h-64 overflow-hidden rounded-lg bg-muted">
      <iframe
        title={title}
        sandbox=""
        srcDoc={html}
        tabIndex={-1}
        className="absolute top-0 left-0 h-[160%] w-[37.5rem] origin-top-left scale-[0.4] border-0 bg-background"
      />
    </div>
  )
}

/**
 * The template gallery (owner, 3 Nov 2026): ready-made designs in the store's own logo, colour
 * and products, plus the store's saved templates, which can be opened, updated, renamed or deleted.
 */
export default function BuilderTemplatesDialog({
  open,
  onOpenChange,
  getEditor,
  brand,
}: BuilderTemplatesDialogProps) {
  // Hooks
  const copy = useCopy(emailBuilderContent)
  const [tab, setTab] = useState<'ready' | 'saved'>('ready')
  const [category, setCategory] = useState<EmailStarterCategory | 'all'>('all')
  const [starters, setStarters] = useState<Starter[] | null>(null)
  const [failed, setFailed] = useState(false)
  const [rows, setRows] = useState<Row[] | null>(null)
  const [name, setName] = useState('')
  const [busy, setBusy] = useState(false)
  const [pending, setPending] = useState<Pending | null>(null)
  const [openedId, setOpenedId] = useState<string | null>(null)
  const [renaming, setRenaming] = useState<{ id: string; name: string } | null>(null)

  useEffect(() => {
    if (!open) return
    let live = true
    api.marketing.emailTemplates.list().then((r) => {
      if (live) setRows(r)
    })
    if (!starters) {
      api.marketing.emailTemplates
        .starters({
          labels: {
            reason: copy.footer.reason,
            unsubscribe: copy.footer.unsubscribe,
            shopNow: copy.products.buttonLabel,
          },
        })
        .then((s) => {
          if (live) setStarters(s)
        })
        .catch(() => {
          if (live) setFailed(true)
        })
    }
    return () => {
      live = false
    }
  }, [open, starters, copy.footer.reason, copy.footer.unsubscribe, copy.products.buttonLabel])

  // Helpers
  const refresh = async () => setRows(await api.marketing.emailTemplates.list())

  // Event handlers
  const handleSave = async () => {
    const editor = getEditor()
    const design = editor ? readDesign(editor) : null
    if (!design) {
      toast.error(copy.builder.compileFailed)
      return
    }
    setBusy(true)
    try {
      const row = await api.marketing.emailTemplates.create({ name: name.trim(), design })
      toast.success(copy.templates.saved)
      setName('')
      if (row) setOpenedId(row.id)
      await refresh()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : String(err))
    } finally {
      setBusy(false)
    }
  }

  const handleUpdate = async (row: Row) => {
    const editor = getEditor()
    const design = editor ? readDesign(editor) : null
    if (!design) {
      toast.error(copy.builder.compileFailed)
      return
    }
    setBusy(true)
    try {
      await api.marketing.emailTemplates.update({ id: row.id, design })
      toast.success(copy.gallery.updated)
      await refresh()
    } finally {
      setBusy(false)
    }
  }

  const handleRename = async () => {
    if (!renaming?.name.trim()) return
    await api.marketing.emailTemplates.update({ id: renaming.id, name: renaming.name.trim() })
    toast.success(copy.gallery.renamed)
    setRenaming(null)
    await refresh()
  }

  const handleDelete = async (id: string) => {
    await api.marketing.emailTemplates.delete({ id })
    toast.success(copy.templates.deleted)
    if (openedId === id) setOpenedId(null)
    await refresh()
  }

  const handleUse = async () => {
    const editor = getEditor()
    if (!pending || !editor) return
    if (pending.kind === 'saved') {
      const row = await api.marketing.emailTemplates.get({ id: pending.row.id })
      if (row) loadDesign(editor, row.design)
      setOpenedId(pending.row.id)
    } else {
      const mjml =
        pending.kind === 'starter'
          ? pending.mjml
          : brand
            ? starterMjml(brand, { ...copy.starter, ...copy.footer })
            : ''
      editor.setComponents(mjml)
      setOpenedId(null)
    }
    setPending(null)
    onOpenChange(false)
  }

  // Render logic
  const g = copy.gallery
  const canSave = !busy && name.trim().length > 0
  const shown = (starters ?? []).filter((s) => category === 'all' || s.category === category)

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent size="wide">
        <DialogHeader>
          <DialogTitle>{g.title}</DialogTitle>
          <DialogDescription>{g.body}</DialogDescription>
        </DialogHeader>
        <Tabs value={tab} onValueChange={(v) => setTab(v as 'ready' | 'saved')}>
          <TabsList>
            <TabsTrigger value="ready">{g.readyTab}</TabsTrigger>
            <TabsTrigger value="saved">
              {g.savedTab}
              {rows?.length ? ` (${rows.length})` : ''}
            </TabsTrigger>
          </TabsList>
        </Tabs>

        {tab === 'ready' ? (
          <div className="flex flex-col gap-3">
            <div className="flex flex-wrap gap-1.5">
              {(['all', ...EMAIL_STARTER_CATEGORIES] as const).map((c) => (
                <Button
                  key={c}
                  size="sm"
                  variant={category === c ? 'default' : 'outline'}
                  onClick={() => setCategory(c)}
                >
                  {c === 'all' ? g.all : g.categories[c]}
                </Button>
              ))}
            </div>
            {failed ? <p className="text-body text-destructive">{g.failed}</p> : null}
            {!starters && !failed ? (
              <p className="flex items-center gap-2 text-body text-muted-foreground">
                <Loader2Icon className="size-4 animate-spin" aria-hidden="true" />
                {g.loading}
              </p>
            ) : null}
            <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3">
              {category === 'all' ? (
                <li>
                  <button
                    type="button"
                    onClick={() => setPending({ kind: 'blank' })}
                    className="flex h-full w-full flex-col gap-2 rounded-xl border border-border p-2 text-left hover:border-primary focus-visible:outline-2 focus-visible:outline-ring"
                  >
                    <div className="flex h-64 items-center justify-center rounded-lg border border-dashed border-border text-muted-foreground">
                      +
                    </div>
                    <span className="text-body-strong">{g.blank}</span>
                    <span className="text-caption text-muted-foreground">{g.blankHint}</span>
                  </button>
                </li>
              ) : null}
              {shown.map((s) => {
                const meta = g.starters[s.id]
                return (
                  <li key={s.id}>
                    <button
                      type="button"
                      onClick={() => setPending({ kind: 'starter', mjml: s.mjml })}
                      aria-label={`${g.use}: ${meta?.name ?? s.id}`}
                      className="flex h-full w-full flex-col gap-2 rounded-xl border border-border p-2 text-left hover:border-primary focus-visible:outline-2 focus-visible:outline-ring"
                    >
                      <Thumb html={s.html} title={meta?.name ?? s.id} />
                      <span className="text-body-strong">{meta?.name ?? s.id}</span>
                      <span className="text-caption text-muted-foreground">{meta?.hint}</span>
                    </button>
                  </li>
                )
              })}
            </ul>
          </div>
        ) : (
          <div className="flex flex-col gap-4">
            <div className="flex items-end gap-2">
              <Field className="flex-1">
                <FieldLabel htmlFor="email-template-name">{g.saveCurrent}</FieldLabel>
                <Input
                  id="email-template-name"
                  value={name}
                  maxLength={120}
                  placeholder={copy.templates.nameLabel}
                  onChange={(e) => setName(e.target.value)}
                />
              </Field>
              <Button onClick={handleSave} disabled={!canSave}>
                <Save aria-hidden="true" />
                {copy.templates.nameSave}
              </Button>
            </div>
            {rows && rows.length === 0 ? (
              <p className="text-body text-muted-foreground">{copy.templates.empty}</p>
            ) : null}
            <ul className="flex flex-col divide-y divide-border rounded-xl border border-border">
              {(rows ?? []).map((r) => (
                <li key={r.id} className="flex flex-wrap items-center gap-2 px-3 py-2">
                  {renaming?.id === r.id ? (
                    <form
                      className="flex min-w-0 flex-1 items-center gap-2"
                      onSubmit={(e) => {
                        e.preventDefault()
                        void handleRename()
                      }}
                    >
                      <Input
                        aria-label={g.renameTitle}
                        value={renaming.name}
                        maxLength={120}
                        autoFocus
                        onChange={(e) => setRenaming({ id: r.id, name: e.target.value })}
                      />
                      <Button type="submit" size="sm" disabled={!renaming.name.trim()}>
                        {copy.templates.nameSave}
                      </Button>
                    </form>
                  ) : (
                    <span className="flex min-w-0 flex-1 items-center gap-2">
                      <span className="truncate text-body-strong">{r.name}</span>
                      {openedId === r.id ? (
                        <span className="rounded-full bg-muted px-2 py-0.5 text-caption text-muted-foreground">
                          {g.current}
                        </span>
                      ) : null}
                    </span>
                  )}
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => setPending({ kind: 'saved', row: r })}
                  >
                    {g.open}
                  </Button>
                  {openedId === r.id ? (
                    <Button
                      size="sm"
                      onClick={() => void handleUpdate(r)}
                      disabled={busy}
                      title={g.updateHint(r.name)}
                    >
                      <Save aria-hidden="true" />
                      {g.update}
                    </Button>
                  ) : null}
                  <Button
                    size="icon"
                    variant="ghost"
                    aria-label={`${g.rename}: ${r.name}`}
                    onClick={() => setRenaming({ id: r.id, name: r.name })}
                  >
                    <Pencil />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    aria-label={copy.templates.delete(r.name)}
                    onClick={() => void handleDelete(r.id)}
                  >
                    <Trash2 />
                  </Button>
                </li>
              ))}
            </ul>
          </div>
        )}
      </DialogContent>
      <ConfirmDialog
        open={pending !== null}
        onOpenChange={(o) => !o && setPending(null)}
        title={copy.templates.replaceTitle}
        body={copy.templates.replaceBody}
        confirmLabel={copy.templates.replaceConfirm}
        cancelLabel={copy.templates.replaceCancel}
        onConfirm={handleUse}
      />
    </Dialog>
  )
}
