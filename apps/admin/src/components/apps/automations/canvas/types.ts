import type { CatalogueView, NodeId, WorkflowDefinition } from '@commerce/core/automations'
import type { automationEditorContent } from '@/data/automations'
import type { Edge } from '@/lib/automation-tree'
import type { Locale } from '@/lib/i18n'

/** How a run went through a node, to draw its path (run detail, test results). */
export type NodeMark = 'ran' | 'failed' | 'waiting' | 'skipped'

/** What every canvas piece needs, passed down the branch recursion as one value. */
export type CanvasContext = {
  def: WorkflowDefinition
  catalogue: CatalogueView
  pieces: Record<string, string>
  locale: Locale
  copy: typeof automationEditorContent
  /** `'trigger'`, a node id, or null. */
  selected: string | null
  /** Node ids with something to fix. */
  flagged: ReadonlySet<string>
  /** Set on run views: nodes not in here were not reached. */
  marks: Record<NodeId, NodeMark> | null
  readOnly: boolean
  onSelect: (id: string) => void
  onInsert: (edge: Edge, label: string) => void
}
