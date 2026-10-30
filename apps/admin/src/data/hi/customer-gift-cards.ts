import { customerGiftCardsContent } from '@/data/customer-gift-cards'
import { translation } from '@/lib/i18n'

export default [
  translation(customerGiftCardsContent, {
    heading: 'गिफ़्ट कार्ड',
    ending: (last: string) => `आख़िरी अक्षर ${last}`,
    balance: (balance: string, issued: string) => `${issued} में से ${balance} बाक़ी`,
  }),
]
