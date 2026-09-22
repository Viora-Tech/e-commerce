const ONES = [
  '',
  'One',
  'Two',
  'Three',
  'Four',
  'Five',
  'Six',
  'Seven',
  'Eight',
  'Nine',
  'Ten',
  'Eleven',
  'Twelve',
  'Thirteen',
  'Fourteen',
  'Fifteen',
  'Sixteen',
  'Seventeen',
  'Eighteen',
  'Nineteen',
]
const TENS = ['', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety']

/** 0 to 99. */
function twoDigits(n: number): string {
  if (n < 20) return ONES[n] ?? ''
  const tens = TENS[Math.floor(n / 10)] ?? ''
  const ones = ONES[n % 10] ?? ''
  return ones ? `${tens} ${ones}` : tens
}

/** 0 to 999. */
function threeDigits(n: number): string {
  const hundreds = Math.floor(n / 100)
  const rest = n % 100
  const parts = []
  if (hundreds) parts.push(`${ONES[hundreds]} Hundred`)
  if (rest) parts.push(twoDigits(rest))
  return parts.join(' ')
}

/**
 * Whole number in the Indian system: crore, lakh, thousand, hundred.
 * Past 99 crore the crore count itself is spelled the same way, so
 * 1,00,00,00,000 reads "One Hundred Crore".
 */
export function indianNumberInWords(n: number): string {
  const value = Math.floor(Math.abs(n))
  if (value === 0) return 'Zero'
  const crore = Math.floor(value / 1_00_00_000)
  const lakh = Math.floor((value % 1_00_00_000) / 1_00_000)
  const thousand = Math.floor((value % 1_00_000) / 1_000)
  const rest = value % 1_000
  const parts = []
  if (crore) parts.push(`${indianNumberInWords(crore)} Crore`)
  if (lakh) parts.push(`${twoDigits(lakh)} Lakh`)
  if (thousand) parts.push(`${twoDigits(thousand)} Thousand`)
  if (rest) parts.push(threeDigits(rest))
  return parts.join(' ')
}

/** "Rupees One Lakh Twenty Three Thousand Four Hundred Fifty Six and Seventy Eight Paise Only". */
export function amountInWords(paise: number): string {
  const whole = Math.floor(Math.abs(paise) / 100)
  const fraction = Math.abs(paise) % 100
  const rupees = `Rupees ${indianNumberInWords(whole)}`
  return fraction ? `${rupees} and ${twoDigits(fraction)} Paise Only` : `${rupees} Only`
}
