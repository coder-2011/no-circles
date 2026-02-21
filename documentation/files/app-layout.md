# File: `app/layout.tsx`

## Purpose
Defines the root Next.js layout wrapper and page metadata.

## Behavior
1. Imports global Tailwind/CSS styles once.
2. Sets top-level metadata (`title`, `description`).
3. Sets browser/app icons to the shared brand asset (`/logo.png`).
4. Wraps all routes in root HTML/body shell.
5. Renders a fixed top-left home link with the app logo as vector SVG (`/logo-no-circles.svg`) so zoom remains crisp.
6. Uses hydration-warning suppression for client-auth surfaces.

## Why It Exists
- Centralizes document-level structure shared by every route.
- Ensures consistent metadata and style bootstrap across the app.
