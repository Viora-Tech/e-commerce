'use client'

import { ArrowRight_ as ArrowRight } from '@commerce/ui/icons'
import { buttonVariants } from '@commerce/ui/shadcn/button'
import { useState } from 'react'
import { type ChangeTag, changelogContent as copy } from '@/data/changelog'
import ChoiceChip from '../common/choice-chip'
import PageContainer from '../common/page-container'
import WindowFrame from '../common/window-frame'

type Filter = 'All' | ChangeTag

export default function ChangelogTimeline() {
  // Hooks
  const [filter, setFilter] = useState<Filter>('All')

  // Render logic
  const entries = copy.entries.filter(
    (entry) => filter === 'All' || (entry.tags as readonly ChangeTag[]).includes(filter),
  )

  return (
    <PageContainer className="flex flex-col gap-12 pb-24">
      <fieldset
        aria-label={copy.filterLabel}
        className="m-0 min-w-0 border-0 p-0 flex justify-center gap-2"
      >
        {copy.filters.map((item) => (
          <ChoiceChip
            key={item}
            label={item}
            selected={filter === item}
            onSelect={() => setFilter(item)}
          />
        ))}
      </fieldset>
      {entries.length === 0 ? (
        <p className="text-center text-muted-foreground">{copy.empty}</p>
      ) : (
        <ol className="mx-auto flex w-full max-w-4xl flex-col">
          {entries.map((entry, index) => (
            <li
              key={entry.date}
              className="relative grid gap-4 pb-16 pl-8 md:grid-cols-[9rem_1fr] md:gap-10 md:pl-0"
            >
              <span
                aria-hidden
                className="absolute top-2 bottom-0 left-[0.3rem] w-px bg-border md:left-[9.65rem]"
              />
              <span
                aria-hidden
                className="absolute top-2 left-0 size-2.5 rounded-full border-2 border-foreground bg-background md:left-[9.25rem]"
              />
              <div className="md:sticky md:top-28 md:self-start">
                <p className="text-sm font-medium text-foreground">{entry.date}</p>
                {index === 0 && filter === 'All' ? (
                  <p className="text-xs text-muted-foreground">{copy.latest}</p>
                ) : null}
              </div>
              <div className="flex flex-col gap-4 md:pl-10">
                <ul className="flex gap-2">
                  {entry.tags.map((tag) => (
                    <li
                      key={tag}
                      className="rounded-md border border-border bg-card px-2 py-0.5 text-xs font-medium text-foreground"
                    >
                      {tag}
                    </li>
                  ))}
                </ul>
                <h2 className="text-2xl font-semibold text-balance text-foreground md:text-3xl">
                  {entry.title}
                </h2>
                <p className="text-base text-pretty text-muted-foreground">{entry.body}</p>
                {'screen' in entry && entry.screen ? (
                  <WindowFrame
                    url={entry.screen.url}
                    src={entry.screen.src}
                    alt={entry.screen.alt}
                    width={entry.screen.width}
                    height={entry.screen.height}
                  />
                ) : null}
                <a
                  href={copy.fullNoteHref}
                  className={buttonVariants({ variant: 'ghost', size: 'sm', className: 'w-fit' })}
                >
                  <ArrowRight aria-hidden />
                  {copy.readFull}
                </a>
              </div>
            </li>
          ))}
        </ol>
      )}
    </PageContainer>
  )
}
