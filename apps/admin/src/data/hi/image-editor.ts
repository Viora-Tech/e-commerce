import { imageEditorContent } from '@/data/image-editor'
import { translation } from '@/lib/i18n'

export default [
  translation(imageEditorContent, {
    title: 'इमेज एडिट करें',
    description:
      'फ़ोटो को क्रॉप करें, सीधा करें और चमक ठीक करें। सेव करने पर एडिट की हुई कॉपी उसकी जगह लगती है।',
    open: (name: string) => `इमेज ${name} एडिट करें`,
    loading: 'फ़ोटो लोड हो रही है…',
    loadFailed:
      'यह फ़ोटो एडिट के लिए नहीं खुल पाई। अगर यह आपके अपने स्टोरेज (R2 या S3) पर है, तो उसके CORS नियम में GET की अनुमति दें।',
    shape: {
      label: 'आकार',
      free: 'फ़्री',
      square: 'चौकोर 1:1',
      portrait: 'पोर्ट्रेट 4:5',
      tall: 'लंबा 3:4',
      wide: 'बैनर 16:9',
    },
    zoom: 'ज़ूम',
    rotateLeft: 'बाएं घुमाएं',
    rotateRight: 'दाएं घुमाएं',
    flipX: 'आड़ा पलटें',
    flipY: 'उल्टा पलटें',
    adjust: {
      heading: 'एडजस्ट',
      brightness: 'चमक',
      contrast: 'कंट्रास्ट',
      saturation: 'रंग',
      warmth: 'गर्माहट',
      sharpen: 'शार्पनेस',
    },
    auto: 'ऑटो सुधार',
    reset: 'रीसेट',
    cancel: 'रद्द करें',
    save: 'इमेज सेव करें',
    saving: 'सेव हो रहा है…',
    saved: 'इमेज बदल गई। रखने के लिए प्रोडक्ट सेव करें।',
    savedCopy: 'एडिट की गई कॉपी आपकी फ़ाइलों में जुड़ गई। ओरिजिनल वैसी ही है।',
    failed: 'एडिट की गई इमेज सेव नहीं हो पाई। फिर से कोशिश करें।',
  }),
]
