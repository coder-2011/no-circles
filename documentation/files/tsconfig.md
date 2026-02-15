# File: `tsconfig.json`

## Purpose
TypeScript compiler configuration for Next.js app and tests.

## Key Settings
- strict type checking enabled
- no emit (type-check only)
- Next.js plugin integration
- path alias `@/* -> ./*`
- includes generated `.next/types` route typings

## Why It Exists
- Defines project-wide type-safety baseline and module resolution behavior.
- Prevents per-file compiler drift by keeping one canonical TS contract.
