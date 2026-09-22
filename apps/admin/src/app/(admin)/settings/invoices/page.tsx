import { FileText } from 'lucide-react'
import type { Metadata } from 'next'
import SettingsEmpty from '@/components/settings/settings-empty'
import { settingsContent } from '@/data/settings'

export const metadata: Metadata = { title: 'Invoices' }

export default function Page() {
  return <SettingsEmpty {...settingsContent.invoices} icon={FileText} />
}
