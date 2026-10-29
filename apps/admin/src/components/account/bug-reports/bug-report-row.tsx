'use client'

import type { BugReportView } from '@commerce/core/bug-reports'
import BugReportScreenshot from '@/components/bug-report/bug-report-screenshot'
import BugReportStatusChip from '@/components/bug-report/bug-report-status-chip'
import StatusChip from '@/components/layout/status-chip'
import { myBugReportsContent } from '@/data/bug-report'
import { useCopy, useFormat } from '@/hooks/use-copy'

type BugReportRowProps = {
  report: BugReportView
  /** "All reports from this store": say who reported each one. */
  showReporter: boolean
}

/** One report: title, when, status, the page, the team's latest reply and the screenshot. */
export default function BugReportRow({ report, showReporter }: BugReportRowProps) {
  // Hooks
  const copy = useCopy(myBugReportsContent)
  const fmt = useFormat()

  // Render logic
  const when = fmt.when(report.createdAt)
  const reporter = report.reporterName || report.reporterEmail
  const meta = [
    showReporter && !report.mine ? copy.reportedBy(reporter, when) : copy.reported(when),
    report.githubIssueNumber !== null ? copy.issue(report.githubIssueNumber) : null,
  ].filter(Boolean)

  return (
    <li className="flex gap-4 py-4 first:pt-0 last:pb-0">
      <div className="flex min-w-0 flex-1 flex-col gap-2">
        <div className="flex flex-wrap items-center gap-2">
          <span className="min-w-0 text-body font-medium break-words text-ink-strong">
            {report.title}
          </span>
          <BugReportStatusChip status={report.status} />
          {report.unread ? <StatusChip tone="info">{copy.updated}</StatusChip> : null}
        </div>
        <span className="text-caption text-muted-foreground">{meta.join(' · ')}</span>
        {report.page ? (
          <span className="truncate text-caption text-muted-foreground">
            {copy.page}: <code className="font-mono">{report.page}</code>
          </span>
        ) : null}
        {report.staffReply ? (
          <div className="flex flex-col gap-1 rounded-lg border border-border bg-muted/40 px-3 py-2">
            <span className="text-caption font-medium text-ink-strong">
              {copy.reply}
              {report.staffReplyAt ? (
                <span className="font-normal text-muted-foreground">
                  {' · '}
                  {copy.replyAt(fmt.when(report.staffReplyAt))}
                </span>
              ) : null}
            </span>
            <p className="text-body whitespace-pre-wrap break-words text-foreground">
              {report.staffReply}
            </p>
          </div>
        ) : (
          <span className="text-caption text-muted-foreground">{copy.noReply}</span>
        )}
      </div>
      {report.screenshotUrl ? (
        <BugReportScreenshot url={report.screenshotUrl} title={report.title} />
      ) : null}
    </li>
  )
}
