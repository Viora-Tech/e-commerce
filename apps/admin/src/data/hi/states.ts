import { statesContent } from '@/data/states'
import { translation } from '@/lib/i18n'

export default [
  translation(statesContent, {
    loading: 'लोड हो रहा है',
    error: {
      heading: 'कुछ गड़बड़ हो गई',
      body: 'यह लोड नहीं हो पाया। थोड़ी देर बाद फिर कोशिश करें।',
      retry: 'फिर कोशिश करें',
      support: 'सपोर्ट से बात करें',
    },
    offline: {
      heading: 'आप ऑफ़लाइन हैं',
      body: 'इंटरनेट कनेक्शन देखें, फिर दोबारा कोशिश करें।',
      retry: 'दोबारा कोशिश करें',
    },
    noAccess: {
      heading: 'आपके पास इसकी अनुमति नहीं है',
      body: 'स्टोर के मालिक से इस पेज की अनुमति माँगें।',
      request: 'अनुमति माँगें',
    },
    notFound: {
      heading: 'यह पेज नहीं मिला',
      body: 'हो सकता है यह हट गया हो या मिटा दिया गया हो।',
      home: 'होम पर जाएं',
    },
    empty: {
      heading: 'यहाँ अभी कुछ नहीं है',
      body: 'शुरू करने के लिए पहला आइटम जोड़ें।',
      add: 'आइटम जोड़ें',
    },
  }),
]
