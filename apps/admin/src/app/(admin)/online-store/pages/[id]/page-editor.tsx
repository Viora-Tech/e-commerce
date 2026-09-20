'use client'

import { createBlocksConfig, type PageData } from '@commerce/blocks/puck'
import { createUsePuck, Puck } from '@measured/puck'
import '@measured/puck/puck.css'
import '@commerce/blocks/styles.css'
import { Toast } from '@shopify/polaris'
import { useState } from 'react'
import { api } from '@/lib/api-client'

type PageRow = NonNullable<Awaited<ReturnType<typeof api.pages.get>>>

const usePuck = createUsePuck()

function SaveDraftButton({ onSave, busy }: { onSave: (data: PageData) => void; busy: boolean }) {
  const data = usePuck((s) => s.appState.data)
  return (
    <button
      type="button"
      className="btn btn--secondary btn--small"
      disabled={busy}
      onClick={() => onSave(data as PageData)}
    >
      Save draft
    </button>
  )
}

/** Product blocks in the editor resolve through the API, scoped to the active store. */
const config = createBlocksConfig(async ({ productType, limit }) => {
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
})

export function PageEditor({ page, themeCss }: { page: PageRow; themeCss: string }) {
  const [toast, setToast] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  async function save(data: PageData, publish: boolean) {
    setBusy(true)
    try {
      await api.pages.saveDraft({ id: page.id, data })
      if (publish) await api.pages.publish({ id: page.id })
      setToast(publish ? 'Published' : 'Draft saved')
    } catch (err) {
      setToast(err instanceof Error ? err.message : 'Save failed')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div style={{ position: 'fixed', inset: 0, left: 'var(--sidebar-width, 16rem)', zIndex: 10 }}>
      {/* biome-ignore lint/security/noDangerouslySetInnerHtml: theme CSS is generated from validated tokens; the preview iframe inherits it. */}
      <style dangerouslySetInnerHTML={{ __html: themeCss }} />
      <Puck
        config={config}
        data={page.data as PageData}
        headerTitle={page.title}
        headerPath={page.handle === 'home' ? '/' : `/pages/${page.handle}`}
        onPublish={(data) => save(data as PageData, true)}
        overrides={{
          headerActions: ({ children }) => (
            <>
              <SaveDraftButton busy={busy} onSave={(d) => save(d, false)} />
              {children}
            </>
          ),
        }}
      />
      {toast ? <Toast content={toast} onDismiss={() => setToast(null)} /> : null}
    </div>
  )
}
