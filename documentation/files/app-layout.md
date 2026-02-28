# File: `app/layout.tsx`

## Purpose
Defines the root Next.js layout wrapper and page metadata.

## Behavior
1. Imports shared global styles plus the dedicated landing-page stylesheet once at the root layout.
2. Sets top-level metadata (`title`, `description`, canonical origin, Open Graph, Twitter summary card) with `https://no-circles.com` as the public site base.
3. Sets browser/app icons to the shared brand asset (`/logo-no-circles.png`).
4. Wraps all routes in root HTML/body shell.
5. Renders a fixed top-left home link with the app logo (`/logo-no-circles.png`) using no surrounding border/background chrome, with priority load and unoptimized delivery to preserve source fidelity.
6. Uses hydration-warning suppression for client-auth surfaces.

## Why It Exists
- Centralizes document-level structure shared by every route.
- Ensures consistent metadata and style bootstrap across the app.
