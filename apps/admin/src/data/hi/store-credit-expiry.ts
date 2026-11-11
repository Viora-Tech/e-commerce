import { storeCreditExpiryContent } from '@/data/store-credit-expiry'
import { translation } from '@/lib/i18n'

export default [
  translation(storeCreditExpiryContent, {
    label: 'स्टोर क्रेडिट की एक्सपायरी (वैकल्पिक)',
    placeholder: 'कभी एक्सपायर नहीं होगा',
    hint: 'वह आखिरी दिन जब तक इसे खर्च किया जा सकता है। उसके बाद जो बचा है वह बैलेंस से हट जाता है। खाली छोड़ें तो कभी एक्सपायर नहीं होगा।',
    backHint: (day: string | null) =>
      day
        ? `इस ऑर्डर में लगे स्टोर क्रेडिट का आखिरी दिन (${day}) भरा गया है। इसे बदलें, या खाली करें ताकि यह कभी एक्सपायर न हो।`
        : 'इस ऑर्डर में लगा स्टोर क्रेडिट कभी एक्सपायर नहीं होता था। आखिरी दिन चुनें, या खाली छोड़ें ताकि यह कभी एक्सपायर न हो।',
    returned: (amount: string) =>
      `इस ऑर्डर में लगा ${amount} का स्टोर क्रेडिट ग्राहक के बैलेंस में वापस जाता है।`,
  }),
]
