'use client'

import { isRichTextEmpty, type RichTextValue } from '@commerce/richtext'
import { ExternalLink } from '@commerce/ui/icons'
import { Button } from '@commerce/ui/shadcn/button'
import { Card, CardContent } from '@commerce/ui/shadcn/card'
import { Field, FieldGroup, FieldLabel } from '@commerce/ui/shadcn/field'
import { Input } from '@commerce/ui/shadcn/input'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useState } from 'react'
import { toast } from 'sonner'
import RichTextField from '@/components/fields/rich-text-field'
import PageHeader from '@/components/layout/page-header'
import ProoflyDetailPage from '@/components/layout/proofly-detail-page'
import SaveBar from '@/components/layout/save-bar'
import MetafieldsCard from '@/components/metaobjects/metafields-card'
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
  /** Opened from an SEO issue: Back returns to SEO (audit #176). */
  fromSeo?: boolean
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
export default function PageForm({
  page,
  suffixes,
  contentHref,
  storefrontOrigin,
  fromSeo = false,
}: PageFormProps) {
  // Hooks
  const { form: copy } = useCopy(onlineStoreContent)
  const router = useRouter()
  const [form, setForm] = useState(() => fromPage(page))
  const [saved, setSaved] = useState(() => JSON.stringify(fromPage(page)))
  const [busy, setBusy] = useState(false)
  /* A template page with no text of its own shows where its content lives; this opens the box. */
  const [writing, setWriting] = useState(false)

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
  const fromTemplate = form.templateSuffix !== '' && isRichTextEmpty(form.body) && !writing

  return (
    <ProoflyDetailPage
      header={
        <PageHeader
          title={page.title}
          back={
            fromSeo
              ? { label: copy.backSeo, href: routes.onlineStore.seo() }
              : { label: copy.back, href: routes.onlineStore.pages() }
          }
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
                {fromTemplate ? (
                  <div className="flex flex-col gap-3 rounded-lg border border-dashed border-line p-4">
                    <p className="text-body text-foreground">
                      {copy.template.inTemplate(form.templateSuffix)}
                    </p>
                    <div className="flex flex-wrap gap-2">
                      <Button nativeButton={false} render={<Link href={contentHref} />}>
                        {copy.template.editContent}
                      </Button>
                      <Button variant="ghost" onClick={() => setWriting(true)}>
                        {copy.template.writeHere}
                      </Button>
                    </div>
                  </div>
                ) : (
                  <RichTextField
                    label={copy.content}
                    value={form.body}
                    onChange={(body) => patch({ body })}
                    minHeight={240}
                  />
                )}
              </FieldGroup>
            </CardContent>
          </Card>
          <PageSeoCard
            handle={form.handle}
            seoTitle={form.seoTitle}
            seoDescription={form.seoDescription}
            onChange={patch}
          />
          <MetafieldsCard ownerType="page" ownerId={page.id} />
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
