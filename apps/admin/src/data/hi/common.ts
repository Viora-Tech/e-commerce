import { copyButtonContent } from '@/data/common'
import { translation } from '@/lib/i18n'

export default [
  translation(copyButtonContent, {
    copy: (what) => `${what} कॉपी करें`,
    copied: (what) => `${what} कॉपी हो गया`,
  }),
]
