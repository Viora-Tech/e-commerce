'use client'

import { Button } from '@commerce/ui/shadcn/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@commerce/ui/shadcn/dialog'
import type { ActivityRow } from '@/components/activity-log/activity-columns'
import { activityLogContent } from '@/data/activity-log'
import { useCopy, useFormat } from '@/hooks/use-copy'

type ActivityDialogProps = {
  row: ActivityRow | null
  onClose: () => void
}

type ChangeLine = { field: string; before?: string; after: string }

/** Rows the table shows; a bigger input is cut here. */
const MAX_LINES = 80

/** `pincodeRules` → "Pincode rules". */
function labelOf(key: string): string {
  const spaced = key.replace(/([a-z0-9])([A-Z])/g, '$1 $2').toLowerCase()
  return spaced.charAt(0).toUpperCase() + spaced.slice(1)
}

function show(value: unknown, none: string): string {
  if (value === null || value === undefined || value === '') return none
  if (typeof value === 'object') return JSON.stringify(value)
  return String(value)
}

/** A nested input as one line per value, keys joined with ›. */
function flatten(value: unknown, label: string, none: string, out: ChangeLine[]) {
  if (out.length >= MAX_LINES) return
  if (Array.isArray(value)) {
    if (value.every((v) => v === null || typeof v !== 'object')) {
      out.push({ field: label, after: value.length ? value.map(String).join(', ') : none })
      return
    }
    value.forEach((item, i) => {
      flatten(item, `${label} ${i + 1}`, none, out)
    })
    return
  }
  if (value !== null && typeof value === 'object') {
    for (const [key, child] of Object.entries(value)) {
      flatten(child, label ? `${label} › ${labelOf(key)}` : labelOf(key), none, out)
    }
    return
  }
  out.push({ field: label, after: show(value, none) })
}

/** The fields whose value changed, before and after. */
function compared(row: ActivityRow, none: string): ChangeLine[] {
  const before = row.changes?.before ?? {}
  const after = row.changes?.after ?? {}
  return [...new Set([...Object.keys(before), ...Object.keys(after)])].map((key) => ({
    field: labelOf(key),
    before: show(before[key], none),
    after: show(after[key], none),
  }))
}

/** One change: who, when, from where, the action and its before/after table. Centred, never a drawer. */
export default function ActivityDialog({ row, onClose }: ActivityDialogProps) {
  // Hooks
  const copy = useCopy(activityLogContent)
  const f = useFormat()

  // Render logic
  const d = copy.detail
  const hasPair = Boolean(row?.changes?.before || row?.changes?.after)
  const lines: ChangeLine[] = []
  if (row && hasPair) lines.push(...compared(row, d.none))
  else if (row?.changes && 'input' in row.changes) flatten(row.changes.input, '', d.none, lines)
  const facts: [string, string][] = row
    ? [
        [copy.columns.when, f.dateTime(row.createdAt)],
        [
          copy.columns.who,
          [row.actorName, row.actorEmail].filter(Boolean).join(' · ') || copy.system,
        ],
        [copy.columns.source, copy.sources[row.source] ?? row.source],
        [copy.columns.area, copy.areas[row.area] ?? row.area],
        [d.action, row.action],
        [d.record, row.resourceId ?? d.none],
        [d.ip, row.ip ?? d.none],
        [d.device, row.userAgent ?? d.none],
      ]
    : []

  return (
    <Dialog open={row !== null} onOpenChange={(open) => (open ? null : onClose())}>
      <DialogContent className="sm:max-w-[42rem]">
        <DialogHeader>
          <DialogTitle>{d.title}</DialogTitle>
          <DialogDescription>{row?.summary}</DialogDescription>
        </DialogHeader>
        <div className="flex max-h-[60dvh] flex-col gap-4 overflow-y-auto">
          <dl className="grid grid-cols-[minmax(0,8rem)_1fr] gap-x-4 gap-y-2 text-body">
            {facts.map(([label, value]) => (
              <div key={label} className="contents">
                <dt className="text-muted-foreground">{label}</dt>
                <dd className="min-w-0 break-words">{value}</dd>
              </div>
            ))}
          </dl>
          <div className="flex flex-col gap-2">
            <p className="text-body font-medium">{d.changes}</p>
            {lines.length ? (
              <div className="overflow-x-auto rounded-md border border-border">
                <table className="w-full text-left text-body">
                  <thead className="bg-muted text-caption text-muted-foreground">
                    <tr>
                      <th className="px-3 py-2 font-medium">{d.field}</th>
                      {hasPair ? <th className="px-3 py-2 font-medium">{d.before}</th> : null}
                      <th className="px-3 py-2 font-medium">{hasPair ? d.after : d.value}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {lines.map((line) => (
                      <tr key={line.field} className="border-t border-border align-top">
                        <td className="px-3 py-2 text-muted-foreground">{line.field}</td>
                        {hasPair ? <td className="break-all px-3 py-2">{line.before}</td> : null}
                        <td className="break-all px-3 py-2">{line.after}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <p className="text-body text-muted-foreground">{d.nothing}</p>
            )}
            <p className="text-caption text-muted-foreground">{d.redactedNote}</p>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            {d.close}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
