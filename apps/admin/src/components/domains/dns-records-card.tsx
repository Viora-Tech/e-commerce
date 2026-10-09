import type { DnsRecord } from '@commerce/core/domains'
import CopyButton from '@/components/fields/copy-button'
import SettingsTable from '@/components/settings/settings-table'
import SettingsTableCell from '@/components/settings/settings-table-cell'
import SettingsTableRow from '@/components/settings/settings-table-row'
import { domainsContent } from '@/data/domains'

const copy = domainsContent.detail.records

type DnsRecordsCardProps = {
  records: DnsRecord[]
}

/** The records to add at the registrar, each value one click from the clipboard. */
export default function DnsRecordsCard({ records }: DnsRecordsCardProps) {
  return (
    <SettingsTable
      heading={copy.heading}
      description={copy.body}
      columns={[
        { label: copy.columns.type, className: 'w-28' },
        { label: copy.columns.name },
        { label: copy.columns.value },
      ]}
    >
      {records.map((r) => (
        <SettingsTableRow key={`${r.type}-${r.name}`} className="align-top">
          <SettingsTableCell>
            <span className="font-mono font-semibold">{r.type}</span>
            <span className="block text-caption text-muted-foreground">
              {r.purpose === 'routing' ? copy.routing : copy.verification}
            </span>
          </SettingsTableCell>
          <SettingsTableCell>
            <span className="flex items-center gap-1 font-mono">
              <span className="break-all">{r.name}</span>
              <CopyButton value={r.name} what={copy.columns.name} />
            </span>
          </SettingsTableCell>
          <SettingsTableCell>
            <span className="flex items-center gap-1 font-mono">
              <span className="break-all whitespace-normal">{r.value}</span>
              <CopyButton value={r.value} what={copy.columns.value} />
            </span>
          </SettingsTableCell>
        </SettingsTableRow>
      ))}
    </SettingsTable>
  )
}
