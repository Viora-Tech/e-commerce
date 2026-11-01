/** SOURCE OF TRUTH: payment capture mode — WHAT: Settings → Payments → Payment capture (#150): per gateway, take the money at checkout (automatic) or only authorise it and capture from the order page (manual); which gateways can do manual capture / WHY: merchants who check stock or call the shopper before shipping want to release, not refund, an order they cannot fill */
import { z } from 'zod'

export const CAPTURE_MODES = ['automatic', 'manual'] as const
export const CaptureModeSchema = z.enum(CAPTURE_MODES)
export type CaptureMode = z.infer<typeof CaptureModeSchema>

/**
 * Gateways whose adapter can authorise now and capture later. Razorpay: an order created with
 * `payment_capture: false`, captured with `POST /payments/:id/capture` (Razorpay releases an
 * authorisation not captured within its window, 5 days by default). Cashfree's
 * pre-authorisation needs the merchant's account enabled for it and covers cards only, so it is
 * not offered.
 */
export const MANUAL_CAPTURE_GATEWAYS: readonly string[] = ['razorpay']

export const supportsManualCapture = (gatewayId: string): boolean =>
  MANUAL_CAPTURE_GATEWAYS.includes(gatewayId)

/** The mode a gateway runs in: manual only where the store chose it and the gateway can. */
export function captureModeFor(
  settings: { capture?: Record<string, CaptureMode> | undefined },
  gatewayId: string,
): CaptureMode {
  return settings.capture?.[gatewayId] === 'manual' && supportsManualCapture(gatewayId)
    ? 'manual'
    : 'automatic'
}
