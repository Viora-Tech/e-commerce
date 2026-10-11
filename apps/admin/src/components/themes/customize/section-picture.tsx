import { cn } from '@commerce/ui/lib/utils'
import { customizeContent } from '@/data/customize'
import { SECTION_PREVIEWS } from '@/lib/section-previews'

type SectionPictureProps = {
  type: string
  label: string
  /** `tile`: the Add panel's 8 × 5.5 rem tile (fills it); `card`: the hover card, its own shape. */
  fit: 'tile' | 'card'
  className?: string
}

const copy = customizeContent.addSection

/** Below this height-to-width, a section is a band (an announcement bar) and is shown whole. */
const BAND = 0.3

/** The picture's path; `bun run section-previews` writes both files for every listed type. */
const src = (type: string, dark: boolean) => `/section-previews/${type}${dark ? '-dark' : ''}.webp`

/** Whether `bun run section-previews` made a picture of this section type. */
export const hasSectionPicture = (type: string): boolean => type in SECTION_PREVIEWS

/**
 * The section drawn with its default settings and the default theme, light or dark with the
 * admin (pictures from `bun run section-previews`, apps/admin/scripts/section-previews).
 */
export default function SectionPicture({ type, label, fit, className }: SectionPictureProps) {
  // Render logic
  const ratio = SECTION_PREVIEWS[type] ?? BAND
  const band = fit === 'tile' && ratio < BAND
  const imageClass = cn(
    'size-full',
    fit === 'card' ? 'object-cover' : band ? 'object-contain px-1.5' : 'object-cover object-top',
  )

  return (
    <span
      className={cn(
        'relative flex overflow-hidden bg-muted',
        fit === 'tile' &&
          'transition-transform duration-150 ease-[cubic-bezier(0.25,1,0.5,1)] group-active/card:scale-[0.97] motion-reduce:transition-none',
        className,
      )}
      style={fit === 'card' ? { aspectRatio: `1 / ${ratio}` } : undefined}
    >
      {/* biome-ignore lint/performance/noImgElement: small static webp files from public/, already sized. */}
      <img
        src={src(type, false)}
        alt={copy.picture(label)}
        loading="lazy"
        decoding="async"
        draggable={false}
        className={cn(imageClass, 'dark:hidden')}
      />
      {/* biome-ignore lint/performance/noImgElement: as above, the dark-mode file. */}
      <img
        src={src(type, true)}
        alt=""
        loading="lazy"
        decoding="async"
        draggable={false}
        className={cn(imageClass, 'hidden dark:block')}
      />
    </span>
  )
}
