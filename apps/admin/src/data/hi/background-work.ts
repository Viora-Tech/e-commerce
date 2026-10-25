import { backgroundWorkContent } from '@/data/background-work'
import { translation } from '@/lib/i18n'

export default [
  translation(backgroundWorkContent, {
    images: (count: string) => `${count} इमेज बैकग्राउंड में प्रोसेस हो रही हैं`,
    importing: 'बैकग्राउंड में इंपोर्ट चल रहा है',
    slower: 'इसके पूरा होने तक आपका स्टोर थोड़ा धीमा चल सकता है।',
    slowerFor: (minutes: number) =>
      `इसके पूरा होने तक (करीब ${minutes} मिनट) आपका स्टोर थोड़ा धीमा चल सकता है।`,
    importingToo: 'साथ में एक इंपोर्ट भी चल रहा है।',
  }),
]
