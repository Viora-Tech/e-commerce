import type { AutomationStepType } from '@commerce/core/marketing'
import { Clock, type IconComponent, Send, WhatsappLogo, Workflow } from '@commerce/ui/icons'

/** The drag payload type when a step is dragged from the palette onto the flow. */
export const STEP_DRAG_TYPE = 'application/x-automation-step'

/** Each step's glyph, shared by the palette and the flow. */
export const STEP_ICON: Record<AutomationStepType, IconComponent> = {
  whatsapp: WhatsappLogo,
  email: Send,
  wait: Clock,
  condition: Workflow,
}

/** Tint for each step's icon tile on the flow (Figma: green WhatsApp, purple email, amber condition). */
export const STEP_TONE: Record<AutomationStepType, string> = {
  whatsapp: 'bg-success-soft text-success',
  email: 'bg-primary-soft text-primary',
  wait: 'bg-muted text-muted-foreground',
  condition: 'bg-warning-soft text-warning-foreground dark:text-warning',
}
