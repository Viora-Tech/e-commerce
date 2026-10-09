'use client'

import type { RichTextValue } from '@commerce/richtext'
import { ExternalLink } from '@commerce/ui/icons'
import { Button } from '@commerce/ui/shadcn/button'
import { Card, CardContent } from '@commerce/ui/shadcn/card'
import { Field, FieldGroup, FieldLabel } from '@commerce/ui/shadcn/field'
import { Input } from '@commerce/ui/shadcn/input'
import { useRouter } from 'next/navigation'
import { useState } from 'react'
import { toast } from 'sonner'
import RichTextField from '@/components/fields/rich-text-field'
import ProoflyDetailPage from '@/components/layout/proofly-detail-page'
import ProoflyPageHeader from '@/components/layout/proofly-page-header'
import SaveBar from '@/components/layout/save-bar'
import { onlineStoreContent } from '@/data/online-store'
import { useCopy } from '@/hooks/use-copy'
import { api } from '@/lib/api-client'
import { routes } from '@/lib/routes'
import PageSeoCard from './page-seo-card'
import PageTemplateCard from './page-template-card'
import PageVisibilityCard from './page-visibility-card'

type PageRow = NonNullable<Awaited<ReturnType<typeof api.pages.get>>>

type PageFormProps = {
  page: PageRow
  /** Page alternates on the live theme, for the template select. */
  suffixes: string[]
  /** Customize on this page's template. */
  contentHref: string
  storefrontOrigin: string
}

type FormState = {
  title: string
  handle: string
  body: RichTextValue | null
  seoTitle: string
  seoDescription: string
  templateSuffix: string
  visible: boolean
}

const fromPage = (p: PageRow): FormState => ({
  title: p.title,
  handle: p.handle,
  body: (p.body as RichTextValue | null) ?? null,
  seoTitle: p.seoTitle ?? '',
  seoDescription: p.seoDescription ?? '',
  templateSuffix: p.templateSuffix ?? '',
  visible: p.publishedAt !== null,
})

/** Online Store › Pages › page: details, SEO, visibility and theme template; layout lives in Customize. */
export default function PageForm({ page, suffixes, contentHref, storefrontOrigin }: PageFormProps) {
  // Hooks
  const { form: copy } = useCopy(onlineStoreContent)
  const router = useRouter()
  const [form, setForm] = useState(() => fromPage(page))
  const [saved, setSaved] = useState(() => JSON.stringify(fromPage(page)))
  const [busy, setBusy] = useState(false)

  // Helpers
  const patch = (next: Partial<FormState>) => setForm((f) => ({ ...f, ...next }))

  // Event handlers
  const handleSave = async () => {
    setBusy(true)
    try {
      await api.pages.update({
        id: page.id,
        title: form.title,
        handle: form.handle,
        body: form.body as Record<string, unknown> | null,
        seoTitle: form.seoTitle || null,
        seoDescription: form.seoDescription || null,
        templateSuffix: form.templateSuffix || null,
        visible: form.visible,
      })
      setSaved(JSON.stringify(form))
      toast.success(copy.saved)
      router.refresh()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : copy.failed)
    } finally {
      setBusy(false)
    }
  }

  // Render logic
  const dirty = JSON.stringify(form) !== saved
  const path = page.handle === 'home' ? '/' : `/pages/${page.handle}`

  return (
    <ProoflyDetailPage
      header={
        <ProoflyPageHeader
          title={page.title}
          back={{ label: copy.back, href: routes.onlineStore.pages() }}
          actions={
            page.publishedAt ? (
              <Button
                variant="outline"
                nativeButton={false}
                render={<a href={`${storefrontOrigin}${path}`} target="_blank" rel="noreferrer" />}
              >
                <ExternalLink />
                {copy.viewLive}
              </Button>
            ) : null
          }
        />
      }
      main={
        <>
          <Card size="form">
            <CardContent>
              <FieldGroup>
                <Field>
                  <FieldLabel htmlFor="page-title">{copy.title}</FieldLabel>
                  <Input
                    id="page-title"
                    size="lg"
                    value={form.title}
                    onChange={(e) => patch({ title: e.target.value })}
                  />
                </Field>
                <RichTextField
                  label={copy.content}
                  value={form.body}
                  onChange={(body) => patch({ body })}
                  minHeight={240}
                />
              </FieldGroup>
            </CardContent>
          </Card>
          <PageSeoCard
            handle={form.handle}
            seoTitle={form.seoTitle}
            seoDescription={form.seoDescription}
            onChange={patch}
          />
        </>
      }
      side={
        <>
          <PageVisibilityCard visible={form.visible} onChange={(visible) => patch({ visible })} />
          <PageTemplateCard
            suffixes={suffixes}
            value={form.templateSuffix}
            contentHref={contentHref}
            onChange={(templateSuffix) => patch({ templateSuffix })}
          />
        </>
      }
    >
      <SaveBar
        open={dirty}
        message={copy.unsaved}
        saveLabel={busy ? copy.saving : copy.save}
        discardLabel={copy.discard}
        onSave={handleSave}
        onDiscard={() => setForm(JSON.parse(saved) as FormState)}
        saving={busy}
      />
    </ProoflyDetailPage>
  )
}
