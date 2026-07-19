# LinkedIn Post Agent

Drafts domain-specific LinkedIn posts with an LLM and publishes them to your LinkedIn profile via the official LinkedIn API.

## Setup

1. **LinkedIn app** — at [developer.linkedin.com](https://developer.linkedin.com), your app needs the products **"Share on LinkedIn"** and **"Sign In with LinkedIn using OpenID Connect"**.
2. **Redirect URL** — in the app's **Auth** tab, add `http://localhost:3000/api/auth/linkedin/callback` under Authorized redirect URLs.
3. **Env vars** — fill in `.env.local` (created from `.env.example`):
   - `LINKEDIN_CLIENT_ID` / `LINKEDIN_CLIENT_SECRET` — from the app's Auth tab
   - `AI_GATEWAY_API_KEY` — optional, enables the "Generate draft" button

## Run

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000), click **Connect LinkedIn**, authorize, then write (or generate) a post and hit **Publish to LinkedIn**.

## How it works

- `app/api/auth/linkedin` starts the OAuth 2.0 flow; the callback exchanges the code for a ~60-day access token and stores it in an httpOnly cookie (`lib/session.ts`).
- `app/api/post` publishes the text via LinkedIn's versioned Posts API (`lib/linkedin.ts`).
- `app/api/generate` drafts a post for your chosen domain using the AI SDK through the Vercel AI Gateway.

Posts always go through the review textarea before publishing — nothing is posted automatically yet. See `CLAUDE.md` for the roadmap (content sources, scheduling, database).
