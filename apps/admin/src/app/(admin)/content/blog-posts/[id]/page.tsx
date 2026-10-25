import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import ArticleForm from '@/components/blog/article-form'
import { articleFormContent } from '@/data/blog'
import { appRouter, call, serverContext } from '@/lib/api'
import { storefrontOrigin } from '@/lib/storefront-origin'

export const metadata: Metadata = { title: articleFormContent.editTitle }

type Props = { params: Promise<{ id: string }> }

export default async function Page({ params }: Props) {
  const { id } = await params
  const context = await serverContext()
  const [article, blogs, tags] = await Promise.all([
    call(appRouter.blog.get, { id }, { context }).catch(() => null),
    call(appRouter.blog.blogs, undefined, { context }),
    call(appRouter.blog.tags, undefined, { context }),
  ])
  if (!article) notFound()

  return (
    <ArticleForm
      article={article}
      blogs={blogs}
      tags={tags}
      defaultAuthor={article.author}
      storefrontOrigin={await storefrontOrigin()}
    />
  )
}
