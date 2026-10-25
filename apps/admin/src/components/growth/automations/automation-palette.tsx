'use client'

import {
  AUTOMATION_TRIGGERS,
  type AutomationStepType,
  type AutomationTrigger,
} from '@commerce/core/marketing'
import { CheckIcon, GripVertical } from '@commerce/ui/icons'
import { cn } from '@commerce/ui/lib/utils'
import { automationEditorContent, automationsContent } from '@/data/marketing-automations'
import { useCopy } from '@/hooks/use-copy'
import { STEP_DRAG_TYPE, STEP_ICON } from '@/lib/automation-steps-ui'

type AutomationPaletteProps = {
  trigger: AutomationTrigger
  onAdd: (type: AutomationStepType) => void
}

const GROUPS: { id: 'messages' | 'logic'; types: AutomationStepType[] }[] = [
  { id: 'messages', types: ['whatsapp', 'email'] },
  { id: 'logic', types: ['wait', 'condition'] },
]

/** Figma "Automation builder" left rail: steps to drag onto the flow (or click to add), and the trigger. */
export default function AutomationPalette({ trigger, onAdd }: AutomationPaletteProps) {
  // Hooks
  const copy = useCopy(automationEditorContent)
  const { triggers } = useCopy(automationsContent)

  // Render logic
  return (
    <aside className="flex flex-col gap-5 overflow-y-auto border-border border-r p-4">
      {GROUPS.map((g) => (
        <section key={g.id} className="flex flex-col gap-1">
          <h3 className="text-eyebrow text-muted-foreground">{copy.palette[g.id]}</h3>
          {g.types.map((type) => {
            const Icon = STEP_ICON[type]
            return (
              <button
                key={type}
                type="button"
                draggable
                onDragStart={(e) => {
                  e.dataTransfer.setData(STEP_DRAG_TYPE, type)
                  e.dataTransfer.effectAllowed = 'copy'
                }}
                onClick={() => onAdd(type)}
                className="group flex items-start gap-3 rounded-md p-2 text-left transition-colors hover:bg-muted/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                <span className="flex size-8 shrink-0 items-center justify-center rounded-md border border-border bg-card [&_svg]:size-4">
                  <Icon aria-hidden="true" />
                </span>
                <span className="flex min-w-0 flex-1 flex-col">
                  <span className="text-body font-medium text-foreground">
                    {copy.steps.types[type]}
                  </span>
                  <span className="text-caption text-muted-foreground">
                    {copy.steps.hints[type]}
                  </span>
                </span>
                <GripVertical
                  className="mt-1 size-4 shrink-0 text-muted-foreground opacity-60 group-hover:opacity-100"
                  aria-hidden="true"
                />
              </button>
            )
          })}
        </section>
      ))}
      <section className="flex flex-col gap-1">
        <h3 className="text-eyebrow text-muted-foreground">{copy.palette.trigger}</h3>
        <ul className="flex flex-col">
          {AUTOMATION_TRIGGERS.map((t) => (
            <li
              key={t}
              className={cn(
                'flex items-center gap-2 rounded-md px-2 py-1.5 text-body',
                t === trigger ? 'bg-muted text-foreground' : 'text-muted-foreground',
              )}
            >
              <span
                aria-hidden="true"
                className={cn(
                  'size-1.5 rounded-full',
                  t === trigger ? 'bg-primary' : 'bg-muted-foreground/40',
                )}
              />
              <span className="flex-1">{triggers[t]}</span>
              {t === trigger ? <CheckIcon className="size-4" aria-hidden="true" /> : null}
            </li>
          ))}
        </ul>
        <p className="mt-1 text-caption text-muted-foreground">{copy.palette.triggerFixed}</p>
      </section>
      <p className="text-caption text-muted-foreground">{copy.palette.hint}</p>
    </aside>
  )
}
