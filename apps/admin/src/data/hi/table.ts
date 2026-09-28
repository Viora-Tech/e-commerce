import { tableContent } from '@/data/table'
import { translation } from '@/lib/i18n'

export default [
  translation(tableContent, {
    search: (plural) => `${plural} खोजें`,
    number: 'नं.',
    filter: 'फ़िल्टर',
    sort: 'क्रम',
    more: 'और',
    clearFilters: 'हटाएं',
    view: 'देखें',
    toggleColumns: 'कॉलम दिखाएं/छिपाएं',
    sortAsc: 'छोटे से बड़ा',
    sortDesc: 'बड़े से छोटा',
    hideColumn: 'कॉलम छिपाएं',
    selectAll: 'सब चुनें',
    selectRow: 'लाइन चुनें',
    selected: (n, singular, plural) => `${n} ${n === 1 ? singular : plural} चुने गए`,
    clearSelection: 'हटाएं',
    removeFilter: (label) => `${label} हटाएं`,
    range: (from, to, total) => `${total} में से ${from}-${to}`,
    pageOf: (page, pages) => `पेज ${page} / ${pages}`,
    previousLabel: 'पिछला',
    nextLabel: 'अगला',
    ellipsis: '.....',
    noResults: 'कुछ नहीं मिला',
    previous: 'पिछला पेज',
    next: 'अगला पेज',
    emptyHeading: (plural) => `अभी कोई ${plural} नहीं`,
    emptyBody: 'कुछ और खोजें या फ़िल्टर हटा दें।',
  }),
]
