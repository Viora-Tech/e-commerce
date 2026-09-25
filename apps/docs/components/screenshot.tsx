import { ImageSquare } from '@phosphor-icons/react/ssr'
import { screenshotCopy } from '../data/guides'

type ScreenshotProps = {
  name: string
  caption?: string
  aspect?: 'wide' | 'square'
}

/**
 * Framed placeholder for a UI screenshot we haven't captured yet. Swap the
 * `<Screenshot name="…" />` usage in the MDX for a real `<img>`/`next/image`
 * once art is available. `name` says which screen; `caption` says exactly which state to
 * capture it in, and stays as the caption under the real image.
 */
export default function Screenshot({ name, caption, aspect = 'wide' }: ScreenshotProps) {
  return (
    <span data-pagefind-ignore="all" className="mt-5 flex flex-col gap-2">
      <span
        className={`flex flex-col items-center justify-center gap-2 rounded-xl border border-dashed border-(--docs-border-strong) bg-(--docs-surface) p-8 text-center text-(--docs-muted) ${
          aspect === 'wide' ? 'aspect-video' : 'aspect-square max-w-xs'
        }`}
      >
        <ImageSquare size={28} weight="light" />
        <span className="text-sm font-medium">
          {screenshotCopy.label}: {name}
        </span>
        <span className="text-xs text-(--docs-subtle)">{screenshotCopy.placeholder}</span>
      </span>
      {caption && (
        <span className="text-center text-[0.8125rem] leading-relaxed text-(--docs-muted)">
          {caption}
        </span>
      )}
    </span>
  )
}
