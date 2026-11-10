import { productBulkShippingContent } from '@/data/product-bulk-shipping'
import { translation } from '@/lib/i18n'

export default [
  translation(productBulkShippingContent, {
    menu: 'वज़न और बॉक्स सेट करें',
    title: 'वज़न और बॉक्स सेट करें',
    help: (n) =>
      `चुने गए ${n} प्रोडक्ट के हर वेरिएंट के लिए। जो फ़ील्ड खाली छोड़ें, उसमें हर वेरिएंट का अपना मान बना रहेगा।`,
    weight: 'प्रोडक्ट का वज़न (g)',
    weightHelp: 'रिटेल बॉक्स के साथ प्रोडक्ट। पैकिंग न जोड़ें: वह नीचे चुने बॉक्स से आती है।',
    box: 'बॉक्स',
    keepBox: 'हर वेरिएंट का अपना बॉक्स रखें',
    noBox: 'कोई बॉक्स नहीं (मुख्य बॉक्स)',
    boxSize: (name, l, w, h, packing) => `${name} · ${l} × ${w} × ${h} cm · ${packing} g पैकिंग`,
    option: 'सिर्फ़ इस ऑप्शन वाले वेरिएंट (वैकल्पिक)',
    optionPlaceholder: 'XL',
    optionHelp: 'जैसे XL या Alu। सिर्फ़ ठीक वही ऑप्शन वाले वेरिएंट को वज़न और बॉक्स मिलेगा।',
    cancel: 'रद्द करें',
    apply: 'लागू करें',
    nothing: 'वज़न डालें या बॉक्स चुनें।',
    done: (n) => `${n} वेरिएंट अपडेट हुए`,
    noneMatched: 'किसी वेरिएंट में यह ऑप्शन नहीं है। कुछ नहीं बदला।',
    failed: 'प्रोडक्ट अपडेट नहीं हो सके',
  }),
]
