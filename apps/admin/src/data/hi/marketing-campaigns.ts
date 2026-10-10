import { campaignsContent } from '@/data/marketing-campaigns'
import { translation } from '@/lib/i18n'

export default [
  translation(campaignsContent, {
    title: 'कैंपेन',
    resource: { singular: 'कैंपेन', plural: 'कैंपेन' },
    create: 'कैंपेन बनाएं',
    createEmail: 'ईमेल कैंपेन',
    createEmailHint: 'किसी सेगमेंट को डिज़ाइन किया हुआ ईमेल।',
    createWhatsapp: 'WhatsApp ब्रॉडकास्ट',
    createWhatsappHint: 'मंज़ूर टेम्पलेट, उन ग्राहकों को जिन्होंने हां कहा है।',
    tabs: { all: 'सभी', sent: 'भेजे गए', scheduled: 'शेड्यूल', draft: 'ड्राफ़्ट' },
    summary: (count, sent, sales) => `${count} कैंपेन · ${sent} भेजे गए · ${sales} की बिक्री`,
    summaryEmpty: 'अभी कोई कैंपेन नहीं',
    back: 'ग्रोथ',
    notSent: 'भेजा नहीं',
    row: { open: 'कैंपेन खोलें' },
    empty: {
      heading: 'अपना पहला कैंपेन भेजें',
      body: 'ग्राहकों के एक समूह को WhatsApp या ईमेल पर ऑफ़र, रीस्टॉक या खबर भेजें। हम दिखाते हैं कि किसने खोला और क्या खरीदा।',
    },
    columns: {
      name: 'कैंपेन',
      status: 'स्टेटस',
      audience: 'किसे',
      sent: 'कितनों को भेजा',
      openRate: 'खोला',
      clickRate: 'क्लिक रेट',
      orders: 'ऑर्डर',
      sales: 'बिक्री',
      date: 'तारीख',
    },
    kind: { email: 'ईमेल', whatsapp: 'WhatsApp' },
    allSubscribers: 'सभी सब्सक्राइबर',
    status: {
      draft: 'ड्राफ़्ट',
      scheduled: 'शेड्यूल',
      sending: 'भेजा जा रहा है',
      sent: 'भेजा गया',
      cancelled: 'रद्द',
      failed: 'नहीं गया',
    },
    tiles: {
      sent: 'भेजे गए मैसेज',
      openRate: 'औसत खुलने की दर',
      clickRate: 'औसत क्लिक दर',
      sales: 'कैंपेन से बिक्री',
      period: 'सभी कैंपेन',
    },
  }),
]
