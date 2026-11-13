import {
  type ChannelTemplateSpec,
  renderWhatsapp,
  sampleTemplateDataByTemplate,
  type TemplateData,
  type TemplateId,
} from '@commerce/notifications'
import { templateParams } from './whatsapp'

/**
 * Messages that carry a one-time code. Meta sends these as AUTHENTICATION templates, whose wording
 * Meta writes itself ("{{1}} is your verification code"), so they are submitted by hand.
 */
const AUTHENTICATION: ReadonlySet<TemplateId> = new Set<TemplateId>([
  'login_code',
  'account_deletion_code',
  'email_change_code',
])

type Plain = Record<string, unknown>

const isPlain = (v: unknown): v is Plain =>
  typeof v === 'object' && v !== null && !Array.isArray(v) && !(v instanceof Date)

const sameList = (a: readonly string[], b: readonly string[]) =>
  a.length === b.length && a.every((x, i) => x === b[i])

/** Private-use markers, so a short value ("6") never matches inside a placeholder already placed. */
const marker = (i: number) => `${String.fromCharCode(0xe100 + i)}`

/**
 * The sample data with every field the template's parameters do not read taken out (a sample
 * waybill, a due date, a courier name), so those words never end up fixed in the template body.
 * A field the copy cannot do without ("undefined" would print) stays.
 */
function paramFieldsOnly(id: TemplateId, data: TemplateData): TemplateData {
  const want = templateParams(id, data)
  const words = (text: string) => new Set(text.toLowerCase().match(/[a-z]+/g) ?? [])
  const known = words(renderWhatsapp(id, data).text)
  let kept = structuredClone(data) as Plain
  const tryDrop = (path: readonly string[]) => {
    const next = structuredClone(kept)
    let parent: Plain = next
    for (const key of path.slice(0, -1)) {
      const child = parent[key]
      if (!isPlain(child)) return
      parent = child
    }
    delete parent[path[path.length - 1] as string]
    let text: string
    try {
      text = renderWhatsapp(id, next as TemplateData).text
    } catch {
      return
    }
    if (/undefined|NaN|\[object/.test(text)) return
    // Taking a field out may only shorten the copy, never switch it to other words.
    if ([...words(text)].some((w) => !known.has(w))) return
    if (!sameList(templateParams(id, next as TemplateData), want)) return
    kept = next
  }
  for (const key of Object.keys(kept)) {
    if (key === 'storeName') continue
    const value = kept[key]
    if (isPlain(value)) for (const sub of Object.keys(value)) tryDrop([key, sub])
    tryDrop([key])
  }
  return kept as TemplateData
}

/**
 * The body to submit for one message: its WhatsApp copy (the same words `renderWhatsapp` sends
 * as plain text) with each parameter `templateParams` fills swapped for its `{{n}}`. A parameter
 * the copy leaves out still gets a place (the greeting for the shopper's name, else a "Details"
 * line), and the body never starts or ends on a placeholder, which Meta refuses.
 */
export function whatsappTemplateSpec(id: TemplateId, storeName: string): ChannelTemplateSpec {
  const sample = sampleTemplateDataByTemplate[id]
  const data = paramFieldsOnly(id, { ...sample, storeName: storeName || sample.storeName })
  const examples = templateParams(id, data).map((v) => v.replace(/\s+/g, ' ').trim() || '-')
  let body = renderWhatsapp(id, data).text
  const missing: number[] = []
  const byLength = examples
    .map((value, i) => ({ value, i }))
    .sort((a, b) => b.value.length - a.value.length)
  for (const { value, i } of byLength) {
    if (value !== '-' && body.includes(value)) body = body.replace(value, marker(i))
    else missing.push(i)
  }
  missing.sort((a, b) => a - b)
  const greet = missing.find((i) => examples[i] === data.customerName && data.customerName)
  const rest = missing.filter((i) => i !== greet)
  if (greet !== undefined) {
    // "Your basket…" reads "Hi {{1}}, your basket…"; a store name keeps its capital.
    const lower = !data.storeName || !body.startsWith(data.storeName)
    const lead = lower ? body.replace(/^[A-Z](?=[a-z])/, (c) => c.toLowerCase()) : body
    body = `Hi ${marker(greet)}, ${lead}`
  }
  if (rest.length) body = `${body.replace(/\s+$/, '')} Details: ${rest.map(marker).join(', ')}.`
  body = examples.reduce((text, _v, i) => text.replace(marker(i), `{{${i + 1}}}`), body).trim()
  if (body.startsWith('{{')) body = `Update: ${body}`
  if (body.endsWith('}}')) body = `${body}.`
  return {
    id,
    name: id,
    category: AUTHENTICATION.has(id) ? 'AUTHENTICATION' : 'UTILITY',
    body,
    examples,
  }
}

/** One spec per message, in the order given. */
export function whatsappTemplateSpecs(
  ids: readonly TemplateId[],
  storeName: string,
): ChannelTemplateSpec[] {
  return ids.map((id) => whatsappTemplateSpec(id, storeName))
}
