import type { Metadata } from 'next'
import MonthlyExpensesSettings from '@/components/settings/expenses/monthly-expenses-settings'

export const metadata: Metadata = { title: 'Monthly expenses' }

export default function Page() {
  return <MonthlyExpensesSettings />
}
