import { searchAppContent } from '@/data/search-app'
import { translation } from '@/lib/i18n'

export default [
  translation(searchAppContent, {
    title: 'Search & discovery',
    subtitle:
      'आपके स्टोर का सर्च पहले से टाइपो माफ़ करता है: “keybord” लिखने पर keyboards मिलते हैं। एक जैसे मतलब वाले शब्द जोड़ें ताकि ग्राहकों को वही मिले जो वे ढूँढ रहे हैं।',
    synonyms: {
      title: 'समानार्थी शब्द',
      description:
        'ऐसे शब्द जिनका आपके ग्राहकों के लिए एक ही मतलब है। हर लाइन में एक समूह, शब्द कॉमा से अलग करें।',
      label: 'समानार्थी समूह',
      placeholder: 'kb, keyboard\nmouse pad, mousepad, desk mat\ntee, t-shirt, tshirt',
      help: (max: number) =>
        `ज़्यादा से ज़्यादा ${max} समूह। किसी समूह के एक शब्द को सर्च करने पर बाकी शब्द भी मिलते हैं।`,
      save: 'शब्द सेव करें',
      saved: 'समानार्थी शब्द सेव हो गए',
    },
    failed: 'सेव नहीं हो पाया। फिर से कोशिश करें।',
  }),
]
