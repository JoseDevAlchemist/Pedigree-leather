# Pedigree Leather — build progress

Log of what has been built and verified. Newest session at the bottom.
The developer commits; no git commits are made here.

## Current Verified State

_(updated at the end of each session)_

- Next.js 16.3.8 (App Router, Turbopack), React 19.2, TypeScript strict, Tailwind CSS v4, pnpm.
- Design tokens live in `app/globals.css` only. Components must use token classes
  (`bg-primary`, `text-accent`, `bg-card`, `border-border`, `text-muted`); no raw hex in components.
- `<Navbar />` is mounted in `app/layout.tsx` and renders on every route.
- Favicon resolves from `app/icon.png` (generated from `Pedigree logo.jpeg`).

## Design decisions worth remembering

- `app/favicon.ico` (the create-next-app default) was deleted so it cannot compete with
  `app/icon.png` in the browser tab.
- `public/pedigree-logo.png` is a circular badge with transparent corners, derived from the
  source JPEG. Regenerate with the commands in the session log if the logo file changes.
- Light-only palette on purpose: the previous `prefers-color-scheme: dark` block was removed
  because a cream page with a brown bar is the brand, not a dark theme.
- `GEMINI.md` estimates the brand brown as `#7F4F28`; this session's brief pins
  `--pedigree-brown: #5D4037`. The brief wins, and the value lives in one place
  (`app/globals.css`) so it is a one-line change either way.

## Roadmap

1. Tokens, fonts, layout, Navbar — **done (session 1)**
2. Data model (`lib/types.ts`), sample data, `lib/api.ts` data-access seam
3. Angle viewer + colour switching
4. Shop grid: product cards, discount badge, stock status
5. Cart · 6. Checkout · 7. Supabase · 8. Admin · 9. Paystack · 10. Polish

---

## Session log

### Session 1 — 2026-10-04 — Design tokens + Navbar

**Status:** started.
