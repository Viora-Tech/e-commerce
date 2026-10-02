import type { PreviewSample } from '@commerce/plugin-shopify-import/client'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@commerce/ui/shadcn/table'
import DataCard from '@/components/layout/data-card'
import { shopifyImportContent } from '@/data/shopify-import'
import { useCopy } from '@/hooks/use-copy'

type RunSamplesCardProps = { samples: PreviewSample[] }

/** The first few records of each type and what the import would do with them. */
export default function RunSamplesCard({ samples }: RunSamplesCardProps) {
  // Hooks
  const copy = useCopy(shopifyImportContent.run)
  const resources = useCopy(shopifyImportContent.resources)

  return (
    <DataCard title={copy.sampleHeading} flush>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>{copy.columns.what}</TableHead>
            <TableHead>{copy.issueColumns.what}</TableHead>
            <TableHead />
            <TableHead className="text-right" />
          </TableRow>
        </TableHeader>
        <TableBody>
          {samples.map((s) => (
            <TableRow key={`${s.resource}-${s.key}`}>
              <TableCell className="text-muted-foreground">{resources[s.resource]}</TableCell>
              <TableCell className="font-medium">{s.title}</TableCell>
              <TableCell className="text-muted-foreground">{s.detail ?? ''}</TableCell>
              <TableCell className="text-right">{copy.sampleAction[s.action]}</TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </DataCard>
  )
}
