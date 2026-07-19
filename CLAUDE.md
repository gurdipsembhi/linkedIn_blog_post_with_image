# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

An agentic application that automatically writes and publishes LinkedIn posts tailored to a domain the user selects (e.g., AI, fintech, HR). The pipeline: user picks a domain → agent gathers fresh content for that domain (news/RSS/search) → LLM drafts a post → post is published to LinkedIn via the official API, on a schedule, optionally after human review.

**Status:** OAuth connect, publish-to-profile, and the news-grounded content pipeline all work (first real post published 2026-07-19). Not yet built: database (currently cookie sessions + local-file history), scheduling (Vercel Cron), review queue.

## Commands

- `npm run dev` — dev server (Turbopack) at http://localhost:3000
- `npm run build` — production build; also the fastest full type-check
- `npm run lint` — ESLint

Requires `.env.local` (copy from `.env.example`): `LINKEDIN_CLIENT_ID`, `LINKEDIN_CLIENT_SECRET`, `LINKEDIN_REDIRECT_URI`, and optionally `GOOGLE_GENERATIVE_AI_API_KEY` / `AI_MODEL` for draft generation. The redirect URI must also be registered in the LinkedIn app's Auth tab.

## Architecture

Next.js 16 App Router, TypeScript, Tailwind. No database yet.

**Auth flow:** `app/api/auth/linkedin` sets a `state` cookie and redirects to LinkedIn → `app/api/auth/linkedin/callback` verifies state, exchanges the code, fetches `/v2/userinfo`, and stores `{accessToken, expiresAt, personId, name}` as JSON in the httpOnly `li_session` cookie → `lib/session.ts#getSession` reads it everywhere else and returns `null` when expired (callers must treat that as "reconnect required").

**LinkedIn client (`lib/linkedin.ts`):** all LinkedIn HTTP calls live here — authorize URL, token exchange, userinfo, and `createPost` (versioned Posts API `POST /rest/posts`, `LinkedIn-Version` header from `LINKEDIN_VERSION`, defaulting to two months before the current date so it stays inside LinkedIn's 12-month active window). `commentary` text is escaped for LinkedIn's "little text" reserved characters before sending; keep that when touching post creation.

**Publishing:** `app/api/post` (session-gated, 3,000-char limit) → `createPost` → returns the post URN from the `x-restli-id` response header plus a feed URL.

**Content pipeline (`lib/pipeline.ts`):** `generatePost(domain, notes?)` fetches fresh items from Google News search RSS (`lib/news.ts`, no API key, `when:7d` window), filters out links already in post history, then one `generateObject` call (AI SDK with `@ai-sdk/google`, model from `AI_MODEL`, default `gemini-2.5-flash`) both selects the most post-worthy item and drafts the post. Validation strips markdown (LinkedIn renders it literally) and enforces the 3,000-char limit; empty feeds and oversized drafts throw — surfaced to the UI, never silently patched. `app/api/generate` wraps this and returns `{text, source}`; it returns 501 when `GOOGLE_GENERATIVE_AI_API_KEY` is unset so the UI degrades gracefully.

**Explainer images (`lib/explainer.ts` + `lib/render.ts`):** hand-drawn-notebook-style PNGs (1080×1350) that visually explain the post's concept. Deliberately NOT AI image generation — text accuracy matters, so Gemini `generateObject` produces a structured spec (title/intro/steps/flowchart/example/use-case icons/note, all with word limits sized to the fixed layout) and `renderExplainerHtml` renders it as HTML/CSS (Caveat + Kalam Google Fonts, generated SVG flowchart with a No-loop, curated SVG icon set in `ICON_SVGS`) which Playwright screenshots via the system Chrome (`channel: "chrome"`, `playwright-core` — kept in `serverExternalPackages` in next.config.ts). Preview quickly with `npx tsx scripts/render-sample.ts` → `data/images/`. `app/api/image` (POST) generates from `{domain, postText}`; `app/api/image/[file]` (GET) serves previews. On publish, `app/api/post` uploads the PNG through LinkedIn's Images API (`uploadImage` in `lib/linkedin.ts`: initializeUpload → PUT binary → poll until AVAILABLE) and attaches the URN as `content.media`.

**Post history (`lib/history.ts`):** JSON file at `data/post-history.json` (gitignored, local-dev stopgap until the database lands). `app/api/post` records `{domain, postUrn, sourceTitle, sourceLink}` after each successful publish; `postedLinks()` feeds the pipeline's dedupe.

**UI:** `app/page.tsx` (server component) branches on session; `components/post-composer.tsx` (client) drives generate/publish against the API routes.

## Hard Constraints (do not violate)

- **Official API only.** Posting to LinkedIn must go through the LinkedIn Posts API. Never implement browser automation or scraping to post — it violates LinkedIn's Terms of Service and gets user accounts restricted.
- **Token lifecycle.** LinkedIn access tokens last ~60 days and do not auto-refresh for most apps. Expiry must be detected and surfaced to the user for re-authorization — never fail silently.
- **Posting frequency.** Cap automated posts (target ~1/day per user). Deduplicate against post history so the same article/topic is never posted twice.
- **Human-in-the-loop by default.** New posts should land in a review queue unless the user has explicitly enabled fully automatic publishing.
- **Failure behavior.** If the token is expired, the API is down, or the LLM output fails validation, notify the user — never publish low-quality fallback content and never drop errors silently.

## Roadmap

1. ~~LinkedIn OAuth flow + publishing a post~~ (done)
2. ~~Content pipeline: domain sources → topic selection → LLM drafting → validation~~ (done)
3. Database (replace cookie sessions + local-file history; user preferences) + scheduling (Vercel Cron) + review queue
