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

/** The thread's header: back (phones), name and status, Assign, Close/Reopen and More. */
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
      <div className="flex min-w-0 flex-1 flex-col">
        <div className="flex min-w-0 items-center gap-2">
          <h2 className="truncate text-card-title text-ink-strong">{name}</h2>
          <StatusChip tone={TONE[status]}>{t.status[status]}</StatusChip>
        </div>
        {spam ? <p className="text-caption text-muted-foreground">{t.spam}</p> : null}
      </div>
      <div className="flex items-center gap-1.5">
        {canReply ? (
          <DropdownMenu>
            <DropdownMenuTrigger render={<Button variant="outline" size="sm" />}>
              {assigneeUserId ? nameOfMember(assigneeUserId) : t.assign}
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
          <Button
            variant="outline"
            size="sm"
            onClick={() => onStatus(status === 'open' ? 'closed' : 'open')}
          >
            {status === 'open' ? t.close : t.reopen}
          </Button>
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
