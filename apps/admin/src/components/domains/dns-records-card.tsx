import type { DnsRecord } from '@commerce/core/domains'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@commerce/ui/shadcn/card'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@commerce/ui/shadcn/table'
import CopyButton from '@/components/fields/copy-button'
import { domainsContent } from '@/data/domains'

const copy = domainsContent.detail.records

type DnsRecordsCardProps = {
  records: DnsRecord[]
}

/** The records to add at the registrar, each value one click from the clipboard. */
export default function DnsRecordsCard({ records }: DnsRecordsCardProps) {
  // Render logic
  return (
    <Card gap="none" inset="none">
      <CardHeader className="px-4 pt-4 pb-3">
        <CardTitle>{copy.heading}</CardTitle>
        <CardDescription>{copy.body}</CardDescription>
      </CardHeader>
      <CardContent className="px-0">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-24 pl-4">{copy.columns.type}</TableHead>
              <TableHead>{copy.columns.name}</TableHead>
              <TableHead className="pr-4">{copy.columns.value}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {records.map((r) => (
              <TableRow key={`${r.type}-${r.name}`} className="group/row align-top">
                <TableCell className="pl-4">
                  <span className="font-mono text-body-strong">{r.type}</span>
                  <span className="block text-caption text-muted-foreground">
                    {r.purpose === 'routing' ? copy.routing : copy.verification}
                  </span>
                </TableCell>
                <TableCell>
                  <span className="flex items-center gap-1 font-mono text-body">
                    <span className="break-all">{r.name}</span>
                    <CopyButton value={r.name} what={copy.columns.name} />
                  </span>
                </TableCell>
                <TableCell className="pr-4">
                  <span className="flex items-center gap-1 font-mono text-body">
                    <span className="break-all whitespace-normal">{r.value}</span>
                    <CopyButton value={r.value} what={copy.columns.value} />
                  </span>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  )
}
