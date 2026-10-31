'use client'

import type { DocStore, DocumentTemplateView } from '@commerce/core'
import {
  DEFAULT_TEMPLATES,
  DOCUMENT_MERGE_TAGS,
  samplePreview,
  TEMPLATE_MAX_CHARS,
} from '@commerce/core/document-templates'
import { permissions } from '@commerce/core/permissions'
import { Braces, RotateCcw } from '@commerce/ui/icons'
import { Button } from '@commerce/ui/shadcn/button'
import { Field, FieldDescription, FieldError, FieldLabel } from '@commerce/ui/shadcn/field'
import { Textarea } from '@commerce/ui/shadcn/textarea'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useState } from 'react'
import { toast } from 'sonner'
import ConfirmDialog from '@/components/layout/confirm-dialog'
import DataCard from '@/components/layout/data-card'
import PageHeader from '@/components/layout/page-header'
import SaveBar from '@/components/layout/save-bar'
import { documentTemplatesContent } from '@/data/document-templates'
import { useCopy } from '@/hooks/use-copy'
import { usePermissions } from '@/hooks/use-permissions'
import { api } from '@/lib/api-client'
import { routes } from '@/lib/routes'
import DocumentFrame from './document-frame'
import MergeTagsDialog from './merge-tags-dialog'

type TemplateEditorProps = {
  template: DocumentTemplateView
  /** The store header the preview shows (Settings › Store details). */
  store: DocStore
  /** The GST invoices app is installed: it makes the tax invoice, not this template. */
  gstApp: boolean
}

const GST_SETTINGS = '/apps/gst-invoices/settings'

/**
 * One printed document's template (audit #164): HTML with merge tags on the left, a live
 * preview of a made-up order on the right, Save and Reset to default. Scripts never run in the
 * preview or the print (`DocumentFrame`).
 */
export default function TemplateEditor({ template, store, gstApp }: TemplateEditorProps) {
  // Hooks
  const content = useCopy(documentTemplatesContent)
  const router = useRouter()
  const { hasPermission } = usePermissions()
  const [html, setHtml] = useState(template.html)
  const [saved, setSaved] = useState(template.html)
  const [busy, setBusy] = useState(false)
  const [confirmReset, setConfirmReset] = useState(false)
  const [tagsOpen, setTagsOpen] = useState(false)

  // Event handlers
  const handleSave = async () => {
    if (html.length > TEMPLATE_MAX_CHARS) return
    setBusy(true)
    try {
      const next = await api.documents.save({ kind: template.kind, html })
      setHtml(next.html)
      setSaved(next.html)
      toast.success(content.editor.saved)
      router.refresh()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : content.editor.failed)
    } finally {
      setBusy(false)
    }
  }

  const handleReset = async () => {
    setBusy(true)
    try {
      const next = await api.documents.reset({ kind: template.kind })
      setHtml(next.html)
      setSaved(next.html)
      toast.success(content.editor.resetDone)
      router.refresh()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : content.editor.failed)
    } finally {
      setBusy(false)
      setConfirmReset(false)
    }
  }

  // Render logic
  const copy = content.editor
  const kind = content.kinds[template.kind]
  const canManage = hasPermission(permissions.SETTINGS_MANAGE)
  const dirty = html !== saved
  const tooLong = html.length > TEMPLATE_MAX_CHARS
  const isDefault = html === DEFAULT_TEMPLATES[template.kind]
  const preview = samplePreview(template.kind, html, store)

  return (
    <div className="flex flex-col gap-4">
      <SaveBar
        open={dirty && canManage}
        message={copy.saveMessage}
        saveLabel={copy.save}
        discardLabel={copy.discard}
        onSave={handleSave}
        onDiscard={() => setHtml(saved)}
        saving={busy}
      />
      <PageHeader
        title={kind.name}
        subtitle={kind.body}
        back={{ label: content.back, href: routes.settings.templates() }}
        actions={
          <>
            <Button variant="outline" onClick={() => setTagsOpen(true)}>
              <Braces aria-hidden="true" />
              {content.mergeTags.open}
            </Button>
            {canManage ? (
              <Button
                variant="outline"
                onClick={() => setConfirmReset(true)}
                disabled={busy || isDefault}
              >
                <RotateCcw aria-hidden="true" />
                {copy.reset}
              </Button>
            ) : null}
          </>
        }
      />
      {template.kind === 'invoice' && gstApp ? (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg bg-muted px-4 py-3">
          <div className="flex min-w-0 flex-col gap-1">
            <p className="text-body font-medium text-foreground">{content.gstApp.title}</p>
            <p className="text-body text-muted-foreground">{content.gstApp.body}</p>
          </div>
          <Button
            variant="outline"
            size="sm"
            nativeButton={false}
            render={<Link href={GST_SETTINGS} />}
          >
            {content.gstApp.open}
          </Button>
        </div>
      ) : null}
      <div className="grid gap-4 lg:grid-cols-2">
        <DataCard title={copy.html}>
          <div className="flex flex-col gap-4">
            <Field data-invalid={tooLong ? true : undefined}>
              <FieldLabel htmlFor="template-html" className="sr-only">
                {copy.html}
              </FieldLabel>
              <Textarea
                id="template-html"
                value={html}
                onChange={(e) => setHtml(e.target.value)}
                readOnly={!canManage}
                spellCheck={false}
                className="min-h-[32rem] font-mono text-caption"
              />
              {tooLong ? (
                <FieldError>{copy.tooLong}</FieldError>
              ) : (
                <FieldDescription>{copy.htmlHelp}</FieldDescription>
              )}
            </Field>
            <div className="flex flex-col gap-1.5">
              <p className="text-body font-medium text-foreground">{copy.tags}</p>
              <ul className="flex flex-col gap-1">
                {DOCUMENT_MERGE_TAGS[template.kind].map((tag) => (
                  <li key={tag} className="font-mono text-caption text-muted-foreground">
                    {tag}
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </DataCard>
        <DataCard title={copy.preview} meta={copy.previewHelp}>
          <DocumentFrame
            html={preview}
            title={copy.preview}
            className="h-[40rem] w-full rounded-lg border border-border"
          />
        </DataCard>
      </div>
      <MergeTagsDialog
        open={tagsOpen}
        onOpenChange={setTagsOpen}
        tags={DOCUMENT_MERGE_TAGS[template.kind]}
      />
      <ConfirmDialog
        open={confirmReset}
        onOpenChange={setConfirmReset}
        title={copy.resetTitle}
        body={copy.resetBody}
        confirmLabel={copy.resetConfirm}
        cancelLabel={copy.cancel}
        tone="destructive"
        busy={busy}
        onConfirm={handleReset}
      />
    </div>
  )
}
