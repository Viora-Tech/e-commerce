import { backInStockContent } from '@/data/back-in-stock'
import { translation, untranslated } from '@/lib/i18n'

export default [
  translation(backInStockContent, {
    // The Overview and Signups pages still read the English copy directly.
    overview: untranslated,
    signups: untranslated,
    settings: {
      title: 'सेटिंग्स',
      subtitle: 'सारे बदलाव एक साथ सेव होते हैं। हर हिस्सा बताता है कि वह क्या तय करता है।',
      channels: 'चैनल',
      channelsHelp: 'वेरिएंट वापस आने की खबर शॉपर्स तक कैसे पहुंचे।',
      emailEnabled: 'ईमेल',
      emailHelp: 'वेरिएंट वापस आने पर एक ईमेल',
      whatsappEnabled: 'WhatsApp',
      whatsappHelp: 'इसके लिए WhatsApp ऐप सेट होना चाहिए',
      sending: 'भेजना',
      sendingHelp: 'बड़ी वेटिंग लिस्ट आपका भेजने का कोटा एक साथ खर्च न करे।',
      batchSize: 'हर मिनट अलर्ट',
      batchSizeHint: (signups: number, minutes: number) =>
        minutes === 0
          ? `${signups.toLocaleString('en-IN')} साइनअप वाला रीस्टॉक एक मिनट के अंदर चला जाता है।`
          : `${signups.toLocaleString('en-IN')} साइनअप वाला रीस्टॉक लगभग ${minutes} मिनट में चला जाता है।`,
      storefront: 'स्टोरफ्रंट',
      storefrontHelp: 'स्टॉक खत्म प्रोडक्ट्स पर “Notify me” बटन।',
      buttonText: 'बटन का टेक्स्ट',
      buttonTextDefault: (label: string) => `${label} (डिफ़ॉल्ट)`,
      askPhone: 'फ़ोन नंबर मांगें',
      askPhoneHelp: 'सिर्फ़ तब दिखता है जब WhatsApp चालू हो',
      save: 'सेव करें',
      discard: 'रद्द करें',
      saving: 'सेव हो रहा है…',
      saved: 'सेटिंग्स सेव हो गईं',
      failed: 'सेटिंग्स सेव नहीं हो सकीं',
    },
  }),
]
