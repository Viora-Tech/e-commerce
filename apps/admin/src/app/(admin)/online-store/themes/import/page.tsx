import type { Metadata } from 'next'
import ImportThemeScreen from '@/components/themes/import-theme-screen'
import { themeImportContent } from '@/data/theme-import'

export const metadata: Metadata = { title: themeImportContent.screen.title }

export default function Page() {
  return <ImportThemeScreen />
}
