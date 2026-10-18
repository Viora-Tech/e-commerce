'use client'

import { ExternalLink } from '@commerce/ui/icons'
import { Button } from '@commerce/ui/shadcn/button'
import { useRouter } from 'next/navigation'
import { useState } from 'react'
import { toast } from 'sonner'
import ConfirmDialog from '@/components/layout/confirm-dialog'
import PageHeader from '@/components/layout/page-header'
import ProoflyDetailPage from '@/components/layout/proofly-detail-page'
import SaveBar from '@/components/layout/save-bar'
import MetafieldsCard from '@/components/metaobjects/metafields-card'
import TemplateSelectCard from '@/components/themes/template-select-card'
import { articleFormContent, blogListContent } from '@/data/blog'
import { useCopy } from '@/hooks/use-copy'
import { api } from '@/lib/api-client'
import { routes } from '@/lib/routes'
import ArticleImageCard from './article-image-card'
import ArticleMainCard from './article-main-card'
import ArticleOrganisationCard from './article-organisation-card'
import ArticleSeoCard from './article-seo-card'
import ArticleVisibilityCard from './article-visibility-card'
import {
  type ArticleFormState,
  type BlogOption,
  emptyArticleForm,
  fromArticle,
  type LoadedArticle,
  toWrite,
} from './form-state'

type ArticleFormProps = {
  article: LoadedArticle | null
  blogs: BlogOption[]
  tags: string[]
  defaultAuthor: string
  storefrontOrigin: string
}

function initialForm(
  article: LoadedArticle | null,
  blogs: BlogOption[],
  author: string,
): ArticleFormState {
  if (article) return fromArticle(article)
  return emptyArticleForm(blogs[0]?.id ?? '', author)
}

/** The blog post editor, laid out like the product form. */
export default function ArticleForm({
  article,
  blogs: initialBlogs,
  tags,
  defaultAuthor,
  storefrontOrigin,
}: ArticleFormProps) {
  // Hooks
  const copy = useCopy(articleFormContent)
  const {
    bulk: { confirmDelete: deleteCopy },
  } = useCopy(blogListContent)
  const router = useRouter()
  const [form, setForm] = useState<ArticleFormState>(() =>
    initialForm(article, initialBlogs, defaultAuthor),
  )
  const [saved, setSaved] = useState(() =>
    JSON.stringify(initialForm(article, initialBlogs, defaultAuthor)),
  )
  const [blogs, setBlogs] = useState(initialBlogs)
  const [busy, setBusy] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(false)

  // Helpers
  const patch = (next: Partial<ArticleFormState>) => setForm((f) => ({ ...f, ...next }))

  // Event handlers
  const handleSave = async () => {
    if (form.title.trim() === '') {
      toast.error(copy.titleRequired)
      return
    }
    setBusy(true)
    try {
      if (article) {
        await api.blog.update({ id: article.id, write: toWrite(form) })
        setSaved(JSON.stringify(form))
        toast.success(copy.saved)
        router.refresh()
      } else {
        const { id } = await api.blog.create(toWrite(form))
        setSaved(JSON.stringify(form))
        toast.success(copy.created)
        router.replace(routes.content.blogPost(id))
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : copy.saveFailed)
    } finally {
      setBusy(false)
    }
  }

  const handleDiscard = () => setForm(JSON.parse(saved) as ArticleFormState)

  const handleDelete = async () => {
    if (!article) return
    setConfirmDelete(false)
    setBusy(true)
    try {
      await api.blog.delete({ ids: [article.id] })
      toast.success(copy.deletedToast)
      router.push(routes.content.blogPosts())
    } catch (err) {
      toast.error(err instanceof Error ? err.message : copy.saveFailed)
      setBusy(false)
    }
  }

  // Render logic
  const dirty = JSON.stringify(form) !== saved
  const blogHandle = blogs.find((b) => b.id === form.blogId)?.handle ?? ''
  const liveUrl = article
    ? `${storefrontOrigin}/blogs/${article.blogHandle}/${article.handle}`
    : null

  return (
    <ProoflyDetailPage
      header={
        <PageHeader
          title={article ? article.title : copy.newTitle}
          back={{ label: copy.back, href: routes.content.blogPosts() }}
          actions={
            article ? (
              <>
                {liveUrl && article.status !== 'draft' ? (
                  <Button
                    variant="outline"
                    render={<a href={liveUrl} target="_blank" rel="noreferrer" />}
                    nativeButton={false}
                  >
                    <ExternalLink />
                    {copy.viewLive}
                  </Button>
                ) : null}
                <Button variant="outline" onClick={() => setConfirmDelete(true)} disabled={busy}>
                  {copy.delete.action}
                </Button>
              </>
            ) : (
              <Button onClick={handleSave} disabled={busy}>
                {busy ? copy.saving : copy.save}
              </Button>
            )
          }
        />
      }
      main={
        <>
          <ArticleMainCard
            title={form.title}
            body={form.body}
            excerpt={form.excerpt}
            onChange={patch}
          />
          <ArticleSeoCard
            title={form.title}
            body={form.body}
            excerpt={form.excerpt}
            seoTitle={form.seoTitle}
            seoDescription={form.seoDescription}
            handle={form.handle}
            blogHandle={blogHandle}
            storefrontOrigin={storefrontOrigin}
            onChange={patch}
          />
          <MetafieldsCard ownerType="article" ownerId={article?.id ?? null} />
        </>
      }
      side={
        <>
          <ArticleVisibilityCard
            status={form.status}
            publishedAt={form.publishedAt}
            onChange={patch}
          />
          <ArticleImageCard imageUrl={form.imageUrl} imageAlt={form.imageAlt} onChange={patch} />
          <ArticleOrganisationCard
            blogs={blogs}
            blogId={form.blogId}
            author={form.author}
            tags={form.tags}
            tagSuggestions={tags}
            onChange={patch}
            onBlogCreated={() => void api.blog.blogs().then(setBlogs)}
          />
          <TemplateSelectCard
            kind="article"
            value={form.templateSuffix}
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
        onDiscard={handleDiscard}
        saving={busy}
      />
      <ConfirmDialog
        open={confirmDelete}
        onOpenChange={setConfirmDelete}
        title={deleteCopy.title(1)}
        body={deleteCopy.body}
        confirmLabel={deleteCopy.confirm}
        cancelLabel={deleteCopy.cancel}
        busy={busy}
        onConfirm={() => void handleDelete()}
      />
    </ProoflyDetailPage>
  )
}
