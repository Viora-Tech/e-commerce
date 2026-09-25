import type { ComponentConfig } from '@puckeditor/core'
import BlogPosts from './components/blog-posts'
import SectionFrame from './components/section-frame'
import type { Frame, frameFields } from './puck-config'
import type { CardArticle } from './types'

/** How the "Blog posts" block gets its posts; blank handle means every blog. */
export type ArticleLoader = (query: {
  blogHandle?: string | undefined
  limit: number
}) => Promise<CardArticle[]>

export type BlogPostsProps = Frame & {
  heading: string
  blogHandle: string
  limit: number
  layout: 'grid' | 'list'
  resolved?: CardArticle[]
}

/** The "Blog posts" section: newest posts from one blog, or every blog. */
export function blogPostsBlock(
  frame: typeof frameFields,
  loadArticles: ArticleLoader | undefined,
): ComponentConfig<BlogPostsProps> {
  return {
    label: 'Blog posts',
    fields: {
      heading: { type: 'text', label: 'Heading' },
      blogHandle: { type: 'text', label: 'Blog handle (blank = all blogs)' },
      limit: { type: 'number', label: 'Posts', min: 1, max: 12 },
      layout: {
        type: 'radio',
        label: 'Layout',
        options: [
          { label: 'Grid', value: 'grid' },
          { label: 'List', value: 'list' },
        ],
      },
      ...frame,
    },
    defaultProps: {
      heading: 'From the blog',
      blogHandle: '',
      limit: 3,
      layout: 'grid',
      scheme: 'scheme-1',
      padTop: 48,
      padBottom: 48,
    },
    resolveData: async ({ props }) => ({
      props: {
        resolved: loadArticles
          ? await loadArticles({
              blogHandle: props.blogHandle || undefined,
              limit: props.limit,
            })
          : [],
      },
      readOnly: { resolved: true },
    }),
    render: ({ heading, blogHandle, layout, resolved, scheme, padTop, padBottom }) => (
      <SectionFrame scheme={scheme} padTop={padTop} padBottom={padBottom}>
        <BlogPosts
          heading={heading}
          layout={layout}
          articles={resolved ?? []}
          viewAll={blogHandle ? { href: `/blogs/${blogHandle}`, label: 'View all' } : undefined}
        />
      </SectionFrame>
    ),
  }
}
