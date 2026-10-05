import type { Metadata } from 'next'
import ArticleForm from '@/components/blog/article-form'
import { articleFormContent } from '@/data/blog'
import { appRouter, call, serverContext } from '@/lib/api'
import { storefrontOrigin } from '@/lib/storefront-origin'

export const metadata: Metadata = { title: articleFormContent.newTitle }

export default async function Page() {
  const context = await serverContext()
  const [blogs, tags, defaults] = await Promise.all([
    call(appRouter.blog.blogs, undefined, { context }),
    call(appRouter.blog.tags, undefined, { context }),
    call(appRouter.blog.defaults, undefined, { context }),
  ])

  return (
    <ArticleForm
      article={null}
      blogs={blogs}
      tags={tags}
      defaultAuthor={defaults.author}
      storefrontOrigin={await storefrontOrigin()}
    />
  )
}
