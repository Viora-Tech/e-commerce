'use client'

import type { AutomationStep, AutomationTrigger } from '@commerce/core/marketing'
import {
  automationEditorContent,
  automationsContent,
  durationLabel,
} from '@/data/marketing-automations'
import { useCopy } from '@/hooks/use-copy'
import AutomationFlowNode from './automation-flow-node'

type AutomationFlowProps = {
  trigger: AutomationTrigger
  steps: AutomationStep[]
  /** `'trigger'` or a step id. */
  selected: string
  onSelect: (id: string) => void
  /** The "Add step" control, drawn at the end of the flow. */
  addStep: React.ReactNode
}

/** The flow canvas of the Proofly frame: trigger, then every step as a card joined by dots. */
export default function AutomationFlow({
  trigger,
  steps,
  selected,
  onSelect,
  addStep,
}: AutomationFlowProps) {
  // Hooks
  const copy = useCopy(automationEditorContent)
  const { triggers } = useCopy(automationsContent)

  // Helpers
  const describe = (step: AutomationStep): { title: string; description?: string } => {
    if (step.type === 'wait') return { title: copy.flow.wait(durationLabel(step.minutes)) }
    if (step.type === 'condition') {
      return {
        title: copy.steps.types.condition,
        description: copy.flow.condition(
          copy.steps.fields[step.field],
          copy.steps.ops[step.op],
          step.value,
        ),
      }
    }
    if (step.type === 'whatsapp') {
      return {
        title: copy.steps.types.whatsapp,
        description: step.template.name || copy.flow.noTemplate,
      }
    }
    return { title: copy.steps.types.email, description: step.subject || copy.flow.noSubject }
  }

  // Render logic
  return (
    <div className="flex flex-col items-center rounded-lg bg-muted/60 p-6">
      <AutomationFlowNode
        kind={copy.flow.trigger}
        title={triggers[trigger]}
        selected={selected === 'trigger'}
        onSelect={() => onSelect('trigger')}
      />
      {steps.map((step) => {
        const { title, description } = describe(step)
        return (
          <div key={step.id} className="flex w-full flex-col items-center">
            <span aria-hidden className="my-2 size-3 rounded-full border border-hairline bg-card" />
            <AutomationFlowNode
              kind={copy.steps.types[step.type]}
              title={title}
              description={description}
              selected={selected === step.id}
              onSelect={() => onSelect(step.id)}
            />
          </div>
        )
      })}
      <span aria-hidden className="my-2 size-3 rounded-full border border-hairline bg-card" />
      {addStep}
    </div>
  )
}
