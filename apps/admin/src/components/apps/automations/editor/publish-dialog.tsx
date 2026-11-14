'use client'

import { CircleAlert, Lock, ShieldCheck } from '@commerce/ui/icons'
import { Button } from '@commerce/ui/shadcn/button'
import { Dialog, DialogDescription, DialogTitle } from '@commerce/ui/shadcn/dialog'
import { Field, FieldLabel } from '@commerce/ui/shadcn/field'
import { Input } from '@commerce/ui/shadcn/input'
import { Switch } from '@commerce/ui/shadcn/switch'
import { useState } from 'react'
import DialogContent from '@/components/layout/dialog-content'
import DialogFooter from '@/components/layout/dialog-footer'
import DialogHeader from '@/components/layout/dialog-header'
import { automationEditorContent } from '@/data/automations'
import { useCopy } from '@/hooks/use-copy'

type PublishDialogProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  workflowName: string
  /** Titles of the sensitive steps (cancel, fulfil, HTTP); typing the name is asked when any. */
  sensitive: string[]
  /** A Cancel order step that waits for approval. */
  asksApproval: boolean
  /** No test was run on this draft yet. */
  untested: boolean
  /** Problems found before (client) or by the server's publish check. */
  issues: { nodeId: string | null; message: string }[]
  /** First publish: offer to switch it on. */
  firstPublish: boolean
  /** The workflow is on now; later publishes keep its state. */
  on: boolean
  busy: boolean
  onTest: () => void
  onPublish: (input: { confirmName?: string; turnOn: boolean }) => void
}

/** Publish with confirmation: what goes live, sensitive steps typed-confirmed, approvals explained. */
export default function PublishDialog({
  open,
  onOpenChange,
  workflowName,
  sensitive,
  asksApproval,
  untested,
  issues,
  firstPublish,
  on,
  busy,
  onTest,
  onPublish,
}: PublishDialogProps) {
  // Hooks
  const { publish: copy } = useCopy(automationEditorContent)
  const [typed, setTyped] = useState('')
  const [turnOn, setTurnOn] = useState(true)

  // Render logic
  const needsName = sensitive.length > 0
  const nameOk = !needsName || typed.trim() === workflowName.trim()
  const blocked = issues.length > 0

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!next) setTyped('')
        onOpenChange(next)
      }}
    >
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{copy.title}</DialogTitle>
          <DialogDescription>{copy.body}</DialogDescription>
        </DialogHeader>
        <div className="flex flex-col gap-4">
          {blocked ? (
            <div className="flex flex-col gap-1.5 rounded-md border border-danger/30 bg-danger-soft px-3 py-2 text-body text-danger">
              <p className="font-medium">{copy.blocked}</p>
              <ul className="flex flex-col gap-1 text-caption">
                {issues.map((i) => (
                  <li key={`${i.nodeId}-${i.message}`} className="flex items-center gap-1.5">
                    <CircleAlert className="size-3.5 shrink-0" aria-hidden="true" />
                    {i.message}
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
          {untested && !blocked ? (
            <div className="flex items-center justify-between gap-3 rounded-md border border-border px-3 py-2 text-body">
              <span>{copy.untested}</span>
              <Button variant="outline" size="sm" onClick={onTest}>
                {copy.testFirst}
              </Button>
            </div>
          ) : null}
          {asksApproval ? (
            <p className="flex items-start gap-2 text-caption text-muted-foreground">
              <ShieldCheck className="mt-0.5 size-3.5 shrink-0" aria-hidden="true" />
              {copy.approvalNote}
            </p>
          ) : null}
          {needsName && !blocked ? (
            <div className="flex flex-col gap-2">
              <p className="flex items-center gap-1.5 text-body font-medium">
                <Lock className="size-3.5" aria-hidden="true" />
                {copy.sensitive}
              </p>
              <ul className="list-disc pl-5 text-body text-muted-foreground">
                {sensitive.map((s) => (
                  <li key={s}>{s}</li>
                ))}
              </ul>
              <Field>
                <FieldLabel htmlFor="publish-confirm-name">
                  {copy.typeName(workflowName)}
                </FieldLabel>
                <Input
                  id="publish-confirm-name"
                  value={typed}
                  autoComplete="off"
                  onChange={(e) => setTyped(e.target.value)}
                />
              </Field>
            </div>
          ) : null}
          {firstPublish && !blocked ? (
            <label
              htmlFor="publish-turn-on"
              className="flex items-center justify-between gap-3 text-body"
            >
              <span>{copy.turnOn}</span>
              <Switch id="publish-turn-on" checked={turnOn} onCheckedChange={setTurnOn} />
            </label>
          ) : null}
        </div>
        <DialogFooter>
          <Button
            loading={busy}
            disabled={blocked || !nameOk || busy}
            onClick={() =>
              onPublish({
                ...(needsName ? { confirmName: typed.trim() } : {}),
                turnOn: firstPublish ? turnOn : on,
              })
            }
          >
            {copy.confirm}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
