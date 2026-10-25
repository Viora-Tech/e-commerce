'use client'

import type {
  AutomationStep,
  AutomationStepType,
  AutomationTrigger,
} from '@commerce/core/marketing'
import { CircleCheck, Minus, Plus, RotateCcw, ShoppingCart } from '@commerce/ui/icons'
import { cn } from '@commerce/ui/lib/utils'
import { Button } from '@commerce/ui/shadcn/button'
import { useState } from 'react'
import SortableStack from '@/components/layout/sortable-stack'
import { reorderLabels } from '@/data/common'
import {
  automationEditorContent,
  automationsContent,
  durationLabel,
} from '@/data/marketing-automations'
import { useCopy } from '@/hooks/use-copy'
import { STEP_ICON, STEP_TONE } from '@/lib/automation-steps-ui'
import AutomationFlowJoint from './automation-flow-joint'
import AutomationFlowNode from './automation-flow-node'

type AutomationFlowProps = {
  trigger: AutomationTrigger
  steps: AutomationStep[]
  /** `'trigger'`, `'end'` or a step id. */
  selected: string
  onSelect: (id: string) => void
  /** Adds a step of this type before the step at `index` (the end when it equals the length). */
  onInsert: (type: AutomationStepType, index: number) => void
  /** The steps in a new order, after one is dragged by its grip. */
  onReorder: (steps: AutomationStep[]) => void
}

const ZOOMS = [0.5, 0.75, 0.9, 1, 1.25] as const
const DEFAULT_ZOOM = 3

/**
 * Figma "Automation builder" canvas: trigger, each step joined by a + you can click or drop on,
 * and the end. Steps reorder by dragging their grip (mouse, touch or keyboard).
 */
export default function AutomationFlow({
  trigger,
  steps,
  selected,
  onSelect,
  onInsert,
  onReorder,
}: AutomationFlowProps) {
  // Hooks
  const copy = useCopy(automationEditorContent)
  const { triggers } = useCopy(automationsContent)
  const sortLabels = useCopy(reorderLabels)
  const [zoom, setZoom] = useState(DEFAULT_ZOOM)

  // Helpers
  const describe = (step: AutomationStep): { title: string; description?: string } => {
    if (step.type === 'wait') return { title: copy.flow.wait(durationLabel(step.minutes)) }
    if (step.type === 'condition') {
      return {
        title: copy.flow.condition(
          copy.steps.fields[step.field],
          copy.steps.ops[step.op],
          step.value,
        ),
        description: copy.steps.hints.condition,
      }
    }
    if (step.type === 'whatsapp') {
      return { title: step.template.name || copy.flow.noTemplate, description: copy.flow.approved }
    }
    return { title: step.subject || copy.flow.noSubject, description: copy.steps.hints.email }
  }

  // Render logic
  const scale = ZOOMS[zoom] ?? 1

  return (
    <div className="relative min-h-0 overflow-auto bg-[radial-gradient(var(--border)_1px,transparent_1px)] [background-size:16px_16px]">
      <div
        className="flex origin-top flex-col items-center px-6 py-8"
        style={{ transform: `scale(${scale})` }}
      >
        <AutomationFlowNode
          kind={copy.flow.trigger}
          title={triggers[trigger]}
          description={copy.trigger.stops}
          icon={ShoppingCart}
          tone="bg-primary-soft text-primary"
          selected={selected === 'trigger'}
          onSelect={() => onSelect('trigger')}
        />
        <SortableStack
          items={steps}
          onReorder={onReorder}
          getTitle={(step) => copy.steps.types[step.type]}
          labels={sortLabels}
          scale={scale}
          className="flex flex-col items-center"
          renderItem={(step, { handle, isDragging }) => {
            const { title, description } = describe(step)
            const i = steps.indexOf(step)
            return (
              <div className="flex flex-col items-center">
                <AutomationFlowJoint onInsert={(type) => onInsert(type, i)} />
                <div className={cn('relative rounded-lg', isDragging && 'shadow-popover')}>
                  <span className="absolute top-1/2 -left-10 -translate-y-1/2">{handle}</span>
                  <AutomationFlowNode
                    kind={copy.steps.types[step.type]}
                    title={title}
                    description={description}
                    icon={STEP_ICON[step.type]}
                    tone={STEP_TONE[step.type]}
                    selected={selected === step.id}
                    onSelect={() => onSelect(step.id)}
                  />
                </div>
              </div>
            )
          }}
        />
        <AutomationFlowJoint onInsert={(type) => onInsert(type, steps.length)} />
        <AutomationFlowNode
          kind={copy.flow.end}
          title={copy.flow.ends}
          description={copy.flow.endsEarly}
          icon={CircleCheck}
          tone="bg-muted text-muted-foreground"
          selected={selected === 'end'}
          onSelect={() => onSelect('end')}
        />
      </div>
      <div className="sticky bottom-3 left-3 ml-3 inline-flex items-center gap-1 rounded-lg border border-border bg-card p-1 shadow-card">
        <Button
          variant="ghost"
          size="icon-sm"
          aria-label={copy.flow.zoomOut}
          disabled={zoom === 0}
          onClick={() => setZoom(zoom - 1)}
        >
          <Minus />
        </Button>
        <span className="w-12 text-center text-caption tabular-nums">
          {Math.round(scale * 100)}%
        </span>
        <Button
          variant="ghost"
          size="icon-sm"
          aria-label={copy.flow.zoomIn}
          disabled={zoom === ZOOMS.length - 1}
          onClick={() => setZoom(zoom + 1)}
        >
          <Plus />
        </Button>
        <Button
          variant="ghost"
          size="icon-sm"
          aria-label={copy.flow.zoomReset}
          onClick={() => setZoom(DEFAULT_ZOOM)}
        >
          <RotateCcw />
        </Button>
      </div>
    </div>
  )
}
