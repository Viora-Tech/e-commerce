/** "+91 98765 43210" from the stored "+919876543210"; anything else as typed. */
export function displayPhone(phone: string): string {
  const m = /^\+91(\d{5})(\d{5})$/.exec(phone.replace(/\s/g, ''))
  return m ? `+91 ${m[1]} ${m[2]}` : phone
}
