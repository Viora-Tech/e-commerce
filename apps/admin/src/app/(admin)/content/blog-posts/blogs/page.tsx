import type { Metadata } from 'next'
import BlogsManager from '@/components/blog/blogs-manager'
import { blogsManageContent } from '@/data/blog'
import { appRouter, call, serverContext } from '@/lib/api'

export const metadata: Metadata = { title: blogsManageContent.heading }

export default async function Page() {
  const context = await serverContext()
  const blogs = await call(appRouter.blog.blogs, undefined, { context })
  return <BlogsManager initial={blogs} />
}
