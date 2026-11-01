import Link from 'next/link'
import { blogContent as copy } from '@/data/blog'

type TagFilterProps = { path: string; tags: string[]; active: string | undefined }

const PILL = 'rounded-[var(--radius-button)] border px-3 py-1.5 text-sm transition-colors'
/* The theme's unlayered link colour outranks utilities, so the colours are marked important. */
const IDLE = 'border-line text-muted! hover:text-ink!'
/* Filled, so the picked tag reads as picked; a surface fill on the surface page looked the same
   as All posts (#207). */
const ACTIVE = 'border-ink! bg-ink! text-surface!'

const pill = (active: boolean) => `${PILL} ${active ? ACTIVE : IDLE}`

/** Tag chips above the blog listing; each is a plain link, so filtering works without JS. */
export default function TagFilter({ path, tags, active }: TagFilterProps) {
  // Render logic
  return (
    <nav aria-label={copy.filterLabel} className="flex flex-wrap gap-2">
      <Link href={path} className={pill(!active)} aria-current={!active ? 'page' : undefined}>
        {copy.allPosts}
      </Link>
      {tags.map((tag) => (
        <Link
          key={tag}
          href={`${path}?tag=${encodeURIComponent(tag)}`}
          className={pill(active === tag)}
          aria-current={active === tag ? 'page' : undefined}
        >
          {tag}
        </Link>
      ))}
    </nav>
  )
}
