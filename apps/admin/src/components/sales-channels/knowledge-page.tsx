'use client'

import type { KnowledgeOverview } from '@commerce/core'
import {
  KNOWLEDGE_FACTS,
  KNOWLEDGE_GROUPS,
  type KnowledgeKey,
  type KnowledgeValueInput,
} from '@commerce/core/agent-knowledge'
import { AiIcon, ChevronRight, CircleCheck, CircleDashed, RefreshCw } from '@commerce/ui/icons'
import { Button } from '@commerce/ui/shadcn/button'
import Link from 'next/link'
import { useState } from 'react'
import { toast } from 'sonner'
import DataCard from '@/components/layout/data-card'
import EmptyState from '@/components/layout/empty-state'
import PageBody from '@/components/layout/page-body'
import PageColumns from '@/components/layout/page-columns'
import PageHeader from '@/components/layout/page-header'
import KnowledgeTabs from './knowledge-tabs'
import RelativeTime from '@/components/layout/relative-time'
import { agentKnowledgeContent } from '@/data/agent-knowledge'
import { salesChannelsContent } from '@/data/sales-channels'
import { useCopy } from '@/hooks/use-copy'
import { api } from '@/lib/api-client'
import { routes } from '@/lib/routes'
import KnowledgeFact from './knowledge-fact'

type KnowledgePageProps = { data: KnowledgeOverview }

/**
 * Agentic sales → Knowledge base, after Shopify's: facts by group, each published on its own or
 * with "Publish all"; on the side, how many are published, the policies agents read, and Rescan.
 */
export default function KnowledgePage({ data: initial }: KnowledgePageProps) {
  // Hooks
  const copy = useCopy(agentKnowledgeContent)
  const shared = useCopy(salesChannelsContent.overview)
  const [data, setData] = useState(initial)
  const [busy, setBusy] = useState<'scan' | KnowledgeKey | 'group' | null>(null)

  // Event handlers
  const handleScan = async () => {
    setBusy('scan')
    try {
      setData(await api.salesChannels.knowledgeScan())
      toast.success(copy.scanned)
    } catch {
      toast.error(copy.scanFailed)
    } finally {
      setBusy(null)
    }
  }
  const handleSave = async (key: KnowledgeKey, value: KnowledgeValueInput) => {
    setBusy(key)
    try {
      setData(await api.salesChannels.knowledgeSave({ key, value }))
      toast.success(copy.saved)
      return true
    } catch {
      toast.error(copy.saveFailed)
      return false
    } finally {
      setBusy(null)
    }
  }
  const handlePublish = async (keys: KnowledgeKey[], published: boolean) => {
    setBusy(keys.length === 1 ? (keys[0] as KnowledgeKey) : 'group')
    try {
      setData(await api.salesChannels.knowledgePublish({ keys, published }))
    } catch {
      toast.error(copy.saveFailed)
    } finally {
      setBusy(null)
    }
  }

  // Render logic
  const hasFacts = data.counts.total > 0
  const scanButton = (
    <Button
      variant={hasFacts ? 'outline' : 'default'}
      disabled={busy !== null}
      onClick={handleScan}
    >
      {busy === 'scan' ? <RefreshCw className="animate-spin" /> : <AiIcon />}
      {busy === 'scan' ? copy.scanning : hasFacts ? copy.rescan : copy.scan}
    </Button>
  )

  return (
    <PageBody>
      <PageHeader
        title={copy.title}
        subtitle={copy.subtitle}
        back={{ label: shared.title, href: routes.salesChannels.agentic() }}
        actions={scanButton}
      />
      <KnowledgeTabs current="facts" />
      <PageColumns
        main={
          hasFacts ? (
            KNOWLEDGE_GROUPS.map((group) => {
              const facts = KNOWLEDGE_FACTS.filter((f) => f.group === group)
              const present = facts.filter((f) => data.facts[f.key])
              const unpublished = present.filter((f) => !data.facts[f.key]?.published)
              return (
                <DataCard
                  key={group}
                  title={copy.groups[group]}
                  action={
                    <div className="flex items-center gap-3">
                      <span className="text-caption text-muted-foreground tabular-nums">
                        {copy.groupCount(present.length - unpublished.length, present.length)}
                      </span>
                      {unpublished.length > 0 ? (
                        <Button
                          size="sm"
                          variant="outline"
                          disabled={busy !== null}
                          onClick={() =>
                            handlePublish(
                              unpublished.map((f) => f.key),
                              true,
                            )
                          }
                        >
                          {copy.publishAll}
                        </Button>
                      ) : null}
                    </div>
                  }
                  flush
                >
                  <ul className="flex flex-col divide-y divide-border border-t border-border">
                    {facts.map((f) => (
                      <KnowledgeFact
                        key={f.key}
                        id={`fact-${f.key}`}
                        label={copy.facts[f.key]}
                        kind={f.kind}
                        fact={data.facts[f.key]}
                        busy={busy !== null}
                        onSave={(value) => handleSave(f.key, value)}
                        onPublish={(published) => handlePublish([f.key], published)}
                      />
                    ))}
                  </ul>
                </DataCard>
              )
            })
          ) : (
            <EmptyState
              variant="page"
              icon={AiIcon}
              heading={copy.emptyHeading}
              body={copy.emptyBody}
              action={scanButton}
            />
          )
        }
        side={
          <>
            <DataCard title={copy.status}>
              <div className="flex items-center justify-between gap-3 text-body">
                <span className="text-foreground">{copy.publishedFacts}</span>
                <span className="text-muted-foreground tabular-nums">
                  {copy.publishedOf(data.counts.published, data.counts.total)}
                </span>
              </div>
              <p className="mt-3 text-caption text-muted-foreground">
                {data.scannedAt ? (
                  <>
                    {copy.lastScanned} <RelativeTime value={data.scannedAt} />
                  </>
                ) : (
                  copy.neverScanned
                )}
              </p>
              <p className="mt-1 text-caption text-muted-foreground">{copy.scanNote}</p>
            </DataCard>
            <DataCard title={copy.policies} flush>
              <ul className="flex flex-col divide-y divide-border border-t border-border">
                {data.policies.map((p) => (
                  <li key={p.type}>
                    <Link
                      href={routes.settings.policies()}
                      className="group flex items-center gap-2.5 px-5 py-2.5 text-body transition-colors duration-150 hover:bg-row-hover focus-visible:ring-2 focus-visible:ring-ring/70 focus-visible:outline-none focus-visible:ring-inset motion-reduce:transition-none"
                    >
                      {p.published ? (
                        <CircleCheck aria-hidden className="size-4 shrink-0 text-success" />
                      ) : (
                        <CircleDashed
                          aria-hidden
                          className="size-4 shrink-0 text-muted-foreground"
                        />
                      )}
                      <span className="min-w-0 flex-1 truncate text-foreground">{p.title}</span>
                      {p.published ? null : (
                        <span className="text-caption text-muted-foreground">
                          {copy.policyHidden}
                        </span>
                      )}
                      <ChevronRight aria-hidden className="size-4 shrink-0 text-muted-foreground" />
                    </Link>
                  </li>
                ))}
              </ul>
            </DataCard>
            <DataCard title={copy.whereHeading}>
              <ul className="flex list-disc flex-col gap-1.5 pl-4 text-caption text-muted-foreground">
                {copy.where.map((line) => (
                  <li key={line}>{line}</li>
                ))}
              </ul>
            </DataCard>
          </>
        }
      />
    </PageBody>
  )
}
