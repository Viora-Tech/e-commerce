import { dateRangeContent } from '@/data/date-range'
import { translation } from '@/lib/i18n'

export default [
  translation(dateRangeContent, {
    ranges: {
      today: 'आज',
      yesterday: 'कल',
      '7d': 'पिछले 7 दिन',
      '30d': 'पिछले 30 दिन',
      thisMonth: 'इस महीने',
      lastMonth: 'पिछले महीने',
      thisQuarter: 'इस तिमाही',
      thisFy: 'इस वित्त वर्ष',
      diwali: 'दिवाली हफ़्ता',
      festive: 'त्योहारों का मौसम',
      custom: 'अपनी तारीखें',
    },
    festiveHint: 'सित–नव',
    bigSale: {
      label: 'सबसे बड़ी बिक्री के दिन',
      loading: 'आपके सबसे अच्छे दिन ढूँढ रहे हैं…',
      empty: 'पिछले साल में अभी कोई ऑर्डर नहीं।',
      failed: 'आपके सबसे अच्छे दिन लोड नहीं हुए।',
      line: (sales, orders) => `${sales} · ${orders} ऑर्डर`,
    },
    rangeLabel: 'तारीखें',
    from: 'से',
    to: 'तक',
    compareTo: 'तुलना करें',
    compareOptions: { previous: 'पिछली अवधि', year: 'पिछले साल यही तारीखें' },
    cancel: 'रद्द करें',
    apply: 'लागू करें',
  }),
]
