import { gatewayKeysContent } from '@/data/gateway-keys'
import { translation } from '@/lib/i18n'

export default [
  translation(gatewayKeysContent, {
    banner: {
      title: (name: string) => `${name} ने आपकी API keys अस्वीकार कर दीं — उन्हें दोबारा डालें`,
      body: (name: string) =>
        `अभी ग्राहक ${name} से पेमेंट नहीं कर सकते, इसलिए checkout उसे छिपा देता है और आपके दूसरे पेमेंट तरीके दिखाता है। अपने ${name} dashboard से Key ID और Key secret दोबारा कॉपी करें, दोनों एक ही mode (Test या Live) से, और सेव करें।`,
      said: (name: string, words: string) => `${name} ने कहा: “${words}”`,
      since: (when: string) => `${when} से। Checkout हर 10 मिनट में keys दोबारा जाँचता है।`,
      action: 'Keys दोबारा डालें',
    },
  }),
]
