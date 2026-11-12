import { CourierError } from '@commerce/shipping'

/**
 * Cancel a booked Shiprocket shipment by AWB: `POST /orders/cancel/shipment/awbs` with
 * `{ awbs: [...] }` (Shiprocket's API collection, "Cancel a Shipment"). The Shiprocket order itself
 * stays (it can be booked again there); `/orders/cancel` (`cancelPushedOrder`) is the one that
 * cancels a pending order.
 *
 * UNCONFIRMED LIVE: the success body is not documented beyond a message, so only a refusal the API
 * states (a 4xx, or a 2xx body with `status_code` >= 400 or `errors`) counts as failure. Needs one
 * live test on a test booking before it is relied on.
 */

const CANCEL_AWB_PATH = '/orders/cancel/shipment/awbs'

/** The answer. Only `message` is documented; the rest is read when present. */
type CancelAwbResponse = {
  message?: string
  status_code?: number
  errors?: unknown
}

const hasErrors = (errors: unknown) =>
  errors !== undefined &&
  errors !== null &&
  !(Array.isArray(errors) && errors.length === 0) &&
  !(typeof errors === 'object' && Object.keys(errors).length === 0)

/**
 * Why a 2xx cancel answer is still a refusal, or null when it is not one. Shiprocket answers some
 * refusals with a 200 carrying `status_code` and `errors`, the way its create calls do.
 */
function cancelRefusal(body: CancelAwbResponse | null | undefined): string | null {
  if (!body || typeof body !== 'object') return null
  const failed =
    (typeof body.status_code === 'number' && body.status_code >= 400) || hasErrors(body.errors)
  if (!failed) return null
  if (body.message) return body.message
  if (typeof body.errors === 'string') return body.errors
  return 'no detail returned'
}

/**
 * Send the cancel through the adapter's authenticated `post` and turn a refusal into
 * `CourierError('rejected')` with Shiprocket's words. Auth, rate limit, 5xx, timeout and a
 * non-JSON body keep their own kinds.
 */
export async function cancelByAwb(
  provider: string,
  awb: string,
  post: (path: string, body: unknown) => Promise<CancelAwbResponse>,
): Promise<void> {
  if (!awb) throw new CourierError('rejected', provider, 'No AWB to cancel.')
  const refusedWith = (reason: string, status?: number, cause?: unknown) =>
    new CourierError('rejected', provider, `Shiprocket did not cancel AWB ${awb}: ${reason}`, {
      status,
      reason,
      cause,
    })
  let result: CancelAwbResponse
  try {
    result = await post(CANCEL_AWB_PATH, { awbs: [awb] })
  } catch (error) {
    // A 4xx other than auth and rate limits is Shiprocket refusing this cancel (e.g. already
    // picked up).
    if (
      error instanceof CourierError &&
      error.kind === 'unavailable' &&
      error.status !== undefined &&
      error.status >= 400 &&
      error.status < 500
    ) {
      throw refusedWith(error.reason || `HTTP ${error.status}`, error.status, error)
    }
    throw error
  }
  const refused = cancelRefusal(result)
  if (refused) throw refusedWith(refused)
}
