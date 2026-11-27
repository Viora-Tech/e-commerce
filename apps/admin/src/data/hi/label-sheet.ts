import { labelPageContent, labelSheetContent } from '@/data/label-sheet'
import { translation } from '@/lib/i18n'

export default [
  translation(labelSheetContent, {
    paper: 'लेबल पेपर',
    formats: {
      thermal4x6: '4 × 6 इंच थर्मल · हर पेज पर 1',
      thermal100x150: '100 × 150 mm थर्मल · हर पेज पर 1',
      a4x4: 'A4 · हर पेज पर 4',
      original: 'कूरियर का अपना साइज़',
    },
    making: 'फ़ाइल बन रही है…',
    failed: 'लेबल फ़ाइल नहीं बन पाई। फिर कोशिश करें।',
    noneReady: 'इनमें से कोई लेबल अभी तैयार नहीं है। कूरियर ने अभी नहीं भेजे।',
    tooMany: (max) => `एक बार में ज़्यादा से ज़्यादा ${max} लेबल प्रिंट करें। कम चुनकर फिर कोशिश करें।`,
    leftOut: (n, list) => `${n} लेबल छोड़े गए: ${list}`,
    skipLine: (order, courier, reason) =>
      [order === null ? null : `#${order}`, courier ? `${courier}: ${reason}` : reason]
        .filter(Boolean)
        .join(' '),
    reasons: {
      not_found: 'नहीं मिला',
      cancelled: 'रद्द',
      no_label: 'अभी लेबल नहीं',
      failed: 'नहीं दिया, फिर कोशिश करें',
      unreadable: 'PDF नहीं है',
    },
  }),
  translation(labelPageContent, {
    title: 'लेबल तैयार नहीं',
    close: 'यह टैब बंद करें और ऑर्डर से फिर कोशिश करें।',
  }),
]
