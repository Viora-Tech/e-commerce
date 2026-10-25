import { appsContent as copy } from '@/data/apps'

type AppThemeMockProps = { blocks: string[] }

/**
 * A wireframe product page with the app's theme block picked out where a merchant would place
 * it, for apps that add blocks to the storefront. Shapes only, no invented product.
 */
export default function AppThemeMock({ blocks }: AppThemeMockProps) {
  return (
    <section className="flex flex-col gap-4 rounded-[1.5rem] bg-background p-5 ring-1 ring-border">
      <div aria-hidden className="grid grid-cols-[5.5rem_minmax(0,1fr)] gap-4">
        <span className="aspect-[4/5] rounded-xl bg-foreground/[0.06]" />
        <span className="flex min-w-0 flex-col gap-2 pt-1">
          <span className="h-2.5 w-3/4 rounded-full bg-foreground/15" />
          <span className="h-2 w-1/3 rounded-full bg-foreground/10" />
          <span className="mt-1 h-7 w-full rounded-lg bg-foreground/10" />
          {blocks.map((block) => (
            <span
              key={block}
              className="flex h-8 items-center truncate rounded-lg px-2.5 text-[0.6875rem] font-medium text-foreground ring-1 ring-foreground/60 ring-inset"
            >
              {block}
            </span>
          ))}
        </span>
      </div>
      <div className="flex flex-col gap-1">
        <h3 className="text-sm font-semibold text-foreground">{copy.themeTitle}</h3>
        <p className="text-sm text-pretty text-muted-foreground">
          {blocks.join(', ')}. {copy.themeBody}
        </p>
      </div>
    </section>
  )
}
