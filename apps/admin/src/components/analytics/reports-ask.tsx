'use client'

import { pageContextFor } from '@commerce/ai/client'
import { Plus } from '@commerce/ui/icons'
import { Button } from '@commerce/ui/shadcn/button'
import AssistantTurnView from '@/components/assistant/assistant-turn'
import AskAiCard from '@/components/home/ask-ai-card'
import { analyticsContent } from '@/data/analytics'
import { assistantContent } from '@/data/assistant'
import { useAssistant } from '@/hooks/use-assistant'
import { useCopy, useLocale } from '@/hooks/use-copy'
import { routes } from '@/lib/routes'

type ReportsAskProps = {
  /** The AI assistant is on for this store and member. */
  enabled: boolean
}

/**
 * The Reports page's ask box: the answer, its tables and charts appear right here on the
 * page, not in the AI bar (#102). Kept in memory only; leaving the page starts afresh.
 */
export default function ReportsAsk({ enabled }: ReportsAskProps) {
  // Hooks
  const { reports: c } = useCopy(analyticsContent)
  const assistant = useCopy(assistantContent)
  const locale = useLocale()
  const conversation = useAssistant(null, { persist: false })

  // Event handlers
  const handleAsk = (question: string) => {
    void conversation.send(question, pageContextFor(routes.analytics.reports()), locale)
  }

  // Render logic
  const turns = conversation.turns

  return (
    <div className="flex flex-col gap-4">
      <AskAiCard
        enabled={enabled}
        placeholder={c.home.askPlaceholder}
        label={c.home.askLabel}
        chips={c.home.chips}
        chipsLabel={c.home.try}
        note={enabled ? c.home.readOnly : c.home.aiOff}
        onAsk={handleAsk}
      />
      {turns.length ? (
        <section className="flex flex-col gap-4 rounded-xl border border-border bg-card p-4 md:p-5">
          <ul className="flex flex-col gap-6">
            {turns.map((turn) => (
              <AssistantTurnView key={turn.id} turn={turn} onAction={conversation.replaceAction} />
            ))}
          </ul>
          <div className="flex justify-end gap-2">
            {conversation.busy ? (
              <Button variant="outline" size="sm" onClick={conversation.stop}>
                {assistant.panel.stop}
              </Button>
            ) : (
              <Button variant="outline" size="sm" onClick={conversation.clear}>
                <Plus aria-hidden="true" />
                {assistant.panel.newChat}
              </Button>
            )}
          </div>
        </section>
      ) : null}
    </div>
  )
}
