# Subsystem: Outreach Draft HITL

## Scope
Human-in-the-loop outbound email drafting for GTM:
- research creative leads
- draft high-personalization outreach using a constrained template
- generate personalized bodies and deliver through SMTP

## Entry Point
- `scripts/generate-outreach-drafts.mjs`

## Runtime Flow
1. Load leads from CSV, TXT, or one-off CLI name arguments.
2. Validate minimum identity (`first_name`/name).
3. If email/profile URL is missing, run a Perplexity identity-resolution pass.
4. Research each lead with Perplexity and extract structured evidence JSON.
5. Send lead + evidence to Sonnet 4.5 with strict output schema for minimal-template personalization.
6. Render semi-freeform personalized body, then enforce core-message guardrails for consistency.
7. Send message through SMTP (`smtp.gmail.com:465` default) using app-password auth when email is available.
8. Persist a structured run report in `reports/`.
9. Persist human-readable numbered per-person `.txt` drafts in a run subfolder for outbound workflow (`001-name.txt`, `002-name.txt`, ...).

## Why HITL
- Preserves quality and sender voice while still scaling prospecting throughput.
- Supports dry-run review mode before live sends.
- Keeps a full audit trail of evidence and generated content per lead.

## Boundaries
- It does not perform bulk lead discovery itself; it expects lead input CSV.
- It does not modify newsletter runtime paths.
