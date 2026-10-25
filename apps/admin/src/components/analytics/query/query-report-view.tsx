'use client'

import {
  formatQuery,
  type ParsedQuery,
  parseQuery,
  queryDay,
  rangeKeyOf,
} from '@commerce/core/analytics-query'
import { useRouter } from 'next/navigation'
import { useState } from 'react'
import { toast } from 'sonner'
import SaveBar from '@/components/layout/save-bar'
import { analyticsContent } from '@/data/analytics'
import { useCopy } from '@/hooks/use-copy'
import type { RangeState } from '@/lib/analytics-range'
import { api } from '@/lib/api-client'
import { routes } from '@/lib/routes'
import QueryAiInput from './query-ai-input'
import QueryEditorCard from './query-editor-card'
import QueryHeader from './query-header'
import QueryRangeBar from './query-range-bar'
import QueryResult from './query-result'
import QuerySidePanel from './query-side-panel'
import { useQueryHistory } from './use-query-history'
import { type Ran, useQueryRunner } from './use-query-runner'

export type SavedQuery = { id: string; name: string; source: string }

type QueryReportViewProps = {
  initialSource: string
  initial: Ran | null
  /** The saved custom query the page opened (`?saved=`), or null for a new one. */
  saved: SavedQuery | null
  /** `on` / `off`: show "Describe what you want" or why it is off; `hidden` when the platform has no AI. */
  ai: 'on' | 'off' | 'hidden'
}

/** The range a saved query files under (Reports' saved card): a quick key, else its two days. */
function savedRange(q: ParsedQuery): RangeState {
  const key = rangeKeyOf(q)
  return key ? { key } : { key: 'custom', from: queryDay(q.since), to: queryDay(q.until) }
}

const errorMessage = (err: unknown) => (err instanceof Error ? err.message : String(err))

/**
 * Figma "Analytics · Report — query editor", closer to Shopify's ShopifyQL editor: the query
 * checked and run as you type, controls that write the query, date and compare pills, Refine
 * with AI, undo and redo, and the query saved as a report.
 */
export default function QueryReportView({
  initialSource,
  initial,
  saved: initialSaved,
  ai,
}: QueryReportViewProps) {
  // Hooks
  const copy = useCopy(analyticsContent.query)
  const router = useRouter()
  const history = useQueryHistory(initialSource)
  const runner = useQueryRunner(initialSource, initial)
  const [saved, setSaved] = useState(initialSaved)
  const [name, setName] = useState(initialSaved?.name ?? null)
  const [collapsed, setCollapsed] = useState(false)
  const [saving, setSaving] = useState(false)

  // Helpers
  const applyText = (text: string) => {
    history.replace(text)
    runner.checkNow(text)
  }
  const applyQuery = (q: ParsedQuery) => applyText(formatQuery(q))
  const parsedNow = () => {
    const parsed = parseQuery(history.text)
    return parsed.ok ? parsed.query : null
  }

  // Event handlers
  const handleType = (text: string) => {
    history.type(text)
    runner.schedule(text)
  }
  const handleUndo = () => runner.checkNow(history.undo())
  const handleRedo = () => runner.checkNow(history.redo())
  const handleRun = () => runner.runNow(history.text)

  const handleFormat = () => {
    const q = parsedNow()
    if (q) applyQuery(q)
    else runner.checkNow(history.text)
  }

  const handleInsert = (field: string) => {
    const s = history.text
    const next = s.endsWith(' ') || s.endsWith('\n') ? `${s}${field}` : `${s} ${field}`
    history.replace(next)
    runner.schedule(next)
  }

  const handleSaveNew = async (reportName: string): Promise<boolean> => {
    const q = parsedNow()
    try {
      const row = await api.analytics.saveReport({
        name: reportName,
        reportSlug: 'query',
        range: q ? savedRange(q) : { key: '30d' },
        query: history.text,
      })
      if (!row) return false
      setSaved({ id: row.id, name: row.name, source: history.text })
      setName(row.name)
      toast.success(copy.save.saved)
      router.replace(`${routes.analytics.query()}?saved=${row.id}`)
      return true
    } catch (err) {
      toast.error(errorMessage(err))
      return false
    }
  }

  const handleSaveChanges = async () => {
    if (!saved || name === null) return
    const q = parsedNow()
    setSaving(true)
    try {
      await api.analytics.updateSavedQuery({
        id: saved.id,
        name,
        query: history.text,
        range: q ? savedRange(q) : { key: '30d' },
      })
      setSaved({ ...saved, name, source: history.text })
      toast.success(copy.save.updated)
    } catch (err) {
      toast.error(errorMessage(err))
    } finally {
      setSaving(false)
    }
  }

  const handleDiscard = () => {
    if (!saved) return
    applyText(saved.source)
    setName(saved.name)
  }

  const handleDelete = async () => {
    if (!saved) return
    try {
      await api.analytics.deleteSavedReport({ id: saved.id })
      toast.success(copy.save.deleted)
      router.push(routes.analytics.reports())
    } catch (err) {
      toast.error(errorMessage(err))
    }
  }

  // Render logic
  const { checked, ran } = runner
  const valid = checked.result.ok
  const error = checked.result.ok ? runner.runError : checked.result.error
  const dirty = saved !== null && (history.text !== saved.source || name !== saved.name)

  return (
    <div className="flex w-full flex-col gap-5 px-4 py-6 md:px-8">
      <QueryHeader
        name={name}
        ran={ran}
        onSaveNew={handleSaveNew}
        onRename={setName}
        onDelete={handleDelete}
      />
      <div className="grid items-start gap-4 lg:grid-cols-[minmax(0,1fr)_18rem]">
        <QueryEditorCard
          text={history.text}
          error={error}
          failed={runner.failed}
          busy={runner.busy}
          ranLine={ran ? copy.ranIn(ran.ms, ran.result.rows.length) : null}
          collapsed={collapsed}
          canUndo={history.canUndo}
          canRedo={history.canRedo}
          rangeBar={<QueryRangeBar query={runner.good} enabled={valid} onChange={applyQuery} />}
          aiInput={
            ai === 'hidden' ? null : (
              <QueryAiInput state={ai} current={history.text} onAnswer={applyText} />
            )
          }
          onType={handleType}
          onRun={handleRun}
          onFormat={handleFormat}
          onUndo={handleUndo}
          onRedo={handleRedo}
          onToggleCollapsed={() => setCollapsed((c) => !c)}
        />
        <QuerySidePanel
          query={runner.good}
          enabled={valid}
          onChange={applyQuery}
          onInsert={handleInsert}
        />
      </div>
      {ran ? <QueryResult ran={ran} /> : null}
      <SaveBar
        open={dirty}
        message={copy.save.unsaved}
        saveLabel={copy.save.save}
        discardLabel={copy.save.discard}
        onSave={handleSaveChanges}
        onDiscard={handleDiscard}
        saving={saving}
      />
    </div>
  )
}
