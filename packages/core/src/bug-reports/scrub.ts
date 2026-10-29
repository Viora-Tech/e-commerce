/** SOURCE OF TRUTH: secret scrubbing for bug reports — WHAT: removes what looks like a credential (key=value secrets, Bearer tokens, six-digit codes, long random runs) from free text / WHY: a report goes to GitHub and the team's reply comes back to the admin; neither may carry a token or a sign-in code */

const REDACTED = '[redacted]'

/** `Bearer <token>` anywhere (headers pasted into a report, fetch errors). */
const BEARER = /\bBearer\s+[A-Za-z0-9\-._~+/]+=*/gi

/** `key=value` / `"apiKey": "value"` where the name says secret. Keeps the name, drops the value. */
const SECRET_PAIR =
  /(["']?\b[\w-]*(?:token|secret|passw(?:or)?d|pwd|key|otp|signature|session|cookie|credential|auth)[\w-]*["']?\s*[:=]\s*["']?)([^\s"'&,;)}\]<>[]+)/gi

/** A six-digit code with "code", "OTP" or "PIN" just before it... */
const CODE_AFTER_WORD = /\b(code|otp|pin)\b([^\d\n]{0,20}?)\b\d{6}\b/gi
/** ...or just after it ("123456 is your login code"). */
const CODE_BEFORE_WORD = /\b\d{6}\b(?=[^\d\n]{0,20}\b(?:code|otp|pin)\b)/gi

/** Longer than 32 characters of hex: hashes, signatures, raw keys. */
const LONG_HEX = /\b[0-9a-fA-F]{33,}\b/g
/** Longer than 32 base64-ish characters. Only redacted when it mixes upper, lower and digits. */
const LONG_BASE64 = /[A-Za-z0-9+/_-]{33,}={0,2}/g

/** GitHub token prefixes (`ghp_`, `github_pat_`, ...), whatever their length. */
const GITHUB_TOKEN = /\b(?:gh[pousr]_[A-Za-z0-9]{20,}|github_pat_[A-Za-z0-9_]{20,})\b/g

function looksRandom(s: string): boolean {
  return /[0-9]/.test(s) && /[a-z]/.test(s) && /[A-Z]/.test(s)
}

/**
 * Removes what looks like a credential from free text: `key=value` pairs whose name says
 * token/secret/password/key, `Bearer` tokens, GitHub tokens, six-digit codes next to
 * "code"/"OTP", and long hex or mixed-case base64 runs. Slugs, ids, order numbers and prose survive.
 */
export function scrubSecrets(text: string): string {
  return text
    .replace(BEARER, `Bearer ${REDACTED}`)
    .replace(GITHUB_TOKEN, REDACTED)
    .replace(SECRET_PAIR, (_all, name: string) => `${name}${REDACTED}`)
    .replace(CODE_AFTER_WORD, (_all, word: string, gap: string) => `${word}${gap}${REDACTED}`)
    .replace(CODE_BEFORE_WORD, REDACTED)
    .replace(LONG_HEX, REDACTED)
    .replace(LONG_BASE64, (run) => (looksRandom(run) ? REDACTED : run))
}
