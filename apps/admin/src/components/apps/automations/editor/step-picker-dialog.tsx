'use client'

import {
  type ActionResource,
  type AutomationPlanTier,
  type CatalogueView,
  type SubjectType,
  tierAllows,
} from '@commerce/core/automations'
import { Clock, Lock, RefreshCw, Search, Send, ShieldCheck, Workflow } from '@commerce/ui/icons'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@commerce/ui/shadcn/dialog'
import StatusChip from '@/components/layout/status-chip'
import {
  automationEditorContent,
  automationLoopContent,
  automationPiecesContent,
} from '@/data/automations'
import { useCopy, useLocale } from '@/hooks/use-copy'
import { actionLabel } from '@/lib/automation-labels'
import { RESOURCE_ICON } from '@/lib/automation-node-view'
import type { NewStep } from '@/lib/automation-tree'
import GroupedPicker, { type PickerGroup } from '../grouped-picker'

type StepPickerDialogProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  catalogue: CatalogueView
  subject: SubjectType
  /** The store's plan, to lock pieces above it; null when unknown. */
  plan: AutomationPlanTier | null
  /** Where the step goes, read out under the title. */
  where: string
  /** The Find records a For each here would walk; null when none is above (or inside a loop). */
  loopSource: string | null
  onPick: (step: NewStep) => void
}

const RESOURCE_ORDER: ActionResource[] = [
  'orders',
  'customers',
  'products',
  'collections',
  'metafields',
  'staff-messages',
  'customer-messages',
  'external',
]

/** Flow's "+" picker: Condition, Wait, or an action grouped by what it changes, with plan and risk badges. */
export default function StepPickerDialog({
  open,
  onOpenChange,
  catalogue,
  subject,
  plan,
  where,
  loopSource,
  onPick,
}: StepPickerDialogProps) {
  // Hooks
  const copy = useCopy(automationEditorContent)
  const pieces = useCopy(automationPiecesContent)
  const loop = useCopy(automationLoopContent)
  const locale = useLocale()

  // Event handlers
  const handlePick = (id: string) => {
    if (id === 'condition' || id === 'wait' || id === 'find') return onPick({ kind: id })
    if (id === 'forEach')
      return loopSource ? onPick({ kind: 'forEach', source: loopSource }) : undefined
    const a = catalogue.actions.find((x) => x.id === id)
    if (a) onPick({ kind: 'action', action: a.id })
  }

  // Render logic
  const p = copy.picker
  const groups: PickerGroup[] = [
    {
      id: 'logic',
      label: p.logic,
      items: [
        { id: 'condition', label: p.condition, hint: p.conditionHint, icon: Workflow },
        { id: 'wait', label: p.wait, hint: p.waitHint, icon: Clock },
        { id: 'find', label: loop.find, hint: loop.findHint, icon: Search },
        {
          id: 'forEach',
          label: loop.forEach,
          hint: loopSource ? loop.forEachHint : loop.forEachNeedsFind,
          icon: RefreshCw,
          disabled: !loopSource,
        },
      ],
    },
    ...RESOURCE_ORDER.map((resource) => ({
      id: resource,
      label: p.groups[resource] ?? resource,
      items: catalogue.actions
        .filter((a) => a.resource === resource)
        .map((a) => {
          const fits = a.subjects === 'any' || a.subjects.includes(subject)
          const locked = plan !== null && !tierAllows(plan, a.planTier)
          return {
            id: a.id,
            label: actionLabel(pieces, locale, a, a.id),
            hint: fits ? undefined : p.wrongSubject,
            icon: RESOURCE_ICON[resource],
            disabled: !fits || locked,
            badges: (
              <>
                {locked ? (
                  <StatusChip tone="violet">
                    <Lock className="size-3" aria-hidden="true" />
                    {p.planLocked}
                  </StatusChip>
                ) : null}
                {a.defaultNeedsApproval ? (
                  <StatusChip tone="attention">
                    <ShieldCheck className="size-3" aria-hidden="true" />
                    {p.needsApproval}
                  </StatusChip>
                ) : null}
                {a.risk === 'sensitive' ? (
                  <StatusChip tone="neutral">{p.sensitive}</StatusChip>
                ) : null}
                {a.risk === 'customer' ? (
                  <StatusChip tone="info">
                    <Send className="size-3" aria-hidden="true" />
                    {p.messages}
                  </StatusChip>
                ) : null}
              </>
            ),
          }
        }),
    })),
  ]

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{p.title}</DialogTitle>
          <DialogDescription>{where}</DialogDescription>
        </DialogHeader>
        {open ? (
          <GroupedPicker
            groups={groups}
            searchLabel={p.search}
            emptyLabel={p.none}
            onPick={handlePick}
          />
        ) : null}
      </DialogContent>
    </Dialog>
  )
}
