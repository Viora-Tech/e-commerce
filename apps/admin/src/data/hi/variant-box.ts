import { variantBoxContent } from '@/data/variant-box'
import { translation } from '@/lib/i18n'

export default [
  translation(variantBoxContent, {
    label: 'डिब्बा',
    help: 'दूसरा नाम वाला डिब्बा तभी चुनें जब यह वेरिएंट बाकी प्रोडक्ट से अलग डिब्बे में जाता हो।',
    sameAsProduct: (box) => `प्रोडक्ट वाला (${box})`,
    storeDefault: 'स्टोर का डिफ़ॉल्ट डिब्बा',
    custom: (l, w, h) => `कस्टम ${l} × ${w} × ${h} cm`,
    ownCustom: (l, w, h) => `अपना साइज़ (${l} × ${w} × ${h} cm)`,
    ownStoreDefault: 'स्टोर का डिफ़ॉल्ट डिब्बा',
    missing: 'हटाया गया डिब्बा',
    chip: 'अपना डिब्बा',
    ownVariants: (list) => `अपने डिब्बे वाले वेरिएंट: ${list}।`,
    allOwn:
      'हर वेरिएंट ने अपना डिब्बा चुना है, इसलिए यह पैकेज इस्तेमाल नहीं होता। किसी वेरिएंट का डिब्बा वेरिएंट टैब में उसके बदलें डायलॉग में बदलें।',
  }),
]
