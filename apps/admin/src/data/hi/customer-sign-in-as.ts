import { customerSignInAsContent } from '@/data/customer-sign-in-as'
import { translation } from '@/lib/i18n'

export default [
  translation(customerSignInAsContent, {
    menu: 'ग्राहक के रूप में साइन इन करें',
    title: 'इस ग्राहक के रूप में साइन इन करें?',
    body: (name: string) =>
      `स्टोर एक नए टैब में खुलेगा, एक घंटे के लिए ${name} के रूप में साइन इन। आप उनका कार्ट, ऑर्डर और पते देखेंगे, और वहाँ आप जो भी करेंगे वह उनकी ओर से होगा। उनकी टाइमलाइन और गतिविधि लॉग में दर्ज होगा कि आपने साइन इन किया।`,
    unnamed: 'इस ग्राहक',
    confirm: 'स्टोर खोलें',
    cancel: 'रद्द करें',
    failed: 'इस ग्राहक के रूप में साइन इन नहीं हो सका। फिर से कोशिश करें।',
  }),
]
