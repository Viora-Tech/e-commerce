import { splitMatch } from '@/lib/dynamic-source-groups'

type DynamicSourceMatchProps = {
  text: string
  query: string
}

/** Picker text with the searched words marked. */
export default function DynamicSourceMatch({ text, query }: DynamicSourceMatchProps) {
  // Render logic
  const parts = splitMatch(text, query)

  return (
    <>
      {parts.map((part, i) =>
        part.match ? (
          // biome-ignore lint/suspicious/noArrayIndexKey: parts are fixed slices of one string
          <mark key={i} className="rounded-sm bg-primary/15 text-foreground">
            {part.text}
          </mark>
        ) : (
          // biome-ignore lint/suspicious/noArrayIndexKey: parts are fixed slices of one string
          <span key={i}>{part.text}</span>
        ),
      )}
    </>
  )
}
