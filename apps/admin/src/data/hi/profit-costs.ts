import { profitCostsContent } from '@/data/profit-costs'
import { translation } from '@/lib/i18n'

export default [
  translation(profitCostsContent, {
    title: 'मुनाफ़े के लिए खर्च',
    intro:
      'ऑर्डर के मुनाफ़े से हर पेमेंट तरीके और कैश ऑन डिलीवरी का खर्च घटता है। अगर गेटवे किसी पेमेंट पर अपनी फ़ीस बताता है, तो वही फ़ीस ली जाती है।',
    gateways: {
      heading: 'पेमेंट गेटवे की फ़ीस',
      help: 'हर पेमेंट से गेटवे कितना रखता है: प्रतिशत, और अगर तय रकम भी लेता है तो वह।',
      none: 'अभी कोई ऑनलाइन पेमेंट तरीका चालू नहीं है। Settings › Payments में चालू करें।',
    },
    cod: {
      heading: 'कैश ऑन डिलीवरी',
      help: 'ग्राहक से कैश लेने के लिए आपका कूरियर कितना रखता है।',
      label: 'कैश ऑन डिलीवरी',
    },
    percent: 'प्रतिशत (%)',
    fixed: 'तय रकम (₹)',
    methodNames: profitCostsContent.methodNames,
    save: 'सेव करें',
    saved: 'सेव हो गया',
    failed: 'सेव नहीं हो सका',
    invalid: (method) => `${method} की रकम जाँचें: 100 तक प्रतिशत और रुपये में रकम।`,
  }),
]
