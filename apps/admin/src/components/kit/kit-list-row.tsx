import Link from 'next/link'
import KitThumb from './kit-thumb'

type KitListRowProps = {
  href?: string
  image: string | null
  title: string
  /** Second line, 12px Neutral/400 ("Item: #FXZ-4567"). */
  meta: string
  /** Right-aligned 15/700 Cyprus figure. */
  value: string
}

/* Sheet 14:873 "Top Products" row: 56px radius-12 thumb, 16px gap, name 15/500 Cyprus,
   meta 12 Neutral/400, value 15/700 lh 22 on the right, 8px bottom inset over a #d1d1d1 hairline. */
const ROW = 'flex items-center gap-4 border-line-list border-b pr-2 pb-2'

export default function KitListRow({ href, image, title, meta, value }: KitListRowProps) {
  // Render logic
  const body = (
    <>
      <KitThumb src={image} alt="" size="list" />
      <span className="flex min-w-0 flex-1 flex-col justify-center gap-1">
        <span className="truncate text-kit-name text-ink-strong">{title}</span>
        <span className="truncate text-kit-mini text-muted-foreground-soft">{meta}</span>
      </span>
      <span className="shrink-0 text-right text-kit-price text-ink-strong">{value}</span>
    </>
  )

  if (href) {
    return (
      <Link href={href} className={`${ROW} transition-colors hover:bg-background`}>
        {body}
      </Link>
    )
  }
  return <div className={ROW}>{body}</div>
}
