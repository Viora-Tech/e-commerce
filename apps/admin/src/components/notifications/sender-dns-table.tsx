import type { SenderDnsRecord } from '@commerce/core/sender-email'
import { Badge } from '@commerce/ui/shadcn/badge'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@commerce/ui/shadcn/table'
import CopyButton from '@/components/fields/copy-button'
import { senderEmailContent } from '@/data/sender-email'
import DnsProviderHelp from './dns-provider-help'

type SenderDnsTableProps = {
  records: SenderDnsRecord[]
}

const copy = senderEmailContent.records

/** Type / Name / Value, each Name and Value one click from the clipboard, required rows first. */
export default function SenderDnsTable({ records }: SenderDnsTableProps) {
  // Render logic
  return (
    <div className="flex flex-col gap-2">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="flex flex-col gap-0.5">
          <h4 className="text-body font-semibold text-foreground">{copy.heading}</h4>
          <p className="text-caption text-muted-foreground">{copy.help}</p>
        </div>
        <DnsProviderHelp />
      </div>
      <div className="overflow-x-auto rounded-lg border border-border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-28 pl-3">{copy.columns.type}</TableHead>
              <TableHead>{copy.columns.name}</TableHead>
              <TableHead className="pr-3">{copy.columns.value}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {records.map((r) => (
              <TableRow key={`${r.type}-${r.name}-${r.value}`} className="group/row align-top">
                <TableCell className="pl-3">
                  <span className="block font-mono text-body-strong">{r.type}</span>
                  <Badge variant={r.purpose === 'dkim' ? 'warning' : 'neutral'} className="mt-1">
                    {copy.purpose[r.purpose]}
                  </Badge>
                </TableCell>
                <TableCell className="min-w-40">
                  <span className="flex items-center gap-1 font-mono text-body">
                    <span className="break-all whitespace-normal">{r.host}</span>
                    <CopyButton value={r.host} what={copy.columns.name} />
                  </span>
                  {r.host !== r.name ? (
                    <span className="block text-caption break-all whitespace-normal text-muted-foreground">
                      {copy.fullName(r.name)}
                    </span>
                  ) : null}
                </TableCell>
                <TableCell className="min-w-48 pr-3">
                  <span className="flex items-center gap-1 font-mono text-body">
                    <span className="break-all whitespace-normal">{r.value}</span>
                    <CopyButton value={r.value} what={copy.columns.value} />
                  </span>
                  {r.priority !== undefined ? (
                    <span className="block text-caption text-muted-foreground">
                      {copy.priority(r.priority)}
                    </span>
                  ) : null}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
      <p className="text-caption text-muted-foreground">{copy.dmarcNote}</p>
    </div>
  )
}
