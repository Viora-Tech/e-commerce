/**
 * How one Automations step looks on the canvas: kind, title, detail line, glyph, tint and the
 * risk badges (asks first, sensitive, messages customers). Pure; the copy comes from `useCopy`.
 */
import {
  type ActionResource,
  type ActionView,
  type CatalogueView,
  nodeNeedsApproval,
  type TriggerView,
  type WorkflowDefinition,
  type WorkflowNode,
} from '@commerce/core/automations'
import {
  Bell,
  Boxes,
  Braces,
  ClipboardList,
  Clock,
  type IconComponent,
  Megaphone,
  Package,
  Pencil,
  RefreshCw,
  Search,
  Send,
  ShoppingCart,
  Users,
  Workflow,
} from '@commerce/ui/icons'
import { type automationEditorContent, automationLoopContent } from '@/data/automations'
import { actionDetail, actionLabel, conditionSummary, durationText } from '@/lib/automation-labels'
import type { Locale } from '@/lib/i18n'

export const RESOURCE_ICON: Record<ActionResource, IconComponent> = {
  orders: ShoppingCart,
  customers: Users,
  products: Package,
  collections: Boxes,
  metafields: ClipboardList,
  'staff-messages': Bell,
  'customer-messages': Send,
  external: Braces,
}

export const TRIGGER_GROUP_ICON: Record<TriggerView['group'], IconComponent> = {
  orders: ShoppingCart,
  customers: Users,
  products: Package,
  inventory: Boxes,
  marketing: Megaphone,
  schedule: Bell,
  manual: Pencil,
}

export const KIND_TONE = {
  trigger: 'bg-primary-soft text-primary',
  condition: 'bg-warning-soft text-warning-foreground dark:text-warning',
  action: 'bg-info-soft text-info',
  wait: 'bg-muted text-muted-foreground',
  loop: 'bg-violet-soft text-violet',
} as const

export type NodeView = {
  kind: string
  title: string
  detail: string | null
  icon: IconComponent
  tone: string
  asks: boolean
  sensitive: boolean
  messages: boolean
}

export function nodeView(
  node: WorkflowNode,
  ctx: {
    catalogue: CatalogueView
    pieces: Record<string, string>
    locale: Locale
    copy: typeof automationEditorContent
    /** Find records / For each words; English when the caller has none. */
    loop?: typeof automationLoopContent | undefined
    /** For a For each's title: its source step. */
    def?: WorkflowDefinition | undefined
  },
): NodeView {
  const { copy } = ctx
  if (node.kind === 'find' || node.kind === 'forEach') {
    const l = ctx.loop ?? automationLoopContent
    const find = node.kind === 'find' ? node : null
    const source = node.kind === 'forEach' ? ctx.def?.nodes[node.source] : null
    const sourceTitle =
      source?.kind === 'find'
        ? source.label || l.findTitle(source.limit, l.resources[source.resource] ?? '')
        : l.noSource
    return {
      kind: find ? l.find : l.forEach,
      title:
        node.label ||
        (find
          ? l.findTitle(find.limit, l.resources[find.resource] ?? find.resource)
          : l.forEachTitle(sourceTitle)),
      detail: null,
      icon: find ? Search : RefreshCw,
      tone: KIND_TONE.loop,
      asks: false,
      sensitive: false,
      messages: false,
    }
  }
  if (node.kind === 'wait') {
    return {
      kind: copy.canvas.wait,
      title: node.label || copy.canvas.waitFor(durationText(node.minutes, copy.panel.units)),
      detail: null,
      icon: Clock,
      tone: KIND_TONE.wait,
      asks: false,
      sensitive: false,
      messages: false,
    }
  }
  if (node.kind === 'condition') {
    const summary = conditionSummary(node.rules, ctx.pieces, ctx.catalogue.fields, copy.condition)
    return {
      kind: copy.canvas.condition,
      title: node.label || summary || copy.canvas.emptyCondition,
      detail: node.label ? summary : null,
      icon: Workflow,
      tone: KIND_TONE.condition,
      asks: false,
      sensitive: false,
      messages: false,
    }
  }
  const a: ActionView | null = ctx.catalogue.actions.find((x) => x.id === node.action) ?? null
  return {
    kind: copy.canvas.action,
    title: node.label || actionLabel(ctx.pieces, ctx.locale, a, node.action),
    detail: actionDetail(node),
    icon: a ? RESOURCE_ICON[a.resource] : Braces,
    tone: KIND_TONE.action,
    asks: a ? nodeNeedsApproval(a, node.needsApproval) : false,
    sensitive: a?.risk === 'sensitive',
    messages: a?.risk === 'customer',
  }
}
