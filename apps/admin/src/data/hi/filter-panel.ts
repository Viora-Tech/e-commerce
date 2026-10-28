import { filterPanelContent } from '@/data/filter-panel'
import { translation } from '@/lib/i18n'

export default [
  translation(filterPanelContent, {
    heading: 'फ़िल्टर',
    clearAll: 'सब हटाएं',
    any: 'कोई भी',
    min: 'कम से कम',
    max: 'ज़्यादा से ज़्यादा',
    show: (n) => `${n} नतीजे दिखाएं`,
    search: 'खोजें',
    noMatches: 'कुछ नहीं मिला',
    more: (n) => `+${n}`,
    yes: 'हां',
    no: 'नहीं',
    custom: 'अपनी तारीखें',
    from: 'से',
    to: 'तक',
    range: {
      between: (from, to) => `${from}–${to}`,
      atLeast: (from) => `≥ ${from}`,
      atMost: (to) => `≤ ${to}`,
    },
  }),
]
