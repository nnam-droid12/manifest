---
name: fraud-investigation-checklist
description: The full double-brokering and identity-fraud red-flag checklist to run through after gathering FMCSA and broker-record data on a carrier. Load this when actually assessing a carrier's risk, not before.
---

# Fraud investigation checklist

You have already called `lookup_carrier_by_mc` (or `lookup_carrier_by_dot`),
`get_broker_carrier_record`, and `search_playbook`. Work through every item
below using that data — do not skip an item because the answer "seems
obvious," and do not stop at the first red flag you find; a full picture
changes the recommended action even when any single flag alone might not.

1. **Remit-to mismatch.** Does the remit-to name or email domain on the
   broker record match the carrier's legal name (or an obvious derivative —
   e.g. an unambiguous abbreviation, not just "sounds similar")? A mismatch
   is the single strongest double-brokering signal: payment being redirected
   to a third party who may not be the carrier that actually hauls the load.

2. **Authority age.** If FMCSA data is available, how long ago was operating
   authority granted or reactivated? Very recently issued or reactivated
   authority is a common pattern for a fraudulent operator standing up a new
   shell entity.

3. **First-time contact.** Does a broker-side record exist at all? No prior
   relationship *by itself* is not a red flag — legitimate carriers start
   somewhere — but combined with any other item on this list, it removes
   the "we already trust them" mitigation a track record would provide.

4. **Authority / insurance status.** Is authority active? Is insurance
   confirmed on file, or is that information missing/stale? Do not treat
   "FMCSA lookup failed" as equivalent to "status unknown, proceed
   anyway" — an unverifiable carrier is not a verified-clean one.

5. **Contact domain quality.** Is the contact email on a domain that matches
   the carrier's name, or a generic public webmail provider (gmail, yahoo,
   outlook.com) for what claims to be an established commercial carrier?

6. **Playbook precedent.** Did `search_playbook` return anything for this
   carrier by name? Treat a relevant note as authoritative broker
   instruction, not just one more data point to weigh — a standing "never
   book" rule overrides an otherwise-clean assessment.

## Scoring it

- **HIGH**: item 1 (remit-to mismatch) present, OR items 2+3+4 stacking
  (new/unverifiable authority + first contact + no insurance confirmation),
  OR any explicit playbook prohibition.
- **MEDIUM**: a single moderate flag (e.g. first-time contact alone with an
  unverifiable FMCSA record, but clean remit-to and a plausible domain) —
  not blocking, but worth a human glance.
- **LOW**: clean remit-to match, active verified authority, established
  contact domain, no playbook flags.

Always end with the same two lines, exactly, so downstream systems can
parse them: `RISK_LEVEL: <LOW|MEDIUM|HIGH>` and `AUTONOMOUS_OK: <true|false>`
(false whenever risk is HIGH, regardless of any other factor).
