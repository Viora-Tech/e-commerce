import { ImageSquare } from '@phosphor-icons/react/ssr'

type ScreenshotProps = {
  name: string
  aspect?: 'wide' | 'square'
}

/**
 * Framed placeholder for a UI screenshot we haven't captured yet. Swap the
 * `<Screenshot name="…" />` usage in the MDX for a real `<img>`/`next/image`
 * once art is available — the `name` is a short label for what belongs there.
 */
export default function Screenshot({ name, aspect = 'wide' }: ScreenshotProps) {
  return (
    <span
      data-pagefind-ignore="all"
      className={`mt-5 flex flex-col items-center justify-center gap-2 rounded-xl border border-dashed p-8 text-center ${
        aspect === 'wide' ? 'aspect-video' : 'aspect-square max-w-xs'
      }`}
      style={{
        borderColor: 'var(--docs-border-strong)',
        background: 'var(--docs-surface)',
        color: 'var(--docs-muted)',
      }}
    >
      <ImageSquare size={28} weight="light" />
      <span className="text-sm font-medium" style={{ color: 'inherit' }}>
        Screenshot: {name}
      </span>
      <span className="text-xs opacity-60" style={{ color: 'var(--docs-subtle)' }}>
        Placeholder — not a real screenshot yet
      </span>
    </span>
  )
}
