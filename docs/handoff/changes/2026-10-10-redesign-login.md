# Admin redesign: Login and sign up

Branch `feat/proofly-login`. Figma Option A (`434:132719` light, `434:133757` dark, `434:136235` mobile).

- `app/(auth)/login/page.tsx` now renders `components/auth/login-screen.tsx`: two columns, logo and
  language toggle on the left, form centred, brand panel on the right (phone: a short gradient band).
- Auth logic is unchanged (`emailOtp.sendVerificationOtp` / `signIn.emailOtp`, redirect, errors).
  Added a 30 s "Resend in 0:30" timer that re-calls the same send endpoint.
- Code entry: `otp-input.tsx`, six slots (3 + dash + 3) over one real input (no `input-otp` package).
- Brand panel: `login-panel.tsx`, four static illustrated slides, CSS-only fade and rise (400 ms),
  5 s auto-advance, pause on hover/focus, `prefers-reduced-motion` stays on slide 1.
- Copy in `data/login.ts` + `data/hi/login.ts` (login keys removed from `data/auth.ts`).
- "Create your store" switches the heading to sign-up copy; the backend flow is the same email code
  (onboarding happens after sign-in).

## Not done
- Phone number field and Continue with Google: the auth backend only supports email OTP, so the
  form uses email and no social button. Add them when the backend gains phone/Google.
- Help on WhatsApp is intentionally absent (owner rule).
- Onboarding page left as is (not trivial to restyle with the panel).
- The EN / हिं toggle reuses the shared `LanguageField` (labels "English" / "हिंदी (Hindi)").
- Mobile and the OTP/error states were not viewed in a browser (window could not be resized; sending a
  code needs email). Light and dark desktop were checked.
