# File: `scripts/extract-bpc-paywall-domains.mjs`

## Purpose
Extracts normalized paywall-domain buckets from a local `bypass-paywalls-chrome-clean` checkout into the vendored corpus JSON used by discovery.

## Behavior
1. Loads `sites.js` in a sandbox with minimal browser API stubs.
2. Reads `sites_updated.json` and `custom/sites_custom.json`.
3. Collects direct `domain` values and grouped domain entries.
4. Normalizes and dedupes domains.
5. Writes `lib/discovery/paywall-domain-corpus.generated.json` with source metadata and counts.

## Usage
```bash
node scripts/extract-bpc-paywall-domains.mjs /path/to/bypass-paywalls-chrome-clean
```

Optional second argument overrides the output path.
