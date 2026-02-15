# File: `vitest.config.ts`

## Purpose
Configures test runtime for this repo.

## Current Settings
- environment: `node`
- path alias: `@` -> repository root

## Why It Exists
Tests import app files via `@/...`; this config keeps Vitest resolution aligned with `tsconfig.json`.
