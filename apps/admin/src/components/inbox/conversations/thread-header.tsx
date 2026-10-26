'use client'

import { ChevronLeftIcon, MoreHorizontal, UserRound } from '@commerce/ui/icons'
import { Button } from '@commerce/ui/shadcn/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@commerce/ui/shadcn/dropdown-menu'
import StatusChip from '@/components/layout/status-chip'
import { inboxConversationsContent } from '@/data/inbox-conversations'
import { useCopy } from '@/hooks/use-copy'
import CloseButton from './close-button'

type ThreadHeaderProps = {
  name: string
  status: 'open' | 'closed' | 'blocked'
  spam: boolean
  assigneeUserId: string | null
  assignees: { userId: string; name: string | null; email: string }[]
  canReply: boolean
  nameOfMember: (userId: string) => string
  onBack: () => void
  onAssign: (userId: string | null) => void
  onStatus: (status: 'open' | 'closed') => void
  onBlock: () => void
  onCopyLink: () => void
  /** Opens the customer panel as a dialog (below the wide layout). */
  onCustomer: () => void
}

const TONE = { open: 'success', closed: 'neutral', blocked: 'danger' } as const

/** The thread's header: back (phones), name and status, Assign, the close circle (or Reopen) and More. */
export default function ThreadHeader({
  name,
  status,
  spam,
  assigneeUserId,
  assignees,
  canReply,
  nameOfMember,
  onBack,
  onAssign,
  onStatus,
  onBlock,
  onCopyLink,
  onCustomer,
}: ThreadHeaderProps) {
  // Hooks
  const copy = useCopy(inboxConversationsContent)

  // Render logic
  const t = copy.thread

  return (
    <header className="flex flex-wrap items-center gap-2 border-b border-hairline px-3 py-2.5">
      <Button
        variant="ghost"
        size="icon"
        className="md:hidden"
        aria-label={t.back}
        onClick={onBack}
      >
        <ChevronLeftIcon className="size-4" />
      </Button>
      {/* The name keeps at least 8rem (~10 characters) and truncates past that; the status sits on
          its own line under it, and the controls wrap below rather than squeeze the name. */}
      <div className="flex min-w-32 flex-1 flex-col gap-1">
        <h2 className="truncate text-card-title text-ink-strong" title={name}>
          {name}
        </h2>
        <div className="flex min-w-0 items-center gap-2">
          <StatusChip tone={TONE[status]}>{t.status[status]}</StatusChip>
          {spam ? <p className="truncate text-caption text-muted-foreground">{t.spam}</p> : null}
        </div>
      </div>
      <div className="flex shrink-0 items-center gap-1.5">
        {canReply ? (
          <DropdownMenu>
            <DropdownMenuTrigger render={<Button variant="outline" size="sm" />}>
              <span className="max-w-28 truncate">
                {assigneeUserId ? nameOfMember(assigneeUserId) : t.assign}
              </span>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56">
              <DropdownMenuLabel>{t.assignTo}</DropdownMenuLabel>
              {assignees.map((a) => (
                <DropdownMenuItem
                  key={a.userId}
                  disabled={a.userId === assigneeUserId}
                  onClick={() => onAssign(a.userId)}
                >
                  {a.name ?? a.email}
                </DropdownMenuItem>
              ))}
              {assigneeUserId ? (
                <>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onClick={() => onAssign(null)}>
                    {t.removeAssignee}
                  </DropdownMenuItem>
                </>
              ) : null}
            </DropdownMenuContent>
          </DropdownMenu>
        ) : null}
        {canReply && status !== 'blocked' ? (
          <CloseButton
            status={status}
            onClick={() => onStatus(status === 'open' ? 'closed' : 'open')}
          />
        ) : null}
        <Button
          variant="ghost"
          size="icon"
          className="xl:hidden"
          aria-label={t.customer}
          onClick={onCustomer}
        >
          <UserRound className="size-4" />
        </Button>
        <DropdownMenu>
          <DropdownMenuTrigger render={<Button variant="ghost" size="icon" aria-label={t.more} />}>
            <MoreHorizontal className="size-4" />
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onClick={onCopyLink}>{t.copyLink}</DropdownMenuItem>
            {canReply ? (
              status === 'blocked' ? (
                <DropdownMenuItem onClick={() => onStatus('open')}>{t.unblock}</DropdownMenuItem>
              ) : (
                <DropdownMenuItem variant="destructive" onClick={onBlock}>
                  {t.block}
                </DropdownMenuItem>
              )
            ) : null}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  )
}
