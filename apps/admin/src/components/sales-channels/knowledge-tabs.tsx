'use client'

import PillTabs from '@/components/layout/pill-tabs'
import { agentKnowledgeContent } from '@/data/agent-knowledge'
import { useCopy } from '@/hooks/use-copy'
import { routes } from '@/lib/routes'

type KnowledgeTabsProps = {
  /** The tab this page is. */
  current: 'facts' | 'answers'
}

/**
 * One Knowledge base, two tabs (owner, 18 Nov 2026): Store facts (Agentic sales' scan) and
 * Questions & answers (the Inbox answers). The store chat AI and AI agents both read the
 * published items of both tabs.
 */
export default function KnowledgeTabs({ current }: KnowledgeTabsProps) {
  // Hooks
  const copy = useCopy(agentKnowledgeContent.tabs)

  return (
    <PillTabs
      variant="underline"
      label={copy.label}
      value={current}
      tabs={[
        { value: 'facts', label: copy.facts, href: routes.salesChannels.agenticKnowledge() },
        { value: 'answers', label: copy.answers, href: routes.salesChannels.inboxKnowledge() },
      ]}
    />
  )
}
