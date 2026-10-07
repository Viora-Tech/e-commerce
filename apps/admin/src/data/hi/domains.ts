import { domainCertificateContent } from '@/data/domains'
import { translation } from '@/lib/i18n'

export default [
  translation(domainCertificateContent, {
    issuing: 'आपका सुरक्षा सर्टिफ़िकेट बन रहा है। इसमें कुछ मिनट लग सकते हैं।',
    retrying:
      'सुरक्षा सर्टिफ़िकेट बनने में सामान्य से ज़्यादा समय लग रहा है। हम अपने आप कोशिश करते रहेंगे। अगर एक घंटे में न हो, तो सपोर्ट से संपर्क करें।',
  }),
]
