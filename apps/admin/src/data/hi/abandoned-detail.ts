import { abandonedDetailContent } from '@/data/abandoned-detail'
import { translation, untranslated } from '@/lib/i18n'

export default [
  translation(abandonedDetailContent, {
    title: 'अधूरा चेकआउट',
    back: { label: 'अधूरे चेकआउट' },
    heading: (ref: string) => `चेकआउट ${ref}`,
    summary: (who: string, left: string, total: string) => `${who} · ${left} छोड़ा · ${total}`,
    anonymous: 'कोई संपर्क नहीं',
    copyLink: 'कार्ट लिंक कॉपी करें',
    linkCopied: 'कार्ट लिंक कॉपी हो गया',
    linkFailed: 'लिंक कॉपी नहीं हुआ',
    sendReminder: 'रिमाइंडर भेजें',
    sendAgain: 'फिर भेजें',
    cart: {
      heading: 'कार्ट',
      items: (n: number) => `${n} आइटम`,
      quantity: (n: number) => `x ${n}`,
      subtotal: 'सबटोटल',
      shipping: 'शिपिंग',
      shippingValue: 'चेकआउट पर तय होगी',
      total: 'कुल',
      empty: 'इस कार्ट में कोई आइटम नहीं बचा',
    },
    customer: {
      heading: 'ग्राहक',
      name: 'नाम',
      email: 'ईमेल',
      phone: 'फ़ोन',
      source: 'कहाँ से आए',
      none: 'दिया नहीं गया',
    },
    reminder: {
      heading: 'रिमाइंडर',
      sub: 'ईमेल और WhatsApp पर, जहाँ ग्राहक ने मैसेज की इजाज़त दी है',
      notSent: 'अभी नहीं भेजा',
      sent: (when: string) => `${when} भेजा गया`,
      recovered: 'वापस आए',
      noEmail: 'इस चेकआउट में ईमेल नहीं है, इसलिए रिमाइंडर नहीं भेजा जा सकता',
      recoveredNote: 'ग्राहक ने यह ऑर्डर पूरा कर लिया',
    },
    activity: {
      heading: 'गतिविधि',
      started: 'चेकआउट शुरू किया',
      lastActive: 'कार्ट में आखिरी बार सक्रिय',
      reminded: 'रिमाइंडर भेजा गया',
      recovered: 'वापस आकर ऑर्डर किया',
    },
    toasts: {
      sent: (n: number) => (n === 1 ? 'रिमाइंडर भेजा गया' : `${n} चैनल पर रिमाइंडर भेजा गया`),
      failed: 'रिमाइंडर नहीं भेजा जा सका',
    },
    notFound: {
      heading: 'चेकआउट नहीं मिला',
      body: 'यह चेकआउट इस स्टोर में नहीं है।',
      action: { label: 'अधूरे चेकआउट पर वापस', href: untranslated },
    },
  }),
]
