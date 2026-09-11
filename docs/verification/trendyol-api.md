# Verification: Trendyol Seller API (V2)

**Question (§0, item 1):** Confirm the current base URL, exact path and required
query/header parameters for the `products/approved` and `inventory-and-price`
endpoints, current rate limits, and whether anything has changed since this prompt
was written. Verify against `developers.trendyol.com` or the official seller API
reference.

## Finding

| Field | Verified value |
|-------|----------------|
| Base URL | `https://apigw.trendyol.com` |
| Approved products list | `GET /integration/product/sellers/{sellerId}/products/approved` |
| Inventory & price | `GET /integration/product/sellers/{sellerId}/products/approved/inventory-and-price` |
| Auth | HTTP Basic Auth (`apiKey:apiSecret`) |
| Pagination | `page` + `size`; loop until a page returns 0 items |
| Page size | `size` at most 100 (confirmed by a 2026 integrator report) |

### Naming: `{sellerId}` vs `{supplierId}`
The master prompt (§3) writes the path param as `{supplierId}`; the official endpoint
listing documents it as `{sellerId}`. Trendyol's own "Integration Information" panel
exposes a single numeric triple — **Supplier ID + 40-char API Key + 40-char API
Secret** — so `{supplierId}` and `{sellerId}` are the **same value**. This is a naming
difference only, not a functional change.

## Not independently verified in this pass
- **Required `User-Agent: "{supplierId} - SelfIntegration"` header** (master prompt §3):
  the retrieved official endpoint listing does **not** state this header or the 403
  behaviour. Widely cited in integrator guides, but not confirmed against
  `developers.trendyol.com` in this search. Treat as **TODO** to confirm.
- **Rate limit `50 req / 10s / endpoint` + `250ms` sleep between pages**: not stated in
  any retrieved source. The retrieved docs only mention "update your rate-limit and
  time budgets". Treat as **TODO** to confirm against the seller-portal docs.

## Correction applied
None to the endpoint paths or base URL — the master prompt §3 values match the official
v2 endpoint listing. Only the two items above are flagged unverified.

## Sources
- Product V2- API Endpoint — developers.trendyol.com
  https://developers.trendyol.com/v2.0/docs/product-v2-api-endpoint
  (updated `2026-07-20`; lists `products/approved`,
  `products/approved/inventory-and-price`, auth via Basic Auth)
- Integration Documentation home (shutdown notices)
  https://developers.trendyol.com/v2.0
- Trendyol API Changes in 2026 (page-size ≤100, V2 differences)
  https://verimle.com/en/blog/trendyol-api-changes-2026
- Trendyol API Architecture 2026 (Supplier ID + Key + Secret triple)
  https://www.zunapro.com/turkey/en/blog/trendyol-integration-guide-api-xml-platform

Date searched: **2026-09-11**
