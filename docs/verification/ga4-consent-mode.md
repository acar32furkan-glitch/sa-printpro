# Verification: GA4 & Google Consent Mode

**Question (§0, item 5):** Confirm whether Consent Mode v2 is currently
required/recommended for GA4 in the EU/Turkey context.

## Finding
**Yes — Consent Mode v2 is required for GA4 where EEA users are served, and it is
strongly recommended for Turkey (KVKK) as best practice.** The master prompt's
approach — gating GA4 loading behind an explicit consent gate in
`src/lib/consent.js`, never shipping the GA4 tag in the initial static HTML — is
compliant and does not need to change.

Key dates & requirements (2026):
- **March 2024:** Google began enforcing Consent Mode v2 for EEA advertisers; without
  it, ad personalisation and remarketing audiences stop being populated for EEA users.
  (Basic mode = no Google data until consent; Advanced mode = cookieless pings.)
- **15 June 2026:** Google removed the legacy Google Analytics control that limited
  data shared with Google Ads; Consent Mode is now the **only** gating signal for ad
  data use. (Privado AI report, 2026-06-15.)
- Consent Mode sends four signals: `ad_storage`, `analytics_storage`,
  `ad_user_data`, `ad_personalization`. For the EU/EEA these are mandatory; for ad
  personalisation they gate `ad_user_data`/`ad_personalization`.

### Turkey context
Turkey is **not** in the EEA, so the EEA Consent Mode enforcement doesn't directly
apply. However:
- Turkey's KVKK (Law No. 6698) + the ePrivacy-equivalent regime require prior consent
  for non-essential data processing.
- Google's EU User Consent Policy covers any publisher serving users in Google's
  regulated regions; serving Turkish users still means a consent banner meeting
  GDPR-like standards is expected.
- Consent Mode v2 still reduces data loss for users who decline, so it is best
  practice even outside the EEA.

Conclusion: the master prompt §9 (vanilla `src/lib/consent.js`, GA4 injected only
after `setConsent(true)`, key `sa-cookie-consent`) is **correct as-is**. No
third-party consent library is needed.

## Correction applied
None. The master prompt §9 implementation remains valid and compliant.

## Sources
- Google Consent Mode v2 setup guide (Mar 2024 EEA enforcement; Basic vs Advanced):
  https://www.cookiehub.com/blog/google-consent-mode-v2-setup-gtm-guide (2026-04-28)
- Google's EU user consent policy (consent mode required):
  https://support.cookieinformation.com/articles/google-consent-mode-v2/google-s-eu-user-consent-policy (2026-06-18)
- The State of Google Consent Mode — June 15, 2026 change:
  https://www.privado.ai/the-state-of-google-consent-mode-june-15 (2026-06-15)
- Consent Mode setup (Basic/Advanced, four signals):
  https://www.consentpro.com/v2/basic-vs-advanced-consent-mode (2026-09-10)
- GA4 legal in the EU in 2026 / Turkey KVKK context:
  https://trustyourwebsite.com/eu/en/guides/google-analytics-gdpr (2026-08-12)
- Google Consent Mode v2 developer reference:
  https://developers.google.com/tag-platform/security/guides/consent

Date searched: **2026-09-11**
