import { storeCreditGiftCardsContent } from '@/data/store-credit-gift-cards'
import { translation } from '@/lib/i18n'

export default [
  translation(storeCreditGiftCardsContent, {
    heading: 'गिफ़्ट कार्ड जो स्टोर क्रेडिट थे',
    intro:
      'स्टोर क्रेडिट अब ग्राहक का बैलेंस है, गिफ़्ट कार्ड नहीं। इन कार्ड को ग्राहकों के बैलेंस में डालें: बची रकम स्टोर क्रेडिट बन जाती है और कार्ड का कोड काम करना बंद कर देता है।',
    origin: {
      refund: 'यहाँ बना रिफ़ंड कार्ड',
      shopify: 'Shopify से इंपोर्ट',
    },
    suggestedNote:
      'रिफ़ंड कार्ड पहले से चुने हुए हैं। Shopify यह नहीं बताता कि उसके कौन से कार्ड स्टोर क्रेडिट थे, उन्हें आप खुद चुनें।',
    to: (who: string) => `${who} को`,
    newCustomer: (email: string) => `${email} को (ग्राहक रिकॉर्ड बनेगा)`,
    expires: (day: string) => `एक्सपायरी वही रहेगी: आखिरी दिन ${day}`,
    problems: {
      no_customer: 'कोई ग्राहक या ईमेल नहीं, इसलिए डालने के लिए कोई बैलेंस नहीं',
      expired: 'एक्सपायर हो चुका, डालने को कुछ नहीं',
    },
    selectAll: 'सभी चुनें',
    move: (count: number) =>
      count === 1 ? '1 कार्ड बैलेंस में डालें' : `${count} कार्ड बैलेंस में डालें`,
    confirmTitle: 'स्टोर क्रेडिट में डालें?',
    confirmBody: (amount: string) =>
      `${amount} ग्राहकों के स्टोर क्रेडिट बैलेंस में जाएगा, और इन कार्ड के कोड काम करना बंद कर देंगे। हर कार्ड एक ही बार जाता है; दोबारा चलाने से कुछ नहीं बदलता।`,
    confirm: 'बैलेंस में डालें',
    done: (moved: number, skipped: number) =>
      skipped > 0
        ? `${moved} डाले गए, ${skipped} नहीं डाले जा सके`
        : `${moved} कार्ड स्टोर क्रेडिट में डाले गए`,
    skipped: {
      not_found: 'नहीं मिला',
      empty: 'कोई रकम नहीं बची',
      disabled: 'बंद है',
      expired: 'एक्सपायर',
      currency: 'रुपये में नहीं',
      no_customer: 'कोई ग्राहक नहीं',
      refused: 'मना हुआ',
    },
    failed: 'कार्ड नहीं डाले जा सके। फिर से कोशिश करें।',
    loadFailed: 'कार्ड लोड नहीं हुए।',
  }),
]
