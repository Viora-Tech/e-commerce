'use client'

import 'grapesjs/dist/css/grapes.min.css'
import type { EmailBrand, EmailDesign } from '@commerce/core/marketing'
import { discountMjml, productGridMjml } from '@commerce/core/marketing'
import { CheckIcon, LayoutGrid, Loader2Icon } from '@commerce/ui/icons'
import { Button } from '@commerce/ui/shadcn/button'
import type { AssetsCustomData, Editor } from 'grapesjs'
import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { toast } from 'sonner'
import ConfirmDialog from '@/components/layout/confirm-dialog'
import MediaPickDialog, { type PickedMedia } from '@/components/media/media-pick-dialog'
import { emailBuilderContent } from '@/data/email-builder'
import { useCopy } from '@/hooks/use-copy'
import { api } from '@/lib/api-client'
import BuilderDiscountDialog from './builder-discount-dialog'
import BuilderProductsDialog, { type BuilderProducts } from './builder-products-dialog'
import BuilderTemplatesDialog from './builder-templates-dialog'
import {
  createEmailEditor,
  type PickRequest,
  readDesign,
  replacePlaceholder,
} from './grapes-config'

type VisualBuilderProps = {
  design: EmailDesign | null
  storefrontUrl: string
  onSave: (design: EmailDesign) => void
  onClose: () => void
}

/** Media can be root-relative (`/media/...`); an inbox needs the full address. */
function absoluteUrl(url: string, origin: string): string {
  if (/^https?:\/\//i.test(url)) return url
  return `${origin.replace(/\/$/, '')}${url.startsWith('/') ? '' : '/'}${url}`
}

/**
 * The full-screen drag-and-drop email builder (GrapesJS + MJML). Loaded on demand from the
 * campaign editor, so its bundle never weighs on other admin pages.
 */
export default function VisualBuilder({
  design,
  storefrontUrl,
  onSave,
  onClose,
}: VisualBuilderProps) {
  // Hooks
  const copy = useCopy(emailBuilderContent)
  const [brand, setBrand] = useState<EmailBrand | null>(null)
  const [pick, setPick] = useState<PickRequest | null>(null)
  const [imagePick, setImagePick] = useState<AssetsCustomData | null>(null)
  const [dialog, setDialog] = useState<'templates' | 'discard' | null>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  const editorRef = useRef<Editor | null>(null)

  useEffect(() => {
    let live = true
    api.marketing.emailBrand().then((b) => {
      if (live) setBrand(b)
    })
    return () => {
      live = false
    }
  }, [])

  // biome-ignore lint/correctness/useExhaustiveDependencies: built once per open; a new `design` must not rebuild the canvas
  useEffect(() => {
    const container = containerRef.current
    if (!brand || !container) return
    const editor = createEmailEditor({
      container,
      design,
      brand,
      copy,
      onPick: setPick,
      onPickImage: setImagePick,
    })
    editorRef.current = editor
    return () => {
      editorRef.current = null
      editor.destroy()
    }
  }, [brand])

  // Event handlers
  const handleSave = () => {
    const editor = editorRef.current
    if (!editor) return
    const next = readDesign(editor)
    if (!next) {
      toast.error(copy.builder.compileFailed)
      return
    }
    onSave(next)
  }

  const handleCancel = () => {
    if ((editorRef.current?.getDirtyCount() ?? 0) > 0) setDialog('discard')
    else onClose()
  }

  const handleProducts = (picked: BuilderProducts | null) => {
    if (pick?.kind === 'products' && picked && brand) {
      replacePlaceholder(
        pick.component,
        productGridMjml(picked.items, brand, {
          columns: picked.columns,
          buttonLabel: copy.products.buttonLabel,
        }),
      )
    }
    setPick(null)
  }

  const handleDiscount = (picked: { code: string; heading: string; note: string } | null) => {
    if (pick?.kind === 'discount' && picked && brand) {
      replacePlaceholder(pick.component, discountMjml(picked, brand))
    }
    setPick(null)
  }

  const handleImage = (media: PickedMedia | null) => {
    const data = imagePick
    setImagePick(null)
    if (!data) return
    if (media) {
      const added = data.am.add({ src: absoluteUrl(media.url, storefrontUrl) })
      const asset = Array.isArray(added) ? added[0] : added
      if (asset) data.select(asset, true)
    }
    data.close()
  }

  // Render logic
  const overlay = (
    <div
      className="fixed inset-0 z-50 flex flex-col bg-background"
      role="dialog"
      aria-modal="true"
      aria-label={copy.builder.title}
    >
      <div className="flex items-center justify-between gap-3 border-b border-border px-4 py-2">
        <p className="truncate text-card-title">{copy.builder.title}</p>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setDialog('templates')}
            disabled={!brand}
          >
            <LayoutGrid />
            {copy.templates.menu}
          </Button>
          <Button variant="ghost" size="sm" onClick={handleCancel}>
            {copy.builder.cancel}
          </Button>
          <Button size="sm" onClick={handleSave} disabled={!brand}>
            <CheckIcon aria-hidden="true" />
            {copy.builder.done}
          </Button>
        </div>
      </div>
      <div className="relative min-h-0 flex-1">
        {brand ? null : (
          <div className="absolute inset-0 flex items-center justify-center gap-2 text-body text-muted-foreground">
            <Loader2Icon className="size-4 animate-spin" aria-hidden="true" />
            {copy.builder.loading}
          </div>
        )}
        <div ref={containerRef} className="h-full" />
      </div>
      <BuilderProductsDialog
        open={pick?.kind === 'products'}
        defaultColumns={pick?.kind === 'products' ? pick.columns : 2}
        onDone={handleProducts}
      />
      <BuilderDiscountDialog open={pick?.kind === 'discount'} onDone={handleDiscount} />
      <MediaPickDialog
        open={imagePick !== null}
        title={copy.image.title}
        description={copy.image.description}
        onClose={() => handleImage(null)}
        onPick={handleImage}
      />
      <BuilderTemplatesDialog
        open={dialog === 'templates'}
        onOpenChange={(o) => setDialog(o ? 'templates' : null)}
        getEditor={() => editorRef.current}
      />
      <ConfirmDialog
        open={dialog === 'discard'}
        onOpenChange={(o) => setDialog(o ? 'discard' : null)}
        title={copy.builder.discardTitle}
        body={copy.builder.discardBody}
        confirmLabel={copy.builder.discardConfirm}
        cancelLabel={copy.builder.discardKeep}
        tone="destructive"
        onConfirm={onClose}
      />
    </div>
  )

  return createPortal(overlay, document.body)
}
