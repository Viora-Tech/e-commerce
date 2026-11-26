import type { NotifyMeFormProps } from '@commerce/blocks'
import { BUTTON_RADIUS_REM } from '@commerce/plugin-back-in-stock/settings-schema'

/**
 * The Back in stock app's Notify me button as a still picture in the Customize canvas: the
 * campaign's words and look on a sold-out product, as the storefront draws it (the storefront's
 * pop-up needs its server action, which the editor does not have).
 */
export default function NotifyMePreview({ widget }: NotifyMeFormProps) {
  // Early returns
  if (!widget) return null

  // Render logic
  const custom = widget.buttonStyle === 'custom'

  return (
    <button
      type="button"
      tabIndex={-1}
      className={
        custom
          ? 'flex min-h-12 w-full items-center justify-center border px-5 text-sm font-semibold tracking-wide uppercase'
          : 'btn btn--primary w-full'
      }
      style={
        custom
          ? {
              backgroundColor: widget.buttonBackground,
              borderColor: widget.buttonBackground,
              color: widget.buttonTextColor,
              borderRadius: BUTTON_RADIUS_REM[widget.buttonRadius],
            }
          : undefined
      }
    >
      <span>{widget.display === 'popup' ? widget.buttonText : widget.submitText}</span>
    </button>
  )
}
