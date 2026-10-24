import { APP_ICONS, APP_LOGOS } from '@commerce/core/app-logos'
import KoomerceMark from '@commerce/ui/brand'
import {
  BarChart3,
  Bell,
  CreditCard,
  Download,
  FileText,
  type IconComponent,
  Inbox,
  MessageSquare,
  Search,
  StarIcon,
} from '@commerce/ui/icons'
import { cn } from '@commerce/ui/lib/utils'

type AppTileProps = {
  id: string
  name: string
  /** The admin icon name from the catalogue, drawn when the app has no logo. */
  icon?: string | null
  /** Our own app: the tile carries a small K in its corner. */
  ours?: boolean
  size?: 'sm' | 'md' | 'lg' | 'xl'
  className?: string
}

/** The admin icon names our apps use, as the same glyphs the admin draws. */
const GLYPHS: Record<string, IconComponent> = {
  BarChart3,
  Bell,
  CreditCard,
  Download,
  FileText,
  Inbox,
  MessageSquare,
  Search,
  Star: StarIcon,
}

const SIZES = {
  sm: {
    box: 'size-9 rounded-[0.625rem]',
    logo: 'size-6',
    glyph: 'size-[1.125rem]',
    mark: 'hidden',
    text: 'text-xs',
    icon: 'size-9',
  },
  md: {
    box: 'size-12 rounded-[0.875rem]',
    logo: 'size-8',
    glyph: 'size-6',
    mark: 'size-2',
    text: 'text-sm',
    icon: 'size-12',
  },
  lg: {
    box: 'size-16 rounded-[1.125rem]',
    logo: 'size-11',
    glyph: 'size-8',
    mark: 'size-2.5',
    text: 'text-lg',
    icon: 'size-16',
  },
  xl: {
    box: 'size-20 rounded-[1.375rem] md:size-24 md:rounded-[1.625rem]',
    logo: 'size-13 md:size-16',
    glyph: 'size-10 md:size-12',
    mark: 'size-3',
    text: 'text-2xl',
    icon: 'size-20 md:size-24',
  },
} as const

const monogram = (name: string) =>
  name
    .split(/\s+/)
    .slice(0, 2)
    .map((w) => w.charAt(0))
    .join('')
    .toUpperCase()

/**
 * An app's icon. Our own apps with a designed icon draw it as is; a real company logo sits on a
 * light plate (trademarks of their owners); other own apps get a dark engraved tile with the glyph the admin uses and a small K; anything else a
 * monogram. Never an image that can break: logos are checked by the `app-catalogue` sweep.
 */
export default function AppTile({
  id,
  name,
  icon = null,
  ours = false,
  size = 'md',
  className,
}: AppTileProps) {
  // Render logic
  const dims = SIZES[size]
  const src = APP_LOGOS[id]
  const Glyph = icon ? GLYPHS[icon] : undefined
  // Our own apps: the designed icon, tile and corners included.
  const own = APP_ICONS[id]

  if (own) {
    return (
      // biome-ignore lint/performance/noImgElement: small fixed icon files; next/image adds nothing in a static export
      <img
        src={own}
        alt=""
        aria-hidden
        loading="lazy"
        decoding="async"
        className={cn('inline-block shrink-0', dims.icon, className)}
      />
    )
  }

  return (
    <span
      aria-hidden
      className={cn(
        'relative inline-flex shrink-0 items-center justify-center overflow-hidden',
        src
          ? 'bg-foreground shadow-[inset_0_0_0_1px_var(--border)]'
          : 'bg-linear-to-b from-foreground/16 to-foreground/4 text-foreground shadow-[inset_0_1px_0_0_color-mix(in_oklab,var(--foreground)_20%,transparent),inset_0_0_0_1px_color-mix(in_oklab,var(--foreground)_8%,transparent)]',
        dims.box,
        className,
      )}
    >
      {src ? (
        // biome-ignore lint/performance/noImgElement: small fixed brand files; next/image adds nothing in a static export
        <img
          src={src}
          alt=""
          loading="lazy"
          decoding="async"
          className={cn('object-contain', dims.logo)}
        />
      ) : Glyph ? (
        <Glyph className={dims.glyph} strokeWidth={1.25} />
      ) : (
        <span className={cn('font-semibold tracking-tight', dims.text)}>{monogram(name)}</span>
      )}
      {ours && !src ? (
        <KoomerceMark
          className={cn('absolute right-[14%] bottom-[14%] w-auto opacity-45', dims.mark)}
        />
      ) : null}
    </span>
  )
}
