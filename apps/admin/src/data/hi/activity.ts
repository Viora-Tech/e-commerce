import { activityContent } from '@/data/activity'
import { translation } from '@/lib/i18n'

export default [
  translation(activityContent, {
    label: 'गतिविधि',
    unread: (n: number) => `${n} नए`,
    attentionHeading: 'आपका ध्यान चाहिए',
    recentHeading: 'पिछले 7 दिन',
    empty: 'अभी देखने को कुछ नया नहीं है।',
    failed: 'गतिविधि लोड नहीं हो पाई।',
    attention: {
      refundsNeeded: (n: number) => `${n} पेमेंट रिफ़ंड करने हैं (दो बार या कैंसल के बाद पेमेंट हुआ)`,
      outOfStock: (n: number) => `${n} आइटम स्टॉक में नहीं`,
      lowStock: (n: number) => `${n} आइटम का स्टॉक कम`,
      returnsRequested: (n: number) => `${n} रिटर्न रिक्वेस्ट देखनी हैं`,
      mediaFailed: (n: number) => `${n} फ़ोटो प्रोसेस नहीं हो पाईं`,
    },
    event: {
      order: (number: number, total: string) => `नया ऑर्डर #${number} · ${total}`,
      refund_needed: (number: number, amount: string) => `ऑर्डर #${number} पर ${amount} रिफ़ंड करें`,
      return: (number: number) => `रिटर्न R-${number} की रिक्वेस्ट आई`,
    },
  }),
]
