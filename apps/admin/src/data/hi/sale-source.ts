import { saleSourceContent } from '@/data/sale-source'
import { translation } from '@/lib/i18n'

export default [
  translation(saleSourceContent, {
    title: 'कहाँ से आया',
    column: 'सोर्स',
    channel: 'चैनल',
    cameFrom: 'यहाँ से आया',
    sourceMedium: 'सोर्स / मीडियम',
    campaign: 'कैंपेन',
    landing: 'पहला पेज',
    affiliate: 'एफ़िलिएट कोड',
    visited: 'विज़िट',
    online: 'ऑनलाइन स्टोर',
    notRecorded: 'सीधे आया, या रिकॉर्ड नहीं हुआ',
    channels: {
      direct: 'सीधे',
      organic_search: 'सर्च (फ़्री)',
      paid_search: 'सर्च विज्ञापन',
      social: 'सोशल',
      paid_social: 'सोशल विज्ञापन',
      email: 'ईमेल',
      whatsapp: 'WhatsApp',
      sms: 'SMS',
      ai_assistant: 'AI असिस्टेंट',
      referral: 'रेफ़रल',
      affiliate: 'एफ़िलिएट',
      other_paid: 'दूसरे विज्ञापन',
      untracked: 'पता नहीं',
    },
    admin: {
      channel: 'एडमिन',
      createdIn: 'एडमिन में बनाया गया',
      createdBy: 'किसने बनाया',
      someone: 'स्टाफ़ का कोई सदस्य',
      created: 'बनाया गया',
      via: 'किसके ज़रिए',
      sources: {
        admin: 'एडमिन',
        assistant: 'AI असिस्टेंट',
        mcp: 'जुड़ा हुआ AI एजेंट',
        api: 'एक्सेस टोकन',
        worker: 'बैकग्राउंड जॉब',
        storefront: 'स्टोरफ़्रंट',
      },
    },
  }),
]
