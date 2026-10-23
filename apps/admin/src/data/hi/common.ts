import {
  contactContent,
  copyButtonContent,
  dialogContent,
  reorderLabels,
  requiredMarkContent,
} from '@/data/common'
import { translation } from '@/lib/i18n'

export default [
  translation(copyButtonContent, {
    copy: (what) => `${what} कॉपी करें`,
    copied: (what) => `${what} कॉपी हो गया`,
  }),
  translation(dialogContent, {
    cancel: 'रद्द करें',
    close: 'बंद करें',
  }),
  translation(requiredMarkContent, {
    required: 'ज़रूरी',
  }),
  translation(contactContent, {
    call: 'कॉल करें',
    whatsapp: 'WhatsApp',
  }),
  translation(reorderLabels, {
    instructions: 'किसी आइटम को उठाने के लिए स्पेस दबाएं, खिसकाने के लिए ऐरो की, और छोड़ने के लिए फिर से स्पेस।',
    handle: (title) => `${title} को खींचकर क्रम बदलें`,
    picked: (title) => `${title} उठाया`,
    moved: (title, position, total) => `${title} को ${total} में से ${position} नंबर पर खिसकाया`,
    dropped: (title, position, total) => `${title} को ${total} में से ${position} नंबर पर छोड़ा`,
    cancelled: (title) => `${title} को खिसकाना कैंसिल हुआ`,
  }),
]
