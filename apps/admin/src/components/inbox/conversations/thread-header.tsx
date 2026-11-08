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
  /** Where the chat came in, in words ("Online store chat"). */
  channel: string
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

/**
 * The thread's header, one compact line: back (phones), the customer, the channel and status,
 * then Assign, the close circle (or Reopen) and More. The thread gets the height it saves.
 */
export default function ThreadHeader({
  name,
  channel,
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
    <header className="flex min-h-12 items-center gap-2 border-b border-hairline px-3 py-1.5">
      <Button
        variant="ghost"
        size="icon"
        className="md:hidden"
        aria-label={t.back}
        onClick={onBack}
      >
        <ChevronLeftIcon className="size-4" />
      </Button>
      {/* One line: the name truncates first, then the channel; the status chip always shows. */}
      <div className="flex min-w-0 flex-1 items-center gap-2">
        <h2 className="min-w-0 truncate text-body-strong text-ink-strong" title={name}>
          {name}
        </h2>
        <span className="hidden min-w-0 truncate text-caption text-muted-foreground sm:inline">
          {channel}
        </span>
        <StatusChip tone={TONE[status]}>{t.status[status]}</StatusChip>
        {spam ? (
          <span className="hidden truncate text-caption text-muted-foreground lg:inline">
            {t.spam}
          </span>
        ) : null}
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
