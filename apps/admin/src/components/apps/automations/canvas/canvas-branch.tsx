import { cn } from '@commerce/ui/lib/utils'
import { nodeView } from '@/lib/automation-node-view'
import { childAt, type Edge } from '@/lib/automation-tree'
import CanvasJoint from './canvas-joint'
import CanvasNode from './canvas-node'
import type { CanvasContext } from './types'

type CanvasBranchProps = {
  ctx: CanvasContext
  /** The edge this stretch hangs from. */
  edge: Edge
  /** Words for the edge's + ("Add a step after Order paid"). */
  insertLabel: string
}

/**
 * The steps hanging from one edge, top to bottom: a + joint, then the node (a condition splits
 * into Then and Otherwise columns, each its own branch), until the branch ends.
 */
export default function CanvasBranch({ ctx, edge, insertLabel }: CanvasBranchProps) {
  // Early returns
  const { copy } = ctx
  const id = childAt(ctx.def, edge)
  const node = id ? ctx.def.nodes[id] : undefined
  if (!node) {
    return (
      <div className="flex flex-col items-center">
        <CanvasJoint
          edge={edge}
          label={insertLabel}
          readOnly={ctx.readOnly}
          onInsert={ctx.onInsert}
        />
        <span className="rounded-full border border-border border-dashed px-3 py-0.5 text-caption text-muted-foreground">
          {copy.canvas.end}
        </span>
      </div>
    )
  }

  // Render logic
  const view = nodeView(node, ctx)
  const mark = ctx.marks ? (ctx.marks[node.id] ?? 'unreached') : undefined

  return (
    <div className="flex flex-col items-center">
      <CanvasJoint
        edge={edge}
        label={insertLabel}
        readOnly={ctx.readOnly}
        onInsert={ctx.onInsert}
      />
      <CanvasNode
        id={node.id}
        kind={view.kind}
        title={view.title}
        detail={view.detail}
        icon={view.icon}
        tone={view.tone}
        selected={ctx.selected === node.id}
        flagged={ctx.flagged.has(node.id)}
        asks={view.asks}
        sensitive={view.sensitive}
        messages={view.messages}
        mark={mark}
        labels={{
          issue: copy.canvas.issue,
          asks: copy.canvas.asks,
          sensitive: copy.canvas.sensitive,
          messages: copy.canvas.messages,
        }}
        onSelect={ctx.onSelect}
      />
      {node.kind === 'condition' ? (
        <>
          <span aria-hidden="true" className="h-4 w-px bg-border" />
          <div className="flex items-start">
            {(['next', 'otherwise'] as const).map((branch, i) => {
              const name = branch === 'next' ? copy.canvas.thenBranch : copy.canvas.otherwise
              return (
                <div key={branch} className="relative flex flex-col items-center px-4">
                  <span
                    aria-hidden="true"
                    className={cn(
                      'absolute top-0 h-px bg-border',
                      i === 0 ? 'right-0 left-1/2' : 'right-1/2 left-0',
                    )}
                  />
                  <span aria-hidden="true" className="h-3 w-px bg-border" />
                  <span
                    className={cn(
                      'rounded-full px-2.5 py-0.5 text-caption font-medium',
                      branch === 'next'
                        ? 'bg-success-soft text-success'
                        : 'bg-muted text-muted-foreground',
                    )}
                  >
                    {name}
                  </span>
                  <CanvasBranch
                    ctx={ctx}
                    edge={{ parent: node.id, branch }}
                    insertLabel={copy.canvas.addOn(name, view.title)}
                  />
                </div>
              )
            })}
          </div>
        </>
      ) : (
        <CanvasBranch
          ctx={ctx}
          edge={{ parent: node.id, branch: 'next' }}
          insertLabel={copy.canvas.addAfter(view.title)}
        />
      )}
    </div>
  )
}
