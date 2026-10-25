import { SearchX } from '@commerce/ui/icons'
import { appsContent as copy } from '@/data/apps'

type DirectoryEmptyProps = {
  query: string
  onSuggest: (word: string) => void
  onClear: () => void
}

const SUGGESTION =
  'inline-flex h-8 items-center rounded-full bg-foreground/5 px-3.5 text-sm text-foreground ring-1 ring-border ring-inset outline-none transition-[background-color,scale] duration-(--duration-press) ease-out hover:bg-foreground/10 focus-visible:ring-3 focus-visible:ring-ring/60 active:scale-(--motion-press-scale)'

/** No app matched: say so, offer a few words that do match, and a way back to everything. */
export default function DirectoryEmpty({ query, onSuggest, onClear }: DirectoryEmptyProps) {
  return (
    <div className="flex flex-col items-center gap-5 rounded-[2rem] px-6 py-16 text-center ring-1 ring-border ring-inset md:py-24">
      <span className="inline-flex size-14 items-center justify-center rounded-2xl bg-foreground/5 ring-1 ring-border ring-inset">
        <SearchX aria-hidden className="size-6 text-muted-foreground" />
      </span>
      <div className="flex max-w-md flex-col gap-2">
        <h2 className="text-xl font-semibold tracking-tight text-balance text-foreground">
          {copy.noResultsTitle(query.trim())}
        </h2>
        <p className="text-sm text-pretty text-muted-foreground">{copy.noResultsBody}</p>
      </div>
      <div className="flex flex-wrap items-center justify-center gap-2">
        <span className="text-sm text-muted-foreground">{copy.suggestionsLabel}</span>
        {copy.suggestions.map((word) => (
          <button key={word} type="button" onClick={() => onSuggest(word)} className={SUGGESTION}>
            {word}
          </button>
        ))}
      </div>
      <button
        type="button"
        onClick={onClear}
        className="rounded-full px-2 text-sm font-medium text-foreground underline underline-offset-4 outline-none decoration-border hover:decoration-foreground focus-visible:ring-3 focus-visible:ring-ring/60"
      >
        {copy.clear}
      </button>
    </div>
  )
}
