import { editorGlyphs } from '@commerce/ui/icons'
import { cn } from '@commerce/ui/lib/utils'
import { KIND_TILE, sectionGlyph, sectionKind } from '@/lib/customize-section-kinds'

type SectionIconProps = {
  type: string
  className?: string
  /**
   * Draw the glyph on its kind's small tinted tile (layout, text, media,
   * product, app). `sm` is the 20px tile for rows, `md` the 28px tile for the
   * Add panel and the inspector header. Leave it out for the bare glyph.
   */
  tile?: 'sm' | 'md'
}

const TILE_SIZE = {
  sm: 'size-5 rounded-md [&>svg]:size-3.5',
  md: 'size-7 rounded-lg [&>svg]:size-4',
} as const

/**
 * The glyph a section shows in the tree, the add menu and the inspector: one
 * Phosphor family at regular weight (`editorGlyphs`), optionally on a tile
 * tinted by the section's kind.
 */
export default function SectionIcon({ type, className, tile }: SectionIconProps) {
  // Render logic
  const Glyph = editorGlyphs[sectionGlyph(type)]
  if (!tile) return <Glyph aria-hidden className={className} />
  return (
    <span
      aria-hidden
      data-kind={sectionKind(type)}
      className={cn(
        'flex shrink-0 items-center justify-center',
        TILE_SIZE[tile],
        KIND_TILE[sectionKind(type)],
        className,
      )}
    >
      <Glyph aria-hidden />
    </span>
  )
}
