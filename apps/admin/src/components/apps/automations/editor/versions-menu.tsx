'use client'

import type { WorkflowDetail } from '@commerce/core/automations'
import { ChevronDownIcon } from '@commerce/ui/icons'
import { Button } from '@commerce/ui/shadcn/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@commerce/ui/shadcn/dropdown-menu'
import RelativeTime from '@/components/layout/relative-time'
import StatusChip from '@/components/layout/status-chip'
import { automationEditorContent } from '@/data/automations'
import { useCopy } from '@/hooks/use-copy'

type VersionsMenuProps = {
  workflow: WorkflowDetail
  unpublished: boolean
  readOnly: boolean
  onRestore: (versionId: string, number: number) => void
}

/** Version history: the draft, the live version and older ones; any can be copied back into the draft. */
export default function VersionsMenu({
  workflow,
  unpublished,
  readOnly,
  onRestore,
}: VersionsMenuProps) {
  // Hooks
  const { versions: copy, actions } = useCopy(automationEditorContent)

  // Render logic
  return (
    <DropdownMenu>
      <DropdownMenuTrigger render={<Button variant="outline" />}>
        {actions.versions}
        <ChevronDownIcon aria-hidden="true" />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-72">
        <DropdownMenuGroup>
          <DropdownMenuLabel>{copy.title}</DropdownMenuLabel>
          {unpublished || workflow.versions.length === 0 ? (
            <DropdownMenuItem disabled className="justify-between">
              {copy.draft}
            </DropdownMenuItem>
          ) : null}
        </DropdownMenuGroup>
        {workflow.versions.length === 0 ? (
          <p className="px-2 py-1.5 text-caption text-muted-foreground">{copy.none}</p>
        ) : (
          <>
            <DropdownMenuSeparator />
            {workflow.versions.map((v) => (
              <DropdownMenuItem
                key={v.id}
                disabled={readOnly}
                onClick={() => onRestore(v.id, v.number)}
                className="flex-col items-start gap-0.5"
              >
                <span className="flex w-full items-center justify-between gap-2">
                  <span className="font-medium">{copy.version(v.number)}</span>
                  {v.number === workflow.publishedVersion ? (
                    <StatusChip tone="success">{copy.live}</StatusChip>
                  ) : null}
                </span>
                <span className="text-caption text-muted-foreground">
                  <RelativeTime value={v.publishedAt} />
                  {v.publishedBy ? ` ${copy.publishedBy(v.publishedBy)}` : ''}
                  {readOnly ? '' : ` · ${copy.restore}`}
                </span>
              </DropdownMenuItem>
            ))}
          </>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
