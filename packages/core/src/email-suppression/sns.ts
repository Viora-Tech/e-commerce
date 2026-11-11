/** SOURCE OF TRUTH: verifySnsMessage, parseSnsEnvelope, snsSubscribeUrlAllowed — WHAT: checks that an HTTP body really is an Amazon SNS message from our topic (RSA signature against AWS's signing certificate, fetched only from an `sns.<region>.amazonaws.com` https URL) / WHY: anyone can POST to the worker; only a signed message from the configured topic may change a store's suppression list */
import { createVerify, X509Certificate } from 'node:crypto'

/**
 * The SNS JSON envelope (HTTP/S subscription, raw message delivery OFF). Field names and the
 * signing recipe follow AWS's "Verifying the signatures of Amazon SNS messages".
 */
export type SnsEnvelope = {
  Type: 'Notification' | 'SubscriptionConfirmation' | 'UnsubscribeConfirmation'
  MessageId: string
  TopicArn: string
  Message: string
  Timestamp: string
  SignatureVersion: '1' | '2'
  Signature: string
  SigningCertURL: string
  Subject?: string | undefined
  SubscribeURL?: string | undefined
  Token?: string | undefined
}

const TYPES = new Set(['Notification', 'SubscriptionConfirmation', 'UnsubscribeConfirmation'])

/** Biggest body the worker reads; SES notifications are a few kilobytes. */
const SNS_MAX_BODY_BYTES = 256 * 1024

const str = (v: unknown): v is string => typeof v === 'string' && v.length > 0

/** The envelope, or null when the body is not one (not JSON, a field missing, unknown type). */
export function parseSnsEnvelope(raw: string): SnsEnvelope | null {
  if (raw.length > SNS_MAX_BODY_BYTES) return null
  let body: Record<string, unknown>
  try {
    const parsed: unknown = JSON.parse(raw)
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return null
    body = parsed as Record<string, unknown>
  } catch {
    return null
  }
  if (!str(body.Type) || !TYPES.has(body.Type)) return null
  for (const key of [
    'MessageId',
    'TopicArn',
    'Message',
    'Timestamp',
    'Signature',
    'SigningCertURL',
  ]) {
    if (!str(body[key])) return null
  }
  if (body.SignatureVersion !== '1' && body.SignatureVersion !== '2') return null
  if (body.Type !== 'Notification' && (!str(body.SubscribeURL) || !str(body.Token))) return null
  return {
    Type: body.Type as SnsEnvelope['Type'],
    MessageId: body.MessageId as string,
    TopicArn: body.TopicArn as string,
    Message: body.Message as string,
    Timestamp: body.Timestamp as string,
    SignatureVersion: body.SignatureVersion,
    Signature: body.Signature as string,
    SigningCertURL: body.SigningCertURL as string,
    Subject: str(body.Subject) ? body.Subject : undefined,
    SubscribeURL: str(body.SubscribeURL) ? body.SubscribeURL : undefined,
    Token: str(body.Token) ? body.Token : undefined,
  }
}

/** `sns.<region>.amazonaws.com`, the only hosts SNS signs from or sends confirmation links on. */
const SNS_HOST = /^sns\.[a-z]{2}(-[a-z]+)+-\d\.amazonaws\.com$/

/** An https URL on an SNS host, with no port, credentials or other tricks. */
function onSnsHost(value: string): URL | null {
  let url: URL
  try {
    url = new URL(value)
  } catch {
    return null
  }
  if (url.protocol !== 'https:' || url.username || url.password || url.port) return null
  return SNS_HOST.test(url.hostname) ? url : null
}

/** Whether a `SigningCertURL` may be fetched: https, an SNS host, a `.pem` path. */
function snsCertUrlAllowed(value: string): boolean {
  const url = onSnsHost(value)
  return Boolean(url?.pathname.endsWith('.pem'))
}

/** Whether a `SubscribeURL` may be visited: https on an SNS host, the ConfirmSubscription action. */
export function snsSubscribeUrlAllowed(value: string): boolean {
  const url = onSnsHost(value)
  return url?.searchParams.get('Action') === 'ConfirmSubscription'
}

/** The exact string AWS signs, per message type. */
function snsStringToSign(m: SnsEnvelope): string {
  const keys =
    m.Type === 'Notification'
      ? (['Message', 'MessageId', 'Subject', 'Timestamp', 'TopicArn', 'Type'] as const)
      : ([
          'Message',
          'MessageId',
          'SubscribeURL',
          'Timestamp',
          'Token',
          'TopicArn',
          'Type',
        ] as const)
  let out = ''
  for (const key of keys) {
    const value = m[key]
    // Subject is signed only when the message has one.
    if (value === undefined) continue
    out += `${key}\n${value}\n`
  }
  return out
}

export type CertFetcher = (url: string) => Promise<string>

const CERT_TIMEOUT_MS = 5_000
const CERT_MAX_BYTES = 16 * 1024

/** The default fetcher: a short timeout, no redirects, a size cap. */
export function fetchSnsCert(fetchImpl: typeof fetch = fetch): CertFetcher {
  return async (url) => {
    const res = await fetchImpl(url, {
      redirect: 'error',
      signal: AbortSignal.timeout(CERT_TIMEOUT_MS),
    })
    if (!res.ok) throw new Error(`signing certificate: HTTP ${res.status}`)
    const text = await res.text()
    if (text.length > CERT_MAX_BYTES) throw new Error('signing certificate too large')
    return text
  }
}

/** Certificates by URL; AWS rotates them rarely, so one fetch per process per URL is enough. */
const certCache = new Map<string, Promise<string>>()
const CERT_CACHE_LIMIT = 20

async function certFor(url: string, fetcher: CertFetcher): Promise<string> {
  let pending = certCache.get(url)
  if (!pending) {
    if (certCache.size >= CERT_CACHE_LIMIT) certCache.clear()
    pending = fetcher(url)
    certCache.set(url, pending)
    // A failed fetch is not cached: the next message tries again.
    pending.catch(() => certCache.delete(url))
  }
  return pending
}

export type SnsVerifyResult =
  | { ok: true }
  | { ok: false; reason: 'cert_url' | 'cert_fetch' | 'cert_invalid' | 'signature' }

/**
 * Check the message's signature with AWS's certificate. Never throws. The certificate is only
 * fetched from an allowed SNS URL and must be within its validity dates.
 */
export async function verifySnsMessage(
  m: SnsEnvelope,
  opts: { fetchCert: CertFetcher; now?: Date | undefined },
): Promise<SnsVerifyResult> {
  if (!snsCertUrlAllowed(m.SigningCertURL)) return { ok: false, reason: 'cert_url' }
  let pem: string
  try {
    pem = await certFor(m.SigningCertURL, opts.fetchCert)
  } catch {
    return { ok: false, reason: 'cert_fetch' }
  }
  try {
    const cert = new X509Certificate(pem)
    const now = (opts.now ?? new Date()).getTime()
    if (now < Date.parse(cert.validFrom) || now > Date.parse(cert.validTo)) {
      return { ok: false, reason: 'cert_invalid' }
    }
    // Where the certificate came from (an https SNS host, checked above) is what vouches for it,
    // as in AWS's own validators; the subject is not compared, so a renamed CN cannot break this.
    const verifier = createVerify(m.SignatureVersion === '2' ? 'RSA-SHA256' : 'RSA-SHA1')
    verifier.update(snsStringToSign(m), 'utf8')
    return verifier.verify(cert.publicKey, m.Signature, 'base64')
      ? { ok: true }
      : { ok: false, reason: 'signature' }
  } catch {
    return { ok: false, reason: 'cert_invalid' }
  }
}
