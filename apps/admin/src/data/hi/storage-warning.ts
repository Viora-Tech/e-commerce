import { storageWarningContent } from '@/data/storage-warning'
import { translation } from '@/lib/i18n'

const importer = {
  title: 'पहले क्लाउड स्टोरेज जोड़ें',
  body: 'अभी इंपोर्ट की गई इमेज सर्वर की डिस्क पर रहती हैं और स्टोर अपडेट होने पर मिट सकती हैं।',
  action: 'स्टोरेज जोड़ें',
  anyway: 'फिर भी इंपोर्ट करें',
}

export default [
  translation(storageWarningContent.importer, importer),
  translation(storageWarningContent, {
    title: 'आपकी इमेज सर्वर की डिस्क पर रखी हैं',
    body: 'स्टोर अपडेट होने पर ये हर बार मिट जाती हैं, और ग्राहकों को शायद न दिखें। इमेज सुरक्षित रखने के लिए Cloudflare R2 या Amazon S3 जोड़ें।',
    action: 'स्टोरेज जोड़ें',
    importer,
  }),
]
