import {
  BookOpenText,
  Code,
  CreditCard,
  Database,
  Flag,
  FlowArrow,
  Invoice,
  ListChecks,
  Package,
  PaintBrush,
  Plugs,
  PuzzlePiece,
  Receipt,
  Rocket,
  ShieldCheck,
  Sparkle,
  Stack,
  Terminal,
  Truck,
} from '@phosphor-icons/react/ssr'
import Link from 'next/link'
import { type GuideIcon, type GuideId, guides } from '../data/guides'

type RelatedGuidesProps = {
  ids: GuideId[]
}

const icons = {
  rocket: Rocket,
  checklist: ListChecks,
  flag: Flag,
  package: Package,
  receipt: Receipt,
  truck: Truck,
  paintbrush: PaintBrush,
  puzzle: PuzzlePiece,
  card: CreditCard,
  invoice: Invoice,
  shield: ShieldCheck,
  book: BookOpenText,
  sparkle: Sparkle,
  stack: Stack,
  flow: FlowArrow,
  code: Code,
  plugs: Plugs,
  database: Database,
  terminal: Terminal,
} satisfies Record<GuideIcon, unknown>

/**
 * "Related guides" cards, from the registry in data/guides.ts. Put it under a
 * `## Related guides` heading so the section shows in "On this page".
 */
export default function RelatedGuides({ ids }: RelatedGuidesProps) {
  return (
    <div className="not-prose mt-6 grid gap-3 sm:grid-cols-2">
      {ids.map((id) => {
        const guide = guides[id]
        const Icon = icons[guide.icon]
        return (
          <Link
            key={id}
            href={guide.href}
            className="docs-home-card group flex items-start gap-3 rounded-xl border p-4 no-underline transition-colors"
          >
            <span className="docs-home-card-icon inline-flex size-8 shrink-0 items-center justify-center rounded-lg">
              <Icon size={18} weight="light" />
            </span>
            <span className="flex min-w-0 flex-col gap-0.5">
              <span className="text-[0.9375rem] font-semibold tracking-tight text-(--docs-fg)">
                {guide.title}
              </span>
              <span className="text-sm leading-relaxed text-(--docs-muted)">
                {guide.description}
              </span>
            </span>
          </Link>
        )
      })}
    </div>
  )
}
