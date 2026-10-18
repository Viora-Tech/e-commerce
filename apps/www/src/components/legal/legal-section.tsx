import { AiIcon } from '@commerce/ui/icons'
import { legalContent as copy } from '@/data/legal'
import type { LegalSection as LegalSectionData } from '@/data/legal/types'

type LegalSectionProps = { section: LegalSectionData; number: number }

export default function LegalSection({ section, number }: LegalSectionProps) {
  return (
    <section
      id={section.id}
      className="scroll-mt-28 border-t border-border pt-10 first:border-t-0 first:pt-0"
    >
      <h2 className="flex items-baseline gap-3 text-2xl font-semibold text-foreground">
        <span className="font-mono text-sm text-muted-foreground">
          {String(number).padStart(2, '0')}
        </span>
        {section.title}
      </h2>
      <div className="surface-card mt-5 rounded-2xl p-5">
        <p className="flex items-center gap-2 text-eyebrow">
          <AiIcon aria-hidden className="size-3.5" />
          {copy.plainWords}
        </p>
        <ul className="mt-3 flex flex-col gap-2 text-sm text-foreground">
          {section.plain.map((line) => (
            <li key={line} className="flex gap-3">
              <span
                aria-hidden
                className="mt-2 size-1.5 shrink-0 rounded-full bg-muted-foreground"
              />
              {line}
            </li>
          ))}
        </ul>
      </div>
      {section.body.map((paragraph) => (
        <p key={paragraph} className="mt-5 text-base leading-7 text-pretty text-muted-foreground">
          {paragraph}
        </p>
      ))}
      {section.callout ? (
        <aside className="mt-5 rounded-2xl border border-border-strong bg-muted/50 p-5">
          <p className="text-sm font-semibold text-foreground">{section.callout.title}</p>
          <p className="mt-1 text-sm text-muted-foreground">{section.callout.text}</p>
        </aside>
      ) : null}
    </section>
  )
}
