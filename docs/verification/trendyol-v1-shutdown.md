# Verification: Trendyol Product V1 Shutdown

**Question (§0, item 6):** Confirm the exact shutdown date and status of Trendyol
Product V1 services stated in §3.

## Finding
Trendyol's **Product V1 services are scheduled to be deactivated on
15 September 2026.** This is stated verbatim on Trendyol's official developer
documentation (both the home/changelog banner and the V1 API endpoint reference).

- V2 services are already live; sellers must migrate to V2 by the cutoff.
- After 15 September 2026, V1 requests stop working.
- The master prompt §3 claim ("shut down as of September 15, 2026") is **CONFIRMED**
  against the current official documentation.

### Discrepancy noted (earlier date)
An **older** version of the official V1 endpoint reference (updated `2026-04-09`)
stated the cutoff was **10 August 2026**. The same page was later updated, and the
current homepage banner (updated `2026-07-20`) states **15 September 2026**.
Third-party write-ups (e.g. verimle.com, dated 2026-07-14/21) also cite
**10 August 2026** — matching the older official wording.

Interpretation: the date was **moved forward from 10 Aug → 15 Sep 2026**. The most
recent official source (15 Sep 2026) governs. The site must use **V2 only**.

## Correction applied
No change to master prompt §3 (it already states 15 September 2026). Only the
stale third-party/older-docs date of "10 August 2026" is corrected to
**15 September 2026** per the current `developers.trendyol.com` banner.

## Sources
- developers.trendyol.com home (EN): "V1 services will be deactivated as of
  September 15, 2026."
  https://developers.trendyol.com/v2.0
  https://developers.trendyol.com/v3.0
- V1 endpoint reference (older page noting the date change):
  https://developers.trendyol.com/v2.0/docs/product-api-endpoint
  (updated 2026-04-09: earlier "10th August 2026" wording)
- Third-party (superseded date):
  https://verimle.com/en/blog/trendyol-api-changes-2026
  https://bdijital.com/en/blog/trendyol-product-api-v1-sunset

Date searched: **2026-09-11**
