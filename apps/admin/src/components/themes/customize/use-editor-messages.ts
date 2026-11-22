import { customizeContent } from '@/data/customize'
import { themesContent } from '@/data/themes'
import { useCopy } from '@/hooks/use-copy'

/**
 * The Customize editor's toasts and template names in the member's language: loading,
 * publishing and creating a template.
 */
export function useEditorMessages() {
  return {
    themes: useCopy(themesContent),
    editor: useCopy(themesContent.editor),
    library: useCopy(themesContent.library),
    templates: useCopy(customizeContent.templates),
    createDialog: useCopy(customizeContent.createDialog),
  }
}
