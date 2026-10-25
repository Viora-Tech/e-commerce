'use client'

import type { AutomationStepType } from '@commerce/core/marketing'
import { Plus } from '@commerce/ui/icons'
import { cn } from '@commerce/ui/lib/utils'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@commerce/ui/shadcn/dropdown-menu'
import { useState } from 'react'
import { automationEditorContent } from '@/data/marketing-automations'
import { useCopy } from '@/hooks/use-copy'
import { STEP_DRAG_TYPE } from '@/lib/automation-steps-ui'

type AutomationFlowJointProps = {
  onInsert: (type: AutomationStepType) => void
}

const STEP_TYPES: AutomationStepType[] = ['wait', 'email', 'whatsapp', 'condition']

/** The line and + between two flow cards: click for the step menu, or drop a step from the palette. */
export default function AutomationFlowJoint({ onInsert }: AutomationFlowJointProps) {
  // Hooks
  const copy = useCopy(automationEditorContent)
  const [over, setOver] = useState(false)

  // Event handlers
  const handleDrop = (e: React.DragEvent) => {
    const type = e.dataTransfer.getData(STEP_DRAG_TYPE) as AutomationStepType
    setOver(false)
    if (STEP_TYPES.includes(type)) onInsert(type)
  }

  // Render logic
  return (
    // biome-ignore lint/a11y/noStaticElementInteractions: drop target only; the + menu is the accessible way to add a step.
    <div
      className="flex flex-col items-center"
      onDragOver={(e) => {
        if (!e.dataTransfer.types.includes(STEP_DRAG_TYPE)) return
        e.preventDefault()
        setOver(true)
      }}
      onDragLeave={() => setOver(false)}
      onDrop={handleDrop}
    >
      <span aria-hidden="true" className="h-4 w-px bg-border" />
      <DropdownMenu>
        <DropdownMenuTrigger
          render={
            <button
              type="button"
              aria-label={copy.steps.add}
              className={cn(
                'flex size-5 items-center justify-center rounded-full border border-border bg-card text-muted-foreground transition-colors hover:text-foreground [&_svg]:size-3',
                over && 'size-7 border-primary text-primary',
              )}
            />
          }
        >
          <Plus />
        </DropdownMenuTrigger>
        <DropdownMenuContent align="center" className="w-64">
          {STEP_TYPES.map((t) => (
            <DropdownMenuItem
              key={t}
              onClick={() => onInsert(t)}
              className="flex-col items-start gap-0"
            >
              <span className="font-medium">{copy.steps.types[t]}</span>
              <span className="text-caption text-muted-foreground">{copy.steps.hints[t]}</span>
            </DropdownMenuItem>
          ))}
        </DropdownMenuContent>
      </DropdownMenu>
      <span aria-hidden="true" className="h-4 w-px bg-border" />
    </div>
  )
}
