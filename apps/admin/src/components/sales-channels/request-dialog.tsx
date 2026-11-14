'use client'

import { AI_AGENTS, type SalesChannelId } from '@commerce/core/sales-channels'
import { useState } from 'react'
import { toast } from 'sonner'
import KitButton from '@/components/kit/kit-button'
import FormDialog from '@/components/layout/form-dialog'
import { salesChannelsContent } from '@/data/sales-channels'
import { useCopy, useFormat } from '@/hooks/use-copy'
import { api } from '@/lib/api-client'
import OpenAiFeedDialog from './openai-feed-dialog'

type RequestDialogProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  channel: SalesChannelId
  name: string
  requestedAt: string | null
  onWithdrawn: () => void
}

/** True for an AI agent, whose request is a waiting list rather than an approval. */
const isAgent = (channel: SalesChannelId) => (AI_AGENTS as readonly string[]).includes(channel)

/**
 * "View request": when access was asked for, and a way to withdraw it. For an AI agent it is
 * "on the list, not live yet": nothing is sent to the agent until it opens to stores in India.
 */
export default function RequestDialog({
  open,
  onOpenChange,
  channel,
  name,
  requestedAt,
  onWithdrawn,
}: RequestDialogProps) {
  // Hooks
  const copy = useCopy(salesChannelsContent.bar)
  const failed = useCopy(salesChannelsContent.connect.failed)
  const live = useCopy(salesChannelsContent.live)
  const agentList = useCopy(salesChannelsContent.agentList)
  const format = useFormat()
  const [feed, setFeed] = useState(false)

  // Event handlers
  const handleWithdraw = async () => {
    try {
      await api.salesChannels.cancel({ channel })
      onWithdrawn()
      onOpenChange(false)
    } catch (err) {
      toast.error(failed)
      throw err
    }
  }

  // Render logic
  const date = requestedAt ? format.date(requestedAt) : ''
  const agent = isAgent(channel)
  return (
    <>
      <FormDialog
        open={open}
        onOpenChange={onOpenChange}
        title={agent ? agentList.title(name) : copy.requested(name)}
        description={
          agent
            ? `${agentList.body(name)}${date ? ` ${agentList.since(date)}` : ''}`
            : copy.requestedBody(date)
        }
        submitLabel={agent ? agentList.withdraw : copy.withdraw}
        onSubmit={handleWithdraw}
      >
        {channel === 'chatgpt' ? (
          <div className="flex flex-col items-start gap-2 rounded-md border border-border bg-muted/40 p-3">
            <p className="text-caption text-muted-foreground">{live.openai.approvedHint}</p>
            <KitButton variant="secondary" onClick={() => setFeed(true)}>
              {live.openai.add}
            </KitButton>
          </div>
        ) : null}
      </FormDialog>
      <OpenAiFeedDialog
        open={feed}
        onOpenChange={(o) => {
          setFeed(o)
          if (!o) onOpenChange(false)
        }}
      />
    </>
  )
}
