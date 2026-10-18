import { activityContent } from '@/data/activity'
import { translation } from '@/lib/i18n'

export default [
  translation(activityContent, {
    label: 'सूचनाएँ',
    unread: (n: number) => `${n} नए`,
    markAllRead: 'सब पढ़ा हुआ मार्क करें',
    attentionHeading: 'आपका ध्यान चाहिए',
    recentHeading: 'पिछले 7 दिन',
    tabs: { all: 'सभी', orders: 'ऑर्डर', payments: 'पेमेंट', stock: 'स्टॉक' },
    todayHeading: 'आज',
    earlierHeading: 'पहले',
    settings: 'सूचना सेटिंग',
    emptyTab: 'अभी यहां कुछ नहीं है।',
    footer: 'पिछले 7 दिनों के ऑर्डर, रिफ़ंड, रिटर्न और स्टॉक।',
    empty: {
      title: 'सब देख लिया',
      body: 'नए ऑर्डर, रिफ़ंड, रिटर्न और स्टॉक अलर्ट यहाँ दिखेंगे।',
    },
    failed: 'सूचनाएँ लोड नहीं हो पाईं। एक मिनट में फिर कोशिश होगी।',
    attention: {
      refundsFailed: {
        title: (n: number) => `${n} रिफ़ंड फ़ेल हुए`,
        detail: 'गेटवे ने मना कर दिया, शॉपर को पैसे वापस नहीं मिले।',
      },
      refundsNeeded: {
        title: (n: number) => `${n} पेमेंट रिफ़ंड करने हैं`,
        detail: 'दो बार पेमेंट हुआ, या ऑर्डर कैंसल होने के बाद।',
      },
      returnsRequested: {
        title: (n: number) => `${n} रिटर्न देखने हैं`,
        detail: 'मंज़ूर या मना करें ताकि शॉपर को पता चले आगे क्या होगा।',
      },
      outOfStock: {
        title: (n: number) => `${n} आइटम स्टॉक में नहीं`,
        detail: 'रीस्टॉक करने तक शॉपर इन्हें नहीं ख़रीद सकते।',
      },
      lowStock: {
        title: (n: number) => `${n} आइटम का स्टॉक कम`,
        detail: 'जल्दी रीस्टॉक करें ताकि ये बिकते रहें।',
      },
      mediaFailed: {
        title: (n: number) => `${n} फ़ोटो प्रोसेस नहीं हो पाईं`,
        detail: 'Files खोलकर दोबारा कोशिश करें या बदलें।',
      },
    },
    event: {
      order: (number: number) => `नया ऑर्डर #${number}`,
      refund_needed: (number: number) => `ऑर्डर #${number} पर रिफ़ंड बाकी`,
      return: (number: number) => `रिटर्न R-${number} की रिक्वेस्ट आई`,
    },
  }),
]
