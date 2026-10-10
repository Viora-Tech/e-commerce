import { highlightParts } from '@/lib/palette-search'

type PaletteHighlightProps = {
  text: string
  query: string
}

/** `text` with the typed words picked out, so it is clear why a row matched. */
export default function PaletteHighlight({ text, query }: PaletteHighlightProps) {
  return highlightParts(text, query).map((part, i) =>
    part.match ? (
      // biome-ignore lint/suspicious/noArrayIndexKey: parts are positional slices of one string
      <mark key={i} className="rounded-xs bg-glass-active px-px text-glass-active-ink">
        {part.text}
      </mark>
    ) : (
      // biome-ignore lint/suspicious/noArrayIndexKey: parts are positional slices of one string
      <span key={i}>{part.text}</span>
    ),
  )
}
