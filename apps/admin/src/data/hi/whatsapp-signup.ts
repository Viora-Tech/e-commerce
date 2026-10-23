import { whatsappSignupContent } from '@/data/whatsapp-signup'
import { translation } from '@/lib/i18n'

export default [
  translation(whatsappSignupContent, {
    title: 'एक कदम में जोड़ें',
    intro:
      'Facebook से साइन इन करें और अपना WhatsApp Business अकाउंट और नंबर चुनें या बनाएं। नीचे की जानकारी हम आपके लिए भर देंगे।',
    connect: 'Facebook से जोड़ें',
    connecting: 'Facebook में पूरा हो रहा है…',
    saving: 'आपका नंबर जोड़ रहे हैं…',
    connected: 'WhatsApp जुड़ गया',
    cancelled: 'WhatsApp साइन-अप पूरा होने से पहले बंद हो गया।',
    failed: 'WhatsApp जुड़ नहीं पाया। फिर कोशिश करें।',
    blocked: 'Facebook नहीं खुला। इस पेज के लिए पॉप-अप चालू करें और फिर कोशिश करें।',
    manual: 'या नीचे जानकारी खुद भरें।',
    account: 'जुड़ा हुआ अकाउंट',
    number: 'नंबर',
    name: 'दिखने वाला नाम',
    quality: 'क्वालिटी',
    connectedOn: 'जुड़ा',
    disconnect: 'हटाएं',
    disconnected: 'WhatsApp हटा दिया',
    status: {
      active: 'चल रहा है',
      restricted: 'Meta ने सीमित किया',
      disabled: 'Meta ने बंद किया',
      disconnected: 'Meta में हटाया गया',
    },
    statusHelp:
      'Meta ने इस अकाउंट में बदलाव किया। वजह देखने के लिए WhatsApp Manager खोलें, फिर ज़रूरत हो तो दोबारा जोड़ें।',
    notRegistered:
      'Meta ने अभी यह नंबर भेजने के लिए रजिस्टर नहीं किया। WhatsApp Manager में नंबर खोलकर रजिस्ट्रेशन पूरा करें, फिर दोबारा जोड़ें।',
    lastFailure: 'आखिरी फ़ेल मैसेज',
    lastTemplate: 'आखिरी टेम्पलेट अपडेट',
    billing:
      'Meta WhatsApp मैसेज का बिल आपके WhatsApp Business अकाउंट पर भेजता है। WhatsApp Manager में (रुपयों में) पेमेंट का तरीका जोड़ें ताकि मैसेज जाते रहें।',
  }),
]
