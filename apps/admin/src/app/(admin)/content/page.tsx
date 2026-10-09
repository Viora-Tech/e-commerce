import type { Metadata } from 'next'
import ContentHub, { type ContentHubFacts } from '@/components/content/content-hub'
import { appRouter, call, serverContext } from '@/lib/api'

export const metadata: Metadata = { title: 'Content' }

/** A card's facts are optional: a member without that permission just sees the card without a count. */
const orNull = <T,>(p: Promise<T>) => p.catch(() => null)

export default async function Page() {
  const context = await serverContext()
  const [files, types, menus, counts] = await Promise.all([
    orNull(call(appRouter.media.list, { page: 1, perPage: 1 }, { context })),
    orNull(call(appRouter.metaobjects.definitions, undefined, { context })),
    orNull(call(appRouter.navigation.list, undefined, { context })),
    orNull(call(appRouter.blog.counts, undefined, { context })),
  ])
  const facts: ContentHubFacts = {
    files: files ? { total: files.total } : null,
    contentTypes: types ? { names: types.map((d) => d.name) } : null,
    menus: menus ? { names: menus.map((m) => m.title) } : null,
    blogPosts: counts ? { posts: counts.all, drafts: counts.draft } : null,
  }
  return <ContentHub facts={facts} />
}
