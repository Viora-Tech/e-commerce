import { loyaltyCustomerContent } from '@/data/loyalty-customer'
import { translation } from '@/lib/i18n'

export default [
  translation(loyaltyCustomerContent, {
    tier: 'टियर',
    noTier: 'अभी कोई टियर नहीं',
    toNext: (what: string, tier: string) => `${tier} तक ${what} और`,
    lifetime: 'कुल कमाए पॉइंट',
    rewards: 'इस्तेमाल किए इनाम',
    noRewards: 'अभी कोई इनाम इस्तेमाल नहीं हुआ।',
    statuses: {
      issued: 'इस्तेमाल नहीं हुआ',
      used: 'इस्तेमाल हुआ',
      cancelled: 'रद्द',
      expired: 'समय खत्म',
    },
    via: { tier: 'टियर का इनाम', referral: 'रेफ़रल', redeem: '' },
    cancel: 'कोड रद्द करें (पॉइंट वापस)',
    cancelTitle: 'यह कोड रद्द करें?',
    cancelBody: (points: string) =>
      `कोड काम करना बंद कर देगा और ${points} ग्राहक को वापस मिल जाएँगे, आज से गिने जाएँगे।`,
    cancelled: 'कोड रद्द हुआ, पॉइंट वापस',
    cancelFailed: 'कोड रद्द नहीं हुआ। फिर से कोशिश करें।',
    referral: 'रेफ़रल कोड',
    referralCount: (n: number) => `${n} दोस्त रेफ़र किए`,
    points: (n: number) => `${n} पॉइंट`,
  }),
]
