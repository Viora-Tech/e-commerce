'use client'

import { ChevronDown, ChevronRight } from '@commerce/ui/icons'
import { Card, CardContent } from '@commerce/ui/shadcn/card'
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@commerce/ui/shadcn/collapsible'
import { Switch } from '@commerce/ui/shadcn/switch'
import { shippingSettingsContent } from '@/data/shipping'
import { useCopy } from '@/hooks/use-copy'

type DemoCourierSectionProps = {
  on: boolean
  onChange: (on: boolean) => void
}

/** Advanced, development only: the pretend courier, saved with the page's other edits. */
export default function DemoCourierSection({ on, onChange }: DemoCourierSectionProps) {
  // Hooks
  const setupCopy = useCopy(shippingSettingsContent)

  // Render logic
  const copy = setupCopy.advanced

  return (
    <Collapsible>
      <CollapsibleTrigger className="group flex w-fit items-center gap-1.5 text-body font-medium text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
        <ChevronDown aria-hidden="true" className="hidden size-4 group-data-[panel-open]:block" />
        <ChevronRight aria-hidden="true" className="size-4 group-data-[panel-open]:hidden" />
        {copy.heading}
        <span className="font-normal text-muted-foreground">· {copy.help}</span>
      </CollapsibleTrigger>
      <CollapsibleContent>
        <Card className="mt-3">
          <CardContent className="flex items-start gap-3">
            <div className="flex flex-1 flex-col gap-0.5">
              <label htmlFor="shipping-demo-courier" className="text-body font-medium">
                {copy.demo}
              </label>
              <p className="text-caption text-muted-foreground">{copy.demoHelp}</p>
            </div>
            <Switch id="shipping-demo-courier" checked={on} onCheckedChange={onChange} />
          </CardContent>
        </Card>
      </CollapsibleContent>
    </Collapsible>
  )
}
