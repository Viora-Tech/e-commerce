/** SOURCE OF TRUTH: PIN code to state check — WHAT: which states a PIN code can belong to (the India Post directory when installed, else the first two digits of the PIN) and whether a checkout's state agrees / WHY: the state picks the shipping zone and CGST+SGST versus IGST, so a state typed by the client that contradicts the PIN would mis-price shipping and tax (security audit D-06) */

/*
 * The first two digits of a PIN code are India Post's postal sorting district group,
 * which sits inside one postal circle. Circles mostly follow state lines, but a few
 * prefixes cover a neighbouring state or union territory too (Goa inside Maharashtra's
 * 40, Sikkim inside West Bengal's 73, Puducherry's enclaves, Bihar and Jharkhand, Uttar
 * Pradesh and Uttarakhand), so each prefix allows a set. Facts from India Post's public
 * PIN code allocation ("Postal Index Number", indiapost.gov.in); no dataset copied.
 * Deliberately generous: it exists to catch a state that cannot be right, never to turn
 * away a real address. Prefixes 90-99 are the Army Postal Service and are not checked.
 */
const PREFIX_STATES: Readonly<Record<string, readonly string[]>> = {
  '11': ['DL'],
  '12': ['HR'],
  '13': ['HR', 'PB'],
  '14': ['PB'],
  '15': ['PB'],
  '16': ['PB', 'CH', 'HR'],
  '17': ['HP'],
  '18': ['JK'],
  '19': ['JK', 'LA'],
  '20': ['UP'],
  '21': ['UP'],
  '22': ['UP'],
  '23': ['UP'],
  '24': ['UP', 'UK'],
  '25': ['UP'],
  '26': ['UK', 'UP'],
  '27': ['UP'],
  '28': ['UP'],
  '30': ['RJ'],
  '31': ['RJ'],
  '32': ['RJ'],
  '33': ['RJ'],
  '34': ['RJ'],
  '36': ['GJ', 'DN'],
  '37': ['GJ'],
  '38': ['GJ'],
  '39': ['GJ', 'DN'],
  '40': ['MH', 'GA'],
  '41': ['MH'],
  '42': ['MH'],
  '43': ['MH'],
  '44': ['MH'],
  '45': ['MP'],
  '46': ['MP'],
  '47': ['MP'],
  '48': ['MP', 'CG'],
  '49': ['CG'],
  '50': ['TS', 'AP'],
  '51': ['AP', 'TS'],
  '52': ['AP'],
  '53': ['AP', 'PY', 'OD'],
  '56': ['KA'],
  '57': ['KA'],
  '58': ['KA'],
  '59': ['KA'],
  '60': ['TN', 'PY'],
  '61': ['TN'],
  '62': ['TN'],
  '63': ['TN'],
  '64': ['TN'],
  '67': ['KL', 'PY'],
  '68': ['KL', 'LD'],
  '69': ['KL'],
  '70': ['WB'],
  '71': ['WB'],
  '72': ['WB'],
  '73': ['WB', 'SK'],
  '74': ['WB', 'AN'],
  '75': ['OD'],
  '76': ['OD'],
  '77': ['OD'],
  '78': ['AS'],
  '79': ['AR', 'AS', 'ML', 'MN', 'MZ', 'NL', 'TR'],
  '80': ['BR'],
  '81': ['BR', 'JH'],
  '82': ['BR', 'JH'],
  '83': ['JH', 'BR'],
  '84': ['BR'],
  '85': ['BR', 'JH'],
}

/**
 * The states a six digit PIN code may belong to. `exact` is the India Post directory's
 * answer for this PIN when it is installed; it wins over the prefix table. Null means
 * "cannot tell" (Army Postal Service, an unallocated prefix): nothing is refused.
 */
function statesForPincode(pincode: string, exact?: string | null): readonly string[] | null {
  if (exact) return [exact.toUpperCase()]
  if (!/^[1-9]\d{5}$/.test(pincode)) return null
  return PREFIX_STATES[pincode.slice(0, 2)] ?? null
}

/**
 * The state a PIN code must be in when its prefix allows only one (11 is Delhi, 56
 * Karnataka), so the checkout can fill the state in as the shopper types. Null when
 * the prefix spans several states or is not checked; the shopper picks then.
 */
export function stateForPincode(pincode: string): string | null {
  const allowed = statesForPincode(pincode)
  return allowed?.length === 1 ? (allowed[0] ?? null) : null
}

/** Whether a checkout's state can be right for its PIN code. */
export function stateMatchesPincode(
  pincode: string,
  stateCode: string,
  exact?: string | null,
): boolean {
  const allowed = statesForPincode(pincode, exact)
  if (!allowed) return true
  return allowed.includes(stateCode.trim().toUpperCase())
}
