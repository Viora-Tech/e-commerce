'use client'

import { createBlocksConfig, type PageData } from '@commerce/blocks/puck'
import { RichTextEditor } from '@commerce/editor'
import { Button } from '@commerce/ui/shadcn/button'
import { Spinner } from '@commerce/ui/shadcn/spinner'
import { createUsePuck, Puck } from '@measured/puck'
import '@/styles/vendor-puck.css'
import '@/styles/vendor-blocks.css'
import '@/styles/vendor-editor.css'
import { ArrowLeft, ExternalLink } from 'lucide-react'
import Link from 'next/link'
import { type ReactNode, useEffect, useState } from 'react'
import { toast } from 'sonner'
import StatusPill from '@/components/layout/status-pill'
import { onlineStoreContent } from '@/data/online-store'
import { api } from '@/lib/api-client'

type PageRow = NonNullable<Awaited<ReturnType<typeof api.pages.get>>>

type PageEditorProps = { page: PageRow; themeCss: string; storefrontOrigin: string }

type EditorHeaderProps = {
  page: PageRow
  published: boolean
  /** Data as last saved this session; null until the first save (Puck rewrites ids on load). */
  savedJson: string | null
  busy: boolean
  storefrontOrigin: string
  onSave: (data: PageData, publish: boolean) => void
}

const copy = onlineStoreContent.editor
const usePuck = createUsePuck()

const pagePath = (handle: string) => (handle === 'home' ? '/' : `/pages/${handle}`)

/** Product blocks in the editor resolve through the API, scoped to the active store. */
const config = createBlocksConfig(
  async ({ productType, limit }) => {
    const r = await api.products.list({ page: 1, perPage: limit, status: 'active' })
    const items = productType ? r.items.filter((p) => p.productType === productType) : r.items
    return items.map((p) => ({
      id: p.id,
      handle: p.handle,
      title: p.title,
      vendor: p.vendor,
      productType: p.productType,
      pricePaise: p.minPricePaise ?? 0,
      mrpPaise: null,
      available: p.available,
      images: p.imageUrl ? [{ url: p.imageUrl, alt: p.title }] : [],
    }))
  },
  { RichTextEditor },
)

type ThemeFrameProps = { children: ReactNode; document?: Document | undefined; css: string }

/**
 * The store theme goes into the preview iframe only. Its variables (`--color-muted`,
 * `--color-accent`…) share names with the admin's Tailwind tokens, so injecting it
 * into the admin document would restyle the editor chrome.
 */
function ThemeFrame({ children, document, css }: ThemeFrameProps) {
  // Hooks
  useEffect(() => {
    if (!document) return
    const el = document.createElement('style')
    el.textContent = css
    document.head.appendChild(el)
    return () => el.remove()
  }, [document, css])

  return <>{children}</>
}

/** Our own header inside Puck: back, title, path, unsaved state, save/publish. */
function EditorHeader({
  page,
  published,
  savedJson,
  busy,
  storefrontOrigin,
  onSave,
}: EditorHeaderProps) {
  // Hooks
  const data = usePuck((s) => s.appState.data)
  const hasPast = usePuck((s) => s.history.hasPast)

  // Render logic
  const dirty = hasPast && (savedJson === null || JSON.stringify(data) !== savedJson)
  const path = pagePath(page.handle)

  return (
    <header className="flex h-14 items-center gap-3 border-b bg-card px-4 [grid-area:header]">
      <Button
        variant="ghost"
        size="icon"
        aria-label={copy.back}
        render={<Link href="/online-store/pages" />}
      >
        <ArrowLeft />
      </Button>
      <div className="flex min-w-0 flex-1 items-center gap-3">
        <span className="truncate text-card-title">{page.title}</span>
        <span className="hidden text-caption text-muted-foreground-soft md:inline">{path}</span>
        {dirty ? (
          <StatusPill tone="warning">{copy.unsaved}</StatusPill>
        ) : published ? (
          <StatusPill tone="success">{copy.published}</StatusPill>
        ) : null}
      </div>
      <Button
        variant="ghost"
        size="sm"
        render={<a href={`${storefrontOrigin}${path}`} target="_blank" rel="noreferrer" />}
      >
        <ExternalLink />
        {copy.viewLive}
      </Button>
      <Button
        variant="outline"
        size="sm"
        disabled={busy}
        onClick={() => onSave(data as PageData, false)}
      >
        {busy ? <Spinner /> : null}
        {copy.saveDraft}
      </Button>
      <Button size="sm" disabled={busy} onClick={() => onSave(data as PageData, true)}>
        {copy.publish}
      </Button>
    </header>
  )
}

export default function PageEditor({ page, themeCss, storefrontOrigin }: PageEditorProps) {
  // Hooks
  const [busy, setBusy] = useState(false)
  const [savedJson, setSavedJson] = useState<string | null>(null)
  const [published, setPublished] = useState(Boolean(page.publishedAt))

  // Event handlers
  const handleSave = async (data: PageData, publish: boolean) => {
    setBusy(true)
    try {
      await api.pages.saveDraft({ id: page.id, data })
      if (publish) await api.pages.publish({ id: page.id })
      if (publish) setPublished(true)
      setSavedJson(JSON.stringify(data))
      toast.success(publish ? copy.published : copy.savedDraft)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : copy.failed)
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="fixed inset-0 z-10 left-(--sidebar-width,16rem) text-foreground">
      <Puck
        config={config}
        data={page.data as PageData}
        onPublish={(data) => handleSave(data as PageData, true)}
        overrides={{
          iframe: ({ children, document }) => (
            <ThemeFrame document={document} css={themeCss}>
              {children}
            </ThemeFrame>
          ),
          header: () => (
            <EditorHeader
              page={page}
              published={published}
              savedJson={savedJson}
              busy={busy}
              storefrontOrigin={storefrontOrigin}
              onSave={handleSave}
            />
          ),
        }}
      />
    </div>
  )
}
