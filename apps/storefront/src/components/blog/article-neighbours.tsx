import Link from 'next/link'
import { blogContent as copy } from '@/data/blog'

type Neighbour = { title: string; handle: string } | null

type ArticleNeighboursProps = { blogPath: string; previous: Neighbour; next: Neighbour }

/** Older and newer posts in the same blog, by publish date. */
export default function ArticleNeighbours({ blogPath, previous, next }: ArticleNeighboursProps) {
  // Early returns
  if (!previous && !next) return null

  // Render logic
  return (
    <nav className="grid gap-4 sm:grid-cols-2" aria-label={copy.allPosts}>
      {previous ? (
        <Link
          href={`${blogPath}/${previous.handle}`}
          className="flex flex-col gap-1 rounded-section border border-line p-4 transition-[border-color,scale] duration-(--duration-press) ease-out hover:border-ink active:scale-(--motion-card-press-scale)"
        >
          <span className="text-caption text-muted">{copy.olderPost}</span>
          <span className="text-ink">{previous.title}</span>
        </Link>
      ) : (
        <span />
      )}
      {next ? (
        <Link
          href={`${blogPath}/${next.handle}`}
          className="flex flex-col gap-1 rounded-section border border-line p-4 text-right transition-[border-color,scale] duration-(--duration-press) ease-out hover:border-ink active:scale-(--motion-card-press-scale)"
        >
          <span className="text-caption text-muted">{copy.newerPost}</span>
          <span className="text-ink">{next.title}</span>
        </Link>
      ) : null}
    </nav>
  )
}
