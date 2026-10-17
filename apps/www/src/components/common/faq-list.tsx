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
          <AccordionTrigger className="items-center rounded-none py-5 text-lg font-semibold text-foreground hover:no-underline">
            {item.question}
          </AccordionTrigger>
          <AccordionContent className="pb-6 text-base text-pretty text-muted-foreground">
            {item.answer}
          </AccordionContent>
        </AccordionItem>
      ))}
    </Accordion>
  )
}
