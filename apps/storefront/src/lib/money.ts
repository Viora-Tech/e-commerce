import { formatMoney } from '@commerce/money'

export function formatPaise(paise: number): string {
  return formatMoney(paise, 'INR')
}
