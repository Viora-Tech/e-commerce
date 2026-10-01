'use client'

import type { Business } from '@commerce/core'
import { ChevronDown, TriangleAlert } from '@commerce/ui/icons'
import { Button } from '@commerce/ui/shadcn/button'
import { Card, CardContent } from '@commerce/ui/shadcn/card'
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@commerce/ui/shadcn/collapsible'
import { businessGstContent } from '@/data/business-gst'
import { useCopy } from '@/hooks/use-copy'

type OtherBusinessesProps = {
  businesses: Business[]
  canManage: boolean
  onAdd: () => void
  onEdit: (business: Business) => void
}

/**
 * "Advanced": businesses other than the main one, behind a disclosure with the CA warning.
 * Open from the start once the store has one, so it is never hidden.
 */
export default function OtherBusinesses({
  businesses,
  canManage,
  onAdd,
  onEdit,
}: OtherBusinessesProps) {
  // Hooks
  const all = useCopy(businessGstContent)

  // Render logic
  const copy = all.advanced

  return (
    <Collapsible defaultOpen={businesses.length > 0}>
      <Card size="form" className="gap-0 py-0">
        <CollapsibleTrigger className="group flex w-full items-center justify-between gap-3 px-6 py-4 text-left text-body-strong text-ink-strong focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
          {copy.toggle}
          <ChevronDown
            aria-hidden="true"
            className="size-4 text-muted-foreground transition-transform group-data-[panel-open]:rotate-180"
          />
        </CollapsibleTrigger>
        <CollapsibleContent>
          <CardContent className="flex flex-col gap-4 pb-6">
            <p className="flex items-start gap-2 rounded-lg bg-warning/20 px-3 py-2 text-body text-warning-foreground dark:text-warning">
              <TriangleAlert aria-hidden="true" className="mt-0.5 size-4 shrink-0" />
              {copy.warning}
            </p>
            <div className="flex flex-col gap-1">
              <h3 className="text-body-strong text-ink-strong">{copy.heading}</h3>
              <p className="text-body text-muted-foreground">{copy.help}</p>
            </div>
            {businesses.length === 0 ? (
              <p className="text-body text-muted-foreground">{copy.none}</p>
            ) : (
              <ul className="flex flex-col divide-y divide-border rounded-lg border border-border">
                {businesses.map((b) => (
                  <li key={b.id} className="flex items-center justify-between gap-3 px-4 py-3">
                    <div className="flex min-w-0 flex-col">
                      <span className="truncate text-body-strong text-ink-strong">
                        {b.legalName}
                      </span>
                      <span className="font-mono text-caption text-muted-foreground">{b.pan}</span>
                    </div>
                    {canManage ? (
                      <Button variant="ghost" size="sm" onClick={() => onEdit(b)}>
                        {all.business.edit}
                      </Button>
                    ) : null}
                  </li>
                ))}
              </ul>
            )}
            {canManage ? (
              <Button variant="outline" className="self-start" onClick={onAdd}>
                {copy.add}
              </Button>
            ) : null}
          </CardContent>
        </CollapsibleContent>
      </Card>
    </Collapsible>
  )
}
