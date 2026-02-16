# File: `vitest.hyper.config.ts`

## Purpose
Defines a dedicated Vitest configuration for hyper-thorough integration tests.

## Behavior
- test environment: `node`
- includes only: `tests/hyper/**/*.test.ts`
- extended timeout for live provider calls
- keeps `@` path alias aligned with main config

## Workflow
Used by script:
- `npm run test:hyper`
