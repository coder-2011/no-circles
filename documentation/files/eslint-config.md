# File: `eslint.config.mjs`

## Purpose
Defines repository-wide ESLint flat-config behavior.

## Key Behavior
- Extends `next/core-web-vitals` and `next/typescript`.
- Ignores generated/runtime paths (`node_modules`, `.next`, `out`, `coverage`).
- Ignores `next-env.d.ts` to avoid lint noise from Next-generated triple-slash references.
