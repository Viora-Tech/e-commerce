type AffiliateSignupBlockProps = {
  heading: string
  text: string
  buttonLabel: string
  align: 'left' | 'center'
}

/** Where the Affiliates app's signup and dashboard live on every store. */
const AFFILIATE_PAGE = '/affiliate'

/**
 * The Affiliates app's theme block (Add panel → Apps): a short invitation to join the store's
 * affiliate program with a button to its signup page. Needs no data, so it renders the same in
 * the editor and on the storefront, on any template.
 */
export default function AffiliateSignupBlock({
  heading,
  text,
  buttonLabel,
  align,
}: AffiliateSignupBlockProps) {
  // Render logic
  const centered = align === 'center'

  return (
    <section className="page-width py-10">
      <div
        className={`flex max-w-[40rem] flex-col gap-4 ${centered ? 'mx-auto items-center text-center' : 'items-start'}`}
      >
        {heading ? <h2 className="h3">{heading}</h2> : null}
        {text ? <p className="text-body whitespace-pre-line">{text}</p> : null}
        <a className="btn btn--primary" href={AFFILIATE_PAGE}>
          <span className="btn__label">{buttonLabel}</span>
        </a>
      </div>
    </section>
  )
}
