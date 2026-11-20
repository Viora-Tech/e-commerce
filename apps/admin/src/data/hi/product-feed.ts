import { productFeedContent } from '@/data/product-feed'
import { translation } from '@/lib/i18n'

export default [
  translation(productFeedContent, {
    heading: 'प्रोडक्ट फ़ीड',
    body: 'आपके पब्लिश किए गए प्रोडक्ट की एक फ़ाइल, जिसे कीमत की तुलना करने वाली साइटें, Google Merchant Center और फ़ीड टूल पढ़ सकते हैं: नाम, कीमत, तुलना कीमत, स्टॉक में है या नहीं, लिंक, फ़ोटो, ब्रांड और SKU। स्टॉक की गिनती, लागत और ड्राफ़्ट इसमें कभी नहीं होते।',
    toggle: 'प्रोडक्ट फ़ीड पब्लिश करें',
    toggleHelp:
      'शुरू में बंद रहता है। चालू रहने पर पता जानने वाला कोई भी फ़ीड पढ़ सकता है। प्रोडक्ट में बदलाव लगभग 15 मिनट में दिखते हैं।',
    xml: 'Google Merchant (XML)',
    csv: 'स्प्रेडशीट (CSV)',
    saveFirst: 'इन पतों पर फ़ीड पब्लिश करने के लिए सेव करें।',
  }),
]
