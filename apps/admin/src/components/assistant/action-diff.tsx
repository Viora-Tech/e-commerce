import { ArrowRight } from '@commerce/ui/icons'
import { assistantContent } from '@/data/assistant'
import type { ActionView } from '@/hooks/use-assistant'
import { useCopy } from '@/hooks/use-copy'

type ActionDiffProps = {
  preview: ActionView['preview']
}

type Row = ActionView['preview']['rows'][number]

/** The server writes "—" for a field that was empty. */
function beforeOf(row: Row): string {
  return row.before === '—' ? '' : row.before
}

/** Prices and names fit on one line; descriptions and notes read better stacked. */
function isLong(row: Row): boolean {
  return row.before.length + row.after.length > 64 || /\n/.test(row.before + row.after)
}

/** The card's body: key facts as a two-column list, then each row's old and new value. */
export default function ActionDiff({ preview }: ActionDiffProps) {
  // Hooks
  const copy = useCopy(assistantContent)

  return (
    <div className="flex flex-col gap-3">
      {preview.lines.length ? (
        <dl className="grid grid-cols-[minmax(0,7rem)_minmax(0,1fr)] gap-x-4 gap-y-1.5 text-body">
          {preview.lines.map((line) => (
            <div key={line.label} className="contents">
              <dt className="text-muted-foreground">{line.label}</dt>
              <dd className="min-w-0 font-medium break-words text-ink-strong">{line.value}</dd>
            </div>
          ))}
        </dl>
      ) : null}
      {preview.rows.length ? (
        <div className="overflow-hidden rounded-lg border border-border">
          <ul className="max-h-80 divide-y divide-border overflow-y-auto text-caption">
            {preview.rows.map((row, i) =>
              isLong(row) ? (
                // biome-ignore lint/suspicious/noArrayIndexKey: rows are a fixed snapshot of the proposal
                <li key={i} className="flex flex-col gap-1.5 px-3 py-2.5">
                  <span className="font-medium text-foreground">{row.label}</span>
                  {beforeOf(row) ? (
                    <p className="line-clamp-3 break-words whitespace-pre-wrap text-muted-foreground">
                      <span className="mr-1.5 font-medium text-muted-foreground/80 uppercase">
                        {copy.card.now}
                      </span>
                      {beforeOf(row)}
                    </p>
                  ) : null}
                  <p className="break-words whitespace-pre-wrap text-ink-strong">
                    {beforeOf(row) ? (
                      <span className="mr-1.5 font-medium text-primary uppercase">
                        {copy.card.new}
                      </span>
                    ) : null}
                    {row.after}
                  </p>
                </li>
              ) : (
                <li
                  // biome-ignore lint/suspicious/noArrayIndexKey: rows are a fixed snapshot of the proposal
                  key={i}
                  className="grid grid-cols-[minmax(0,1fr)_auto] items-baseline gap-x-3 px-3 py-2"
                >
                  <span className="min-w-0 font-medium break-words text-foreground">
                    {row.label}
                  </span>
                  <span className="flex items-baseline gap-1.5 whitespace-nowrap tabular-nums">
                    {row.before ? (
                      <>
                        <span className="text-muted-foreground line-through decoration-muted-foreground/40">
                          {row.before}
                        </span>
                        <ArrowRight
                          className="size-3 shrink-0 translate-y-0.5 text-muted-foreground"
                          aria-hidden="true"
                        />
                      </>
                    ) : null}
                    <span className="font-medium text-ink-strong">{row.after}</span>
                  </span>
                </li>
              ),
            )}
          </ul>
          {preview.more > 0 ? (
            <p className="border-border border-t bg-muted/30 px-3 py-1.5 text-caption text-muted-foreground">
              {copy.card.more(preview.more)}
            </p>
          ) : null}
        </div>
      ) : null}
    </div>
  )
}
