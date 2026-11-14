import { CircleAlert } from '@commerce/ui/icons'
import { Alert, AlertDescription } from '@commerce/ui/shadcn/alert'
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
        <Alert tone="info" role="status" className="py-2">
          <AlertDescription className="text-body text-foreground">
            {copy.unpublished}
          </AlertDescription>
        </Alert>
      ) : null}
      {first && !readOnly ? (
        <Alert
          tone="danger"
          role="status"
          className="items-center py-2 *:[svg]:row-span-1 *:[svg]:translate-y-0"
          action={
            <Button variant="outline" size="sm" onClick={() => onShow(first.nodeId)}>
              {copy.issues.show}
            </Button>
          }
        >
          <CircleAlert aria-hidden="true" />
          <AlertDescription className="text-body text-foreground">
            {copy.issues.title(issues.length)}: {first.message}
          </AlertDescription>
        </Alert>
      ) : null}
    </>
  )
}
