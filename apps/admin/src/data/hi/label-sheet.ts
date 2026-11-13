import { labelSheetContent } from '@/data/label-sheet'
import { translation } from '@/lib/i18n'

export default [
  translation(labelSheetContent, {
    paper: 'लेबल पेपर',
    formats: {
      thermal4x6: '4 × 6 इंच थर्मल · हर पेज पर 1',
      a4x4: 'A4 · हर पेज पर 4',
      original: 'कूरियर का अपना साइज़',
    },
    making: 'फ़ाइल बन रही है…',
    failed: 'लेबल फ़ाइल नहीं बन पाई। फिर कोशिश करें।',
    noneReady: 'इनमें से कोई लेबल अभी तैयार नहीं है। कूरियर ने अभी नहीं भेजे।',
    tooMany: (max) => `एक बार में ज़्यादा से ज़्यादा ${max} लेबल प्रिंट करें। कम चुनकर फिर कोशिश करें।`,
    leftOut: (n, list) => `${n} लेबल छोड़े गए: ${list}`,
    reasons: {
      not_found: 'नहीं मिला',
      cancelled: 'रद्द',
      no_label: 'कूरियर ने अभी नहीं भेजा',
      failed: 'कूरियर से नहीं मिला, फिर कोशिश करें',
      unreadable: 'PDF नहीं है',
    },
  }),
]
