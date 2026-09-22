'use client'

import { type DocumentKind, type InvoiceSettings, InvoiceSettingsSchema } from '@commerce/invoices'
import { FileText } from '@commerce/ui/icons'
import { Button } from '@commerce/ui/shadcn/button'
import { Skeleton } from '@commerce/ui/shadcn/skeleton'
import Link from 'next/link'
import { useEffect, useState } from 'react'
import { toast } from 'sonner'
import PageHeader from '@/components/layout/page-header'
import SaveBar from '@/components/layout/save-bar'
import { gstInvoicesContent } from '@/data/gst-invoices'
import { api } from '@/lib/api-client'
import DocumentsGroup from './documents-group'
import IssuingGroup from './issuing-group'
import LookGroup from './look-group'
import NumberingGroup from './numbering-group'
import PdfPreview from './pdf-preview'
import SellerGroup from './seller-group'
import SplitPane from './split-pane'
import { issuesByPath, type MediaRef } from './types'

type Loaded = {
  settings: InvoiceSettings
  storeName: string
  logo: MediaRef
  signature: MediaRef
}

const copy = gstInvoicesContent.settings

function validate(settings: InvoiceSettings): Record<string, string> {
  const r = InvoiceSettingsSchema.safeParse(settings)
  return r.success ? {} : issuesByPath(r.error.issues)
}

/**
 * Settings for the GST invoices app, laid out like invoicely's editor: the
 * form in collapsible groups on the left, the live PDF on the right, split
 * by a draggable divider.
 */
export default function SettingsEditor() {
  // Hooks
  const [form, setForm] = useState<Loaded | null>(null)
  const [saved, setSaved] = useState<string | null>(null)
  const [kind, setKind] = useState<DocumentKind>('tax_invoice')
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    api.gstInvoices.settings.get().then((r) => {
      const loaded: Loaded = {
        settings: r.settings,
        storeName: r.storeName,
        logo:
          r.settings.logoMediaId && r.media.logo
            ? { id: r.settings.logoMediaId, url: r.media.logo }
            : null,
        signature:
          r.settings.signatureMediaId && r.media.signature
            ? { id: r.settings.signatureMediaId, url: r.media.signature }
            : null,
      }
      setForm(loaded)
      setSaved(JSON.stringify(loaded))
    })
  }, [])

  // Helpers
  const setSettings = (settings: InvoiceSettings) => setForm((f) => (f ? { ...f, settings } : f))

  // Event handlers
  const handleMedia = (slot: 'logo' | 'signature', media: MediaRef) => {
    setForm((f) => {
      if (!f) return f
      const key = slot === 'logo' ? 'logoMediaId' : 'signatureMediaId'
      return { ...f, [slot]: media, settings: { ...f.settings, [key]: media?.id ?? null } }
    })
  }

  const handleSave = async () => {
    if (!form || Object.keys(validate(form.settings)).length) return
    setBusy(true)
    try {
      const settings = await api.gstInvoices.settings.save(form.settings)
      const next = { ...form, settings }
      setForm(next)
      setSaved(JSON.stringify(next))
      toast.success(copy.saved)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : copy.failed)
    } finally {
      setBusy(false)
    }
  }

  const handleDiscard = () => {
    if (saved) setForm(JSON.parse(saved) as Loaded)
  }

  // Early returns
  if (!form) {
    return (
      <div className="flex flex-col gap-3">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-96 w-full" />
      </div>
    )
  }

  // Render logic
  const dirty = saved !== null && JSON.stringify(form) !== saved
  const errors = validate(form.settings)
  const group = { settings: form.settings, onChange: setSettings, errors }

  return (
    <div className="flex flex-col gap-4">
      <SaveBar
        open={dirty}
        message={copy.unsaved}
        saveLabel={copy.save}
        discardLabel={copy.discard}
        onSave={handleSave}
        onDiscard={handleDiscard}
        saving={busy}
      />
      <PageHeader
        title={copy.title}
        subtitle={copy.intro}
        actions={
          <Button variant="outline" render={<Link href="/orders/invoices" />}>
            <FileText />
            {copy.invoicesLink}
          </Button>
        }
      />
      <SplitPane
        label={copy.previewOf}
        left={
          <>
            <SellerGroup
              {...group}
              logo={form.logo}
              signature={form.signature}
              onMedia={handleMedia}
            />
            <LookGroup {...group} />
            <DocumentsGroup {...group} kind={kind} onKind={setKind} />
            <NumberingGroup {...group} />
            <IssuingGroup {...group} />
          </>
        }
        right={
          <PdfPreview
            settings={form.settings}
            kind={kind}
            storeName={form.storeName}
            logoUrl={form.logo?.url ?? null}
            signatureUrl={form.signature?.url ?? null}
          />
        }
      />
    </div>
  )
}
