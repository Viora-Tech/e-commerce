/** Copy for the step-up re-authentication dialog (A5): re-verify before a sensitive action. */
export const stepUpContent = {
  title: "Confirm it's you",
  body: 'This action needs a quick security check. Confirm it with your passkey or a code by email.',
  loading: 'Checking…',
  passkey: {
    button: 'Confirm with a passkey',
    hint: 'Use the passkey saved on this device.',
    useCode: 'Use a code by email instead',
    failed: "That passkey didn't verify. Try again, or use a code by email.",
  },
  otp: {
    body: 'We sent a 6-digit code to your email.',
    label: 'Verification code',
    submit: 'Confirm',
    verifying: 'Checking code',
    resendIn: (time: string) => `Resend in ${time}`,
    resend: 'Send a new code',
    wrong: 'That code is wrong or expired.',
    sendFailed: 'Could not send the code. Try again in a minute.',
    devHint: 'In development the code is printed in the admin server log.',
  },
  sending: 'Sending code',
  cancel: 'Cancel',
  failed: 'Could not confirm. Try again.',
} as const
