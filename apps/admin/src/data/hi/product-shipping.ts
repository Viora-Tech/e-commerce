import { productShippingContent } from '@/data/product-shipping'
import { translation } from '@/lib/i18n'

export default [
  translation(productShippingContent, {
    physical: 'यह एक फ़िज़िकल प्रोडक्ट है',
    physicalHelp:
      'सर्विस या डाउनलोड के लिए बंद करें। इस पर शिपिंग चार्ज नहीं लगता, कोई शिपिंग प्रोफ़ाइल इसका रेट नहीं लगाती, और यह कभी शिपमेंट या पैकिंग स्लिप में नहीं जाता।',
  }),
]
