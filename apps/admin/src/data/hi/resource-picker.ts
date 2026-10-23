import { resourcePickerContent } from '@/data/resource-picker'
import { translation } from '@/lib/i18n'

export default [
  translation(resourcePickerContent, {
    loading: 'लोड हो रहा है',
    failed: 'लिस्ट लोड नहीं हो पाई',
    retry: 'फिर से कोशिश करें',
    selectPage: 'दिख रहे सभी चुनें',
    selectedCount: (n) => `${n} चुने गए`,
    clear: 'हटाएं',
    cancel: 'रद्द करें',
    done: 'हो गया',
    oneKind: 'यहां चुनने पर दूसरे टैब में चुना हुआ हट जाएगा।',
  }),
]
