import { Plus } from '@commerce/ui/icons'
import type { Edge } from '@/lib/automation-tree'

type CanvasJointProps = {
  edge: Edge
  /** Accessible name of the + ("Add a step after Order paid"). */
  label: string
  readOnly: boolean
  /** Draw a line under the + too (more steps follow). */
  tail?: boolean
  onInsert: (edge: Edge, label: string) => void
}

/** The line between two canvas cards, with a + that opens the step picker for that spot. */
export default function CanvasJoint({
  edge,
  label,
  readOnly,
  tail = true,
  onInsert,
}: CanvasJointProps) {
  // Render logic
  return (
    <div className="flex flex-col items-center">
      <span aria-hidden="true" className="h-4 w-px bg-border" />
      {readOnly ? null : (
        <button
          type="button"
          aria-label={label}
          title={label}
          onClick={() => onInsert(edge, label)}
          className="flex size-6 items-center justify-center rounded-full border border-border bg-card text-muted-foreground transition-[color,border-color,scale] hover:border-primary hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring active:scale-(--motion-press-scale) [&_svg]:size-3.5"
        >
          <Plus />
        </button>
      )}
      {tail ? <span aria-hidden="true" className="h-4 w-px bg-border" /> : null}
    </div>
  )
}
