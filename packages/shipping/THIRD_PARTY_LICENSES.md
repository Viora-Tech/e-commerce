# Third-party licences: @commerce/shipping

See the root [`THIRD_PARTY_NOTICES.md`](../../THIRD_PARTY_NOTICES.md) for the index.

## All India Pincode Directory (GODL-India)

- Dataset: "All India Pincode Directory", published on data.gov.in
  (https://www.data.gov.in/catalog/all-india-pincode-directory).
- Publisher: Department of Posts, Ministry of Communications, Government of India.
- File used: `Pincode_30052019.csv` (release of 30 May 2019),
  https://www.data.gov.in/sites/default/files/dataurl31052019/Pincode_30052019.csv, downloaded
  2026-10-26 (SHA-256 `e2fc773ebc697bb5aa96b76b6a38a2289d450e896769550259df89a2afe54c90`).
- Licence: Government Open Data Licence - India (GODL-India), https://www.data.gov.in/Godl.
  data.gov.in states that its content is licensed under GODL-India (read 2026-10-26). GODL-India
  permits use, adaptation and redistribution, including commercial, provided the source is
  attributed.

What we adapted: `scripts/build-pincode-directory.ts` reduces the post-office rows to one
district and state per PIN code and writes `data/pincode-directory.json.gz`. Changes from the
source: each office takes the state most offices in its district give (the state column has
stray errors), Leh and Kargil are filed under Ladakh, Puducherry's enclaves and Chandigarh under
their own union territories, Dadra and Nagar Haveli and Daman and Diu under the merged union
territory, rows whose state the PIN prefix rules out are dropped, and a few renamed districts use
their current names (Gurgaon → Gurugram, Allahabad → Prayagraj and so on).

Attribution, kept in the file's `source` field:

> All India Pincode Directory, Department of Posts, Ministry of Communications, Government of
> India, via data.gov.in, under the Government Open Data Licence - India
