import { accountContent } from '@/data/account'
import { translation } from '@/lib/i18n'

export default [
  translation(accountContent, {
    title: 'अकाउंट',
    intro: 'आपकी अपनी पसंद। ये सिर्फ़ इस ब्राउज़र पर आप पर लागू होती हैं, आपके स्टाफ़ पर नहीं।',
    language: {
      heading: 'एडमिन की भाषा',
      body: 'यह एडमिन किस भाषा में दिखे। आपका स्टोर और ग्राहकों को जाने वाले मैसेज नहीं बदलते।',
      label: 'भाषा',
      options: { en: 'English', hi: 'हिंदी (Hindi)' },
      partial: 'कुछ पेज अभी English में हैं। अनुवाद होते ही वे भी हिंदी में दिखने लगेंगे।',
      saved: 'भाषा बदल गई',
    },
    switcher: {
      label: 'भाषा',
    },
  }),
]
