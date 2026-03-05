# File: `scripts/generate-outreach-drafts.mjs`

## Purpose
Runs a one-shot outreach drafting pipeline:
1. read lead rows from CSV
2. research each person with Perplexity
3. draft constrained personalized email content with Sonnet 4.5
4. send via SMTP (or dry-run only)

## Input Contract
- CLI:
  - `--input <path-to-csv>` (mode 1)
  - `--txt <path-to-txt>` (mode 2)
  - `--name "Full Name"` (mode 3, one-off)
  - `--email "person@example.com"` (optional with `--name`)
  - `--profile-url "https://..."` (optional with `--name`)
  - `--limit <n>` (optional)
  - `--dry-run` (optional, skips SMTP send)
- CSV required:
  - `first_name` (or `name`/`full_name`)
- TXT accepted lines:
  - `Name`
  - `Name|email|profile_url|role|company|creative_domain|notes`
- Optional CSV columns:
  - `full_name` / `name`
  - `role`
  - `company`
  - `creative_domain`
  - `notes`

## Environment Contract
- Required:
  - `PERPLEXITY_API_KEY`
  - `OUTREACH_SMTP_USER`
  - `OUTREACH_SMTP_APP_PASSWORD`
  - `OUTREACH_SMTP_FROM`
- Optional SMTP:
  - `OUTREACH_SMTP_HOST` (default `smtp.gmail.com`)
  - `OUTREACH_SMTP_PORT` (default `465`)
- Model provider requirement:
  - `OPENROUTER_API_KEY` or `ANTHROPIC_API_KEY`
- Optional:
  - `PERPLEXITY_PEOPLE_RESEARCH_MODEL`
  - `OUTREACH_SONNET_MODEL_OPENROUTER`
  - `OUTREACH_SONNET_MODEL_ANTHROPIC`
  - `OUTREACH_SIGNATURE_NAME`

## Personalization Guardrails
- Allows semi-freeform body generation per lead (moderate rewrite latitude).
- Instructs Sonnet to avoid AI-sounding prose patterns and prefer natural, specific human phrasing.
- Requires Sonnet to keep core positioning intact (No-Circles, algorithmic-bubble break, un-Googlable tangent info, evolving interests, web-purpose intent, respectful close).
- Pushes more creative, specific subject lines (up to 12 words) while avoiding clickbait.
- Enforces post-generation guardrails in code to append missing core points and normalize signature.
- Uses Perplexity-derived evidence first, with citations captured in run report.
- When lead email/profile URL is missing, script performs an identity-resolution Perplexity pass before research/drafting.
- If email still cannot be resolved, script still generates output and reports `needs_email` instead of failing the whole run.

## Output
- Writes run artifact to `reports/outreach-smtp-run-<timestamp>.json` with:
  - original input lead
  - resolved lead identity fields
  - identity citations
  - per-lead research JSON
  - citations
  - personalization JSON
  - final subject/body
  - per-lead txt draft file path
  - SMTP send metadata (if not dry run)
  - errors
- Always writes per-person numbered `.txt` email drafts to:
  - `reports/outreach-email-files-<timestamp>/`
  - file format: `001-name.txt`, `002-name.txt`, ...
  - each file includes `To`, `Name`, `Subject`, and full body.

## Failure Modes
- Missing env -> `MISSING_ENV:*`
- Provider HTTP failures -> `PERPLEXITY_HTTP_*`, `SONNET_HTTP_*`
- SMTP issues -> `SMTP_UNEXPECTED_RESPONSE:*`
- Malformed model output -> `JSON_PARSE_FAILED`, `*_EMPTY_RESPONSE`
