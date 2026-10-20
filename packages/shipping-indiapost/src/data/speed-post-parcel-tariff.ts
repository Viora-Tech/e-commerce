/**
 * India Post's published Speed Post Parcel (Domestic) tariff, both rate cards, copied by hand
 * from the official page. Facts from a government tariff, no text or dataset copied, so there is
 * no licence to carry; credit: Department of Posts, Government of India.
 *
 *   Source:    https://www.indiapost.gov.in/mailproducts/domesticservices/speedpostparceldomestic
 *              ("Tariff structure of Speed Post Parcel (Domestic)"), read 2026-10-20.
 *   Effective: 01.08.2026, vide S.O. 4241 (E), Gazette of India dated 31.07.2026.
 *   Notes on the page: GST is levied as applicable (on top of these figures); Proof of Delivery
 *   is ₹10 per article extra; parcels up to 35 kg, length up to 1.5 m, length plus girth up to 3 m.
 *
 * Registration (addressee-specific delivery) is a ₹5 value-added service on Speed Post since the
 * October 2025 rationalisation (Department of Posts FAQ "Revision of Speed Post Tariff for
 * Document and Rationalization of Speed Post & Registered Post products", v3.1, Sept 2025).
 *
 * When India Post revises the tariff, replace the figures here and the dates above (and the
 * effective date in the admin's "Your own rates" help); nothing else reads the numbers directly.
 */

/** India Post's four tariff columns, in the order the page prints them. */
export type TariffZone = 'local' | 'withinState' | 'metro' | 'otherStates'

export type TariffSlab = {
  /** Upper bound of the slab, inclusive, in grams. */
  upToGrams: number
  /** Rupees, GST extra. */
  rupees: Record<TariffZone, number>
}

export type TariffCard = {
  slabs: TariffSlab[]
  /** Each further kilogram, or part of one, above the last slab. */
  additionalKgRupees: Record<TariffZone, number>
}

/** Heaviest Speed Post parcel India Post accepts. */
export const MAX_PARCEL_GRAMS = 35_000
/** GST on Speed Post: 18 % (courier services, SAC 9968). */
export const GST_RATE = 0.18
/** Registration as a value-added service, per article, GST extra. */
export const REGISTRATION_RUPEES = 5

const row = (
  upToGrams: number,
  local: number,
  withinState: number,
  metro: number,
  otherStates: number,
): TariffSlab => ({ upToGrams, rupees: { local, withinState, metro, otherStates } })

/** Walk-in customers at the counter. */
export const RETAIL_TARIFF: TariffCard = {
  slabs: [
    row(500, 28, 76, 82, 90),
    row(1000, 48, 101, 137, 143),
    row(1500, 60, 130, 182, 228),
    row(2000, 87, 178, 254, 319),
    row(3000, 116, 243, 355, 450),
    row(4000, 145, 298, 441, 560),
    row(5000, 174, 361, 539, 686),
  ],
  additionalKgRupees: { local: 35, withinState: 60, metro: 95, otherStates: 120 },
}

/** Contractual (bulk / business) customers with a Speed Post customer ID. */
export const CONTRACTUAL_TARIFF: TariffCard = {
  slabs: [
    row(500, 28, 36, 40, 47),
    row(1000, 31, 49, 65, 71),
    row(1500, 36, 64, 110, 150),
    row(2000, 45, 89, 140, 190),
    row(3000, 57, 111, 190, 250),
    row(4000, 69, 133, 235, 305),
    row(5000, 81, 156, 275, 350),
  ],
  additionalKgRupees: { local: 15, withinState: 25, metro: 60, otherStates: 65 },
}
