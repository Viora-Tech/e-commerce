import { contactContent, copyButtonContent, dialogContent } from '@/data/common'
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
  translation(contactContent, {
    call: 'कॉल करें',
    whatsapp: 'WhatsApp',
  }),
]
