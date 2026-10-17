import { Minus_ as Minus, Plus_ as Plus } from '@commerce/ui/icons'
import { cn } from '@commerce/ui/lib/utils'
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@commerce/ui/shadcn/accordion'

export type FaqEntry = { question: string; answer: string }

type FaqListProps = { items: readonly FaqEntry[]; defaultOpen?: number; className?: string }

export default function FaqList({ items, defaultOpen, className }: FaqListProps) {
  const defaultValue = defaultOpen === undefined ? [] : [`faq-${defaultOpen}`]
  return (
    <Accordion defaultValue={defaultValue} className={cn('w-full', className)}>
      {items.map((item, index) => (
        <AccordionItem key={item.question} value={`faq-${index}`} className="border-border">
          <AccordionTrigger className="items-center rounded-none py-5 text-lg font-semibold text-foreground hover:no-underline **:data-[slot=accordion-trigger-icon]:hidden">
            {item.question}
            <Plus
              aria-hidden
              className="size-4 shrink-0 text-muted-foreground transition-transform duration-(--duration-popover) ease-out group-aria-expanded/accordion-trigger:hidden"
            />
            <Minus
              aria-hidden
              className="hidden size-4 shrink-0 text-muted-foreground group-aria-expanded/accordion-trigger:block"
            />
          </AccordionTrigger>
          <AccordionContent className="pb-6 text-base text-pretty text-muted-foreground">
            <span className="block translate-y-2 opacity-0 transition-[opacity,translate] delay-100 duration-500 ease-(--ease-out) in-data-open:translate-y-0 in-data-open:opacity-100 motion-reduce:translate-y-0 motion-reduce:opacity-100">
              {item.answer}
            </span>
          </AccordionContent>
        </AccordionItem>
      ))}
    </Accordion>
  )
}
