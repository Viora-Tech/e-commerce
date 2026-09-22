'use client'

import { ExternalLink } from '@commerce/ui/icons'
import { Button } from '@commerce/ui/shadcn/button'
import { useRouter } from 'next/navigation'
import { useState } from 'react'
import { toast } from 'sonner'
import PageBody from '@/components/layout/page-body'
import PageColumns from '@/components/layout/page-columns'
import PageHeader from '@/components/layout/page-header'
import SaveBar from '@/components/layout/save-bar'
import { articleFormContent as copy } from '@/data/blog'
import { api } from '@/lib/api-client'
import ArticleImageCard from './article-image-card'
import ArticleMainCard from './article-main-card'
import ArticleOrganisationCard from './article-organisation-card'
import ArticleSeoCard from './article-seo-card'
import ArticleVisibilityCard from './article-visibility-card'
import ConfirmDeleteArticles from './confirm-delete-articles'
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
        router.replace(`/content/blog-posts/${id}`)
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
      router.push('/content/blog-posts')
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
    <PageBody width="narrow" className="kit-form gap-4">
      <SaveBar
        open={dirty}
        message={copy.unsaved}
        saveLabel={busy ? copy.saving : copy.save}
        discardLabel={copy.discard}
        onSave={handleSave}
        onDiscard={handleDiscard}
        saving={busy}
      />
      <PageHeader
        title={article ? article.title : copy.newTitle}
        breadcrumbs={[{ label: copy.back, href: '/content/blog-posts' }]}
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
      <PageColumns
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
          </>
        }
      />

      <ConfirmDeleteArticles
        count={1}
        open={confirmDelete}
        busy={busy}
        onOpenChange={setConfirmDelete}
        onConfirm={handleDelete}
      />
    </PageBody>
  )
}
