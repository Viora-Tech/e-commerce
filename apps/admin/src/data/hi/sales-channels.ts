import { salesChannelsContent } from '@/data/sales-channels'
import { translation, untranslated } from '@/lib/i18n'

/** Only the connection states and the AI agents' waiting list so far; the rest stays English. */
export default [
  translation(salesChannelsContent, {
    orderCard: untranslated,
    unavailable: untranslated,
    agents: untranslated,
    social: untranslated,
    status: {
      connected: 'जुड़ा है',
      requested: 'मंज़ूरी का इंतज़ार',
      listed: 'सूची में · अभी लाइव नहीं',
      not_connected: 'जुड़ा नहीं',
      attention: 'ध्यान दें',
      syncing: 'सिंक हो रहा है',
      paused: 'रुका हुआ',
    },
    bar: untranslated,
    agentList: {
      bar: (names: string) => `${names}: सूची में, अभी लाइव नहीं`,
      barBody:
        'हर एजेंट के भारत में स्टोर के लिए खुलते ही हम आपका स्टोर वहाँ लिस्ट करेंगे। तब तक कुछ भी शेयर नहीं होता।',
      title: (name: string) => `${name}: सूची में, अभी लाइव नहीं`,
      body: (name: string) =>
        `जब ${name} भारत में स्टोर के लिए खुलेगा, हम आपका स्टोर वहाँ लिस्ट करेंगे। तब तक कुछ भी शेयर नहीं होता।`,
      since: (date: string) => `${date} से सूची में।`,
      withdraw: 'सूची से हटाएं',
    },
    card: untranslated,
    period: untranslated,
    vsLast: untranslated,
    overview: untranslated,
    getReady: untranslated,
    orders: untranslated,
    connect: untranslated,
    socialConnect: untranslated,
    live: untranslated,
    readiness: untranslated,
    controls: untranslated,
    socialPage: untranslated,
  }),
]
