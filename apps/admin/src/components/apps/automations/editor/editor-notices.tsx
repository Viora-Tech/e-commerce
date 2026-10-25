import { CircleAlert } from '@commerce/ui/icons'
import { Button } from '@commerce/ui/shadcn/button'
import { automationEditorContent } from '@/data/automations'
import { useCopy } from '@/hooks/use-copy'
import type { EditorIssue } from '@/lib/automation-issues'

type EditorNoticesProps = {
  readOnly: boolean
  /** A Growth marketing automation opened here. */
  growth: boolean
  /** The draft differs from a live version. */
  unpublished: boolean
  issues: EditorIssue[]
  /** Selects the step with the first issue (null: the trigger). */
  onShow: (nodeId: string | null) => void
}

/** The lines above the canvas: view only, Growth origin, unpublished changes, things to fix. */
export default function EditorNotices({
  readOnly,
  growth,
  unpublished,
  issues,
  onShow,
}: EditorNoticesProps) {
  // Hooks
  const copy = useCopy(automationEditorContent)

  // Render logic
  const first = issues[0]

  return (
    <>
      {readOnly ? <p className="text-caption text-muted-foreground">{copy.readOnly}</p> : null}
      {growth ? <p className="text-caption text-muted-foreground">{copy.growthOrigin}</p> : null}
      {unpublished ? (
        <p className="rounded-md border border-info/30 bg-info-soft px-3 py-2 text-body text-info">
          {copy.unpublished}
        </p>
      ) : null}
      {first && !readOnly ? (
        <div
          role="status"
          className="flex items-center justify-between gap-3 rounded-md border border-danger/30 bg-danger-soft px-3 py-2 text-body text-danger"
        >
          <span className="flex items-center gap-2">
            <CircleAlert className="size-4 shrink-0" aria-hidden="true" />
            {copy.issues.title(issues.length)}: {first.message}
          </span>
          <Button variant="outline" size="sm" onClick={() => onShow(first.nodeId)}>
            {copy.issues.show}
          </Button>
        </div>
      ) : null}
    </>
  )
}
