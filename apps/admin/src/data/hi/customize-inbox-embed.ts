import { customizeInboxEmbedContent } from '@/data/customize-inbox-embed'
import { translation } from '@/lib/i18n'

export default [
  translation(customizeInboxEmbedContent, {
    label: 'ऑनलाइन स्टोर चैट',
    app: 'Inbox',
    description:
      'वह चैट बटन जिससे ग्राहक आपको मैसेज करते हैं। ये सेटिंग्स Inbox ऐप की हैं, इसलिए बदलते ही सेव हो जाती हैं, थीम के साथ नहीं।',
    greeting: 'स्वागत संदेश',
    greetingPlaceholder: 'नमस्ते, हम कैसे मदद करें?',
    manage: 'ऐप मैनेज करें',
    preview: 'प्रीव्यू',
    previewChat: 'चैट',
    saving: 'सेव हो रहा है…',
    saved: 'सेव हो गया',
    failed: 'चैट सेटिंग्स सेव नहीं हुईं। फिर से कोशिश करें।',
    loadFailed: 'चैट सेटिंग्स लोड नहीं हुईं।',
    themeColour: 'थीम का रंग',
    pickProducts: 'प्रोडक्ट चुनें',
    pickedProducts: (n: number) => (n === 0 ? 'आपके दो सबसे ज़्यादा बिकने वाले' : `${n} प्रोडक्ट चुने गए`),
  }),
]
