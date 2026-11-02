import type { ComponentProps } from 'react'
import LinkRow from '@/components/table/link-row'

type SettingsTableRowProps = ComponentProps<typeof LinkRow>

/** A body row of a settings table (`LinkRow`): with `href`, the whole row opens its page. */
export default function SettingsTableRow(props: SettingsTableRowProps) {
  return <LinkRow {...props} />
}
